/**
 * agents/core/index.js - Main entry point for Agno system
 *
 * Exports all base classes, memory implementations, and provides
 * factory function for creating the Agno system.
 */

// Export all base classes
export * from './base/index.js';

// Export all memory classes
export * from './memory/index.js';

// Export parent agent and prompts
export { QAParentAgent } from './agents/QAParentAgent.js';
export { PromptLoader } from './prompts/PromptLoader.js';

// Export adapters
export { LegacyAPIAdapter } from './adapters/LegacyAPIAdapter.js';

// Export monitoring
export { Metrics } from './monitoring/Metrics.js';
export { Logger } from './monitoring/Logger.js';

// Legacy imports (keeping for backward compatibility)
import { MemoryService } from './memory/MemoryService.js';
import { SkillRegistry } from './skills/SkillRegistry.js';
import { DiscoverArticlesSkill } from './skills/DiscoverArticlesSkill.js';
import { DetectPlayerSkill } from './skills/DetectPlayerSkill.js';
import { TestPlayerSkill } from './skills/TestPlayerSkill.js';
import { BypassCloudflareSkill } from './skills/BypassCloudflareSkill.js';
import { BypassPerimeterXSkill } from './skills/BypassPerimeterXSkill.js';
import { DismissPopupsSkill } from './skills/DismissPopupsSkill.js';
import { TakeScreenshotSkill } from './skills/TakeScreenshotSkill.js';
import { SupervisorAgent } from './graph/SupervisorAgent.js';

/**
 * Creates the Agno QA system with all required components
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.supabaseClient - Supabase client instance
 * @param {Object} [config.browser] - Browser pool instance
 * @param {Object} [config.proxy] - Proxy manager instance
 * @param {Object} [config.s3] - S3 client instance
 * @param {Object} [config.logger] - Logger instance
 * @returns {Promise<Object>} System with { agent, registry, memory }
 */
export async function createAgnoSystem(config) {
  const { AgnoRegistry, MemoryService: MemSvc, SessionMemoryStore, PersistentMemory } = await import('./base/index.js').then(m => ({
    AgnoRegistry: m.AgnoRegistry,
    MemoryService: MemSvc,
    SessionMemoryStore: m.SessionMemoryStore || (await import('./memory/SessionMemoryStore.js')).SessionMemoryStore,
    PersistentMemory: m.PersistentMemory
  })).catch(() => null);

  // Return system object
  return {
    // Will be populated in Phase 2 with actual parent agent
    agent: null,
    registry: null,
    memory: null
  };
}

/**
 * Bootstraps the entire Cognitive Agent System (legacy).
 * Ties together the Database layer (Track 1) and the Skills layer (Track 2)
 * into the LangGraph Supervisor Agent (Track 3).
 *
 * @returns {Object} { memory, skills, supervisor }
 */
export function createCognitiveSystem() {
  const memory = new MemoryService();

  const skills = new SkillRegistry();
  skills.register(new DiscoverArticlesSkill());
  skills.register(new DetectPlayerSkill());
  skills.register(new TestPlayerSkill());
  skills.register(new BypassCloudflareSkill());
  skills.register(new BypassPerimeterXSkill());
  skills.register(new DismissPopupsSkill());
  skills.register(new TakeScreenshotSkill());

  const supervisor = new SupervisorAgent(memory, skills);

  return { memory, skills, supervisor };
}
