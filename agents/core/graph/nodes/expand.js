/**
 * The Expand node looks at the results of the last executed skill.
 * If new URLs were discovered, it adds them to the plan.
 */
export const expandNode = async (state) => {
  const lastResult = state.results[state.results.length - 1];
  
  if (!lastResult || (lastResult.status !== 'success' && lastResult.status !== 'pass') || !lastResult.data) {
    return state;
  }

  const { skill, data } = lastResult;
  let newSteps = [];

  // If we just discovered articles, queue them for testing
  if (skill === 'discover_articles' && data.urls && data.urls.length > 0) {
    console.log(`[Supervisor:Expand] Planning tests for ${data.urls.length} discovered articles.`);
    
    // Use Mission Payload Depth (maxArticles) from initial job config
    const maxToTest = Math.max(1, Math.min(100, state.maxArticles ?? 3));
    const subset = data.urls.slice(0, maxToTest);
    
    for (const url of subset) {
      newSteps.push({ skill: 'detect_player', input: { urls: [url] } });
      newSteps.push({ skill: 'test_player', input: { url } });
    }
  }

  if (newSteps.length > 0) {
    // Append new steps to the end of the existing plan
    return {
      plan: [...state.plan, ...newSteps]
    };
  }

  return state;
};
