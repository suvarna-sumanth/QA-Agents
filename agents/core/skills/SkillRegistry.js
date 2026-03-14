export class SkillRegistry {
  constructor() {
    this.skills = new Map();
  }

  /**
   * Register a new skill in the registry.
   * @param {Skill} skill The skill instance to register.
   */
  register(skill) {
    this.skills.set(skill.name, skill);
  }

  /**
   * Get all registered tool definitions for passing to the LLM.
   */
  getToolDefinitions() {
    return [...this.skills.values()].map(s => s.toToolDefinition());
  }

  /**
   * Execute a specific skill by name.
   * @param {string} skillName The name of the skill to execute.
   * @param {Object} input Input parameters for the skill.
   * @param {Object} context Execution context injected by the Supervisor.
   */
  async execute(skillName, input, context) {
    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Unknown skill: ${skillName}`);
    }
    return skill.execute(input, context);
  }
}
