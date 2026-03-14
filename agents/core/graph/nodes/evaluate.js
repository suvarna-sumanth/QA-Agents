import { agentLogger } from '../../Logger.js';

/**
 * The Evaluate node reviews the execution and saves results to memory.
 */
export const evaluateNode = (memoryService) => async (state) => {
  agentLogger.log('Orchestrator', `Evaluating mission results for ${state.url}`, state.jobId);
  
  const hasErrors = state.results.some(r => r.status === 'error');
  // Only use successful detect_player results (failed runs have no data and would overwrite good profile)
  const successfulDetects = state.results.filter(
    r => r.skill === 'detect_player' && (r.status === 'pass' || r.status === 'success') && r.data
  );
  const foundPlayerFromDetect = successfulDetects.some(r => r.data?.results?.some(pr => pr.hasPlayer));
  const anyTestPlayerPassed = state.results.some(
    r => r.skill === 'test_player' && (r.status === 'pass' || r.status === 'success')
  );
  // Found player if any successful detect said so, or if test_player passed (player was there)
  const foundPlayer = foundPlayerFromDetect || (anyTestPlayerPassed && successfulDetects.length === 0);

  // Overall status heuristic
  let overallStatus = 'pass';
  if (hasErrors) overallStatus = 'error';
  else if (!foundPlayer && state.results.some(r => r.skill === 'test_player')) overallStatus = 'fail';

  const totalDuration = Date.now() - (state.startTime || Date.now());

  // Format the result in the way TestHistoryStore expects
  const resultData = {
    overallStatus,
    results: state.results, // Using results for cognitive format
    totalDuration,
  };
  
  // Save to test history
  await memoryService.recordTestResult(state.jobId, state.url, resultData);
  
  // Update Site Profile only from confident data so we don't overwrite good memory with bad run
  const existingProfile = state.siteProfile || {};
  const protectionFromRun = successfulDetects[0]?.data?.protection;
  const protectionResult = protectionFromRun ?? existingProfile.protection_type ?? 'unknown';
  // Only set has_instaread_player to false when we had successful detects and none found player
  const hasConfidentDetectResult = successfulDetects.length > 0;
  const has_instaread_player = hasConfidentDetectResult
    ? foundPlayerFromDetect
    : (foundPlayer || existingProfile.has_instaread_player);
  
  await memoryService.updateSiteProfile(state.domain, {
    has_instaread_player: !!has_instaread_player,
    protection_type: protectionResult,
    last_tested_at: new Date().toISOString()
  });

  // Record strategy outcome for bypass_strategies (used by getBestStrategy on future runs)
  const strategyName = protectionResult && protectionResult !== 'unknown' ? protectionResult : 'browser-headed';
  await memoryService.recordStrategyResult(state.domain, strategyName, !hasErrors, totalDuration).catch((err) => {
    console.warn('[Supervisor:Evaluate] Strategy record failed:', err?.message);
  });

  // CLEANUP: Close the shared browser if it exists
  if (state.context?.sharedBrowser?.cleanup) {
    console.log('[Supervisor:Evaluate] Cleaning up shared browser session...');
    await state.context.sharedBrowser.cleanup().catch(() => {});
    // If it's a pooled browser, we might want to keep it, 
    // but the cognitive agent's context.cleanup is usually the right level of abstraction.
  }

  return { totalDuration }; 
};
