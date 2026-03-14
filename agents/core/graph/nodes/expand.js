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
    
    // We limit to 2 articles to avoid infinite loops/long runs in MVP
    const subset = data.urls.slice(0, 2);
    
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
