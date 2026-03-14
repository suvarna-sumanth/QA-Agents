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
 * Bootstraps the entire Cognitive Agent System.
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
