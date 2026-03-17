import { agentLogger } from '../../Logger.js';

/**
 * The Execute node runs the next skill in the plan.
 */
export const executeNode = (skillRegistry) => async (state) => {
  const step = state.plan[state.currentStep];
  
  const componentMap = {
    'discover_articles': 'Discovery',
    'detect_player': 'Detection',
    'test_player': 'Functional',
    'bypass_cloudflare': 'System',
    'bypass_perimeterx': 'System',
    'dismiss_popups': 'System',
    'take_screenshot': 'Detection'
  };

  const component = componentMap[step.skill] || 'Engineer';
  agentLogger.log(component, `Executing skill: ${step.skill}`, state.jobId);
  
  try {
    // Retrieve context (like shared browsers) if present
    const context = state.context || {};
    
    const result = await skillRegistry.execute(step.skill, step.input, context);
    if (step.skill === 'discover_articles' && result?.discoveryCookies?.length) {
      context.discoveryCookies = result.discoveryCookies;
    }
    return { 
      results: [{ step: state.currentStep, skill: step.skill, status: 'pass', data: result }],
      currentStep: state.currentStep + 1,
      context
    };
  } catch (err) {
    console.warn(`[Supervisor:Execute] Skill ${step.skill} failed: ${err.message}`);
    return { 
      results: [{ step: state.currentStep, skill: step.skill, status: 'error', error: err.message, stack: err.stack }],
      currentStep: state.currentStep + 1
    };
  }
};
