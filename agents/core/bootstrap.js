/**
 * Agent Bootstrap Module
 * Initializes the agent ecosystem with default agents and registry.
 * Call this once at application startup to register all available agents.
 */

import { getRegistry } from './AgentRegistry.js';
import AgentShivani from '../shivani/src/AgentShivani.js';
import SeniorEngineerAgent from './SeniorEngineerAgent.js';
import { cleanupBrowserPool } from '../shivani/src/browser.js';

let bootstrapped = false;
let shutdownHandlersRegistered = false;

/**
 * Register graceful shutdown handlers for resource cleanup.
 * Only registered once, even if bootstrap called multiple times.
 */
function registerShutdownHandlers() {
  if (shutdownHandlersRegistered) return;
  
  const handleShutdown = async (signal) => {
    console.log(`\n[Bootstrap] Received ${signal}, cleaning up resources...`);
    try {
      await cleanupBrowserPool();
      console.log('[Bootstrap] Resource cleanup complete');
    } catch (err) {
      console.error('[Bootstrap] Error during cleanup:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('beforeExit', () => {
    console.log('[Bootstrap] Node process ending, ensuring browser cleanup...');
    cleanupBrowserPool().catch(() => {});
  });

  shutdownHandlersRegistered = true;
  console.log('[Bootstrap] Shutdown handlers registered');
}

/**
 * Initialize the agent system with default agents.
 * Safe to call multiple times (idempotent).
 *
 * @returns {Object} Object with registry and agents
 */
export function bootstrapAgents() {
  if (bootstrapped) {
    console.log('[Bootstrap] Agent system already initialized');
    return { registry: getRegistry() };
  }

  const registry = getRegistry();

  // Register Shivani agent
  const shivani = new AgentShivani();
  registry.register(shivani);

  // Register Senior Engineer agent
  const engineer = new SeniorEngineerAgent();
  registry.register(engineer);

  // Register shutdown handlers for resource cleanup
  registerShutdownHandlers();

  bootstrapped = true;
  console.log('[Bootstrap] Agent system initialized');

  return {
    registry,
    agents: {
      shivani,
      engineer,
    },
  };
}

/**
 * Reset the bootstrap state (useful for testing).
 */
export function resetBootstrap() {
  bootstrapped = false;
}

export default bootstrapAgents;
