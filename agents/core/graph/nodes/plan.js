import { agentLogger } from '../../Logger.js';

export const planNode = (memoryService) => async (state) => {
  agentLogger.log('Engineer', `Planning execution for ${state.url}`, state.jobId);
  
  // Recall knowledge about this domain (memory layer — agent is aware of past runs)
  const profile = await memoryService.recallSiteProfile(state.domain);
  if (profile) {
    console.log(`[Supervisor:Plan] Using site profile for ${state.domain}: protection=${profile.protection_type || 'unknown'}, has_instaread_player=${!!profile.has_instaread_player}, last_tested=${profile.last_tested_at || 'never'}`);
  }

  let plan = [];
  
  // Decide steps based on profile knowledge and URL type
  const isHome = state.url === `https://${state.domain}/` || state.url === `http://${state.domain}/` || state.url.length <= (state.domain.length + 9);
  
  if (isHome) {
    // Phase 1: Exploration
    plan.push({ skill: 'discover_articles', input: { domain: state.url, maxArticles: state.maxArticles ?? 3 } });
  } else {
    // Targeted Testing: Always check for bot protection first if we're unsure or it's known to exist
    if (!profile || profile.protection_type !== 'none') {
      const protection = profile?.protection_type || 'unknown';
      if (protection === 'cloudflare' || protection === 'unknown') {
        plan.push({ skill: 'bypass_cloudflare', input: { url: state.url, maxWaitMs: 90000 } });
      } else if (protection === 'perimeterx') {
        plan.push({ skill: 'bypass_perimeterx', input: { url: state.url, maxRetries: 3 } });
      }
      plan.push({ skill: 'dismiss_popups', input: {} });
    }
    
    plan.push({ skill: 'detect_player', input: { urls: [state.url] } });
    plan.push({ skill: 'test_player', input: { url: state.url } });
    plan.push({ skill: 'take_screenshot', input: { screenshotName: 'final_state' } });
  }

  console.log(`[Supervisor:Plan] Created plan with ${plan.length} steps: ${plan.map(p => p.skill).join(' -> ')}`);

  return { siteProfile: profile, plan, currentStep: 0 };
};
