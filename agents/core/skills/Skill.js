export class Skill {
  constructor(name, description, inputSchema, outputSchema) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
  }

  /**
   * Execute the skill logic.
   * @param {Object} input The input parameters for the skill.
   * @param {Object} context The execution context (e.g. browserPool, memoryService, logger).
   */
  async execute(input, context) {
    throw new Error('Subclass must implement execute()');
  }

  /**
   * Convert the skill metadata into an LLM-friendly tool definition.
   * This is used by the LangGraph Supervisor to select tools.
   */
  toToolDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.inputSchema,
    };
  }
}
