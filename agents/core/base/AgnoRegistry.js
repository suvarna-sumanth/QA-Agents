/**
 * AgnoRegistry.js - Tool and agent registration system
 *
 * Central registry for all tools and agents in the Agno system.
 * Provides runtime lookup and introspection capabilities.
 *
 * @class AgnoRegistry
 */
export class AgnoRegistry {
  /**
   * Creates an instance of AgnoRegistry
   *
   * @param {Object} [config] - Optional configuration
   * @param {Object} [config.logger] - Logger instance
   */
  constructor(config = {}) {
    this.config = config;
    this.logger = config.logger || console;

    // Storage for registered items
    this.tools = new Map();
    this.agents = new Map();
    this.aliases = new Map(); // Name -> canonical name mapping

    this.metadata = {
      type: 'registry',
      version: '1.0.0',
      createdAt: Date.now()
    };
  }

  /**
   * Registers a tool in the registry
   *
   * Tools must have a name (from metadata) for lookup.
   * Can optionally provide aliases for convenience.
   *
   * @param {AgnoTool} tool - Tool instance to register
   * @param {Array<string>} [aliases] - Alternative names for lookup
   * @throws {Error} if tool already registered or no name
   */
  registerTool(tool, aliases = []) {
    const name = tool.getMetadata().name;

    if (!name) {
      throw new Error('Tool must have a name in metadata');
    }

    if (this.tools.has(name)) {
      throw new Error(`Tool already registered: ${name}`);
    }

    this.tools.set(name, tool);
    this.logger.debug(`Registered tool: ${name}`);

    // Register aliases
    aliases.forEach(alias => {
      this.aliases.set(alias, name);
    });
  }

  /**
   * Registers multiple tools at once
   *
   * @param {Array<AgnoTool>} tools - Array of tool instances
   * @throws {Error} if any tool fails registration
   */
  registerTools(tools) {
    if (!Array.isArray(tools)) {
      throw new Error('tools must be an array');
    }

    tools.forEach(tool => {
      this.registerTool(tool);
    });
  }

  /**
   * Registers an agent in the registry
   *
   * @param {AgnoAgent|AgnoSubAgent} agent - Agent instance to register
   * @param {Array<string>} [aliases] - Alternative names for lookup
   * @throws {Error} if agent already registered or no name
   */
  registerAgent(agent, aliases = []) {
    const name = agent.getMetadata().name;

    if (!name) {
      throw new Error('Agent must have a name in metadata');
    }

    if (this.agents.has(name)) {
      throw new Error(`Agent already registered: ${name}`);
    }

    this.agents.set(name, agent);
    this.logger.debug(`Registered agent: ${name}`);

    // Register aliases
    aliases.forEach(alias => {
      this.aliases.set(alias, name);
    });
  }

  /**
   * Registers multiple agents at once
   *
   * @param {Array<AgnoAgent|AgnoSubAgent>} agents - Array of agent instances
   * @throws {Error} if any agent fails registration
   */
  registerAgents(agents) {
    if (!Array.isArray(agents)) {
      throw new Error('agents must be an array');
    }

    agents.forEach(agent => {
      this.registerAgent(agent);
    });
  }

  /**
   * Gets a registered tool by name
   *
   * Supports alias lookup via aliases map.
   *
   * @param {string} name - Tool name or alias
   * @returns {AgnoTool|undefined} Tool instance or undefined if not found
   */
  getTool(name) {
    // Resolve alias if present
    const resolved = this.aliases.get(name) || name;
    return this.tools.get(resolved);
  }

  /**
   * Gets a registered agent by name
   *
   * Supports alias lookup via aliases map.
   *
   * @param {string} name - Agent name or alias
   * @returns {AgnoAgent|AgnoSubAgent|undefined} Agent instance or undefined
   */
  getAgent(name) {
    // Resolve alias if present
    const resolved = this.aliases.get(name) || name;
    return this.agents.get(resolved);
  }

  /**
   * Gets a registered item (tool or agent) by name
   *
   * @param {string} name - Item name or alias
   * @returns {Object|undefined} Tool or agent instance
   */
  get(name) {
    return this.getTool(name) || this.getAgent(name);
  }

  /**
   * Gets all registered items of a specific type
   *
   * @param {string} type - Type to get: 'tools' or 'agents'
   * @returns {Array<Object>} Array of registered items
   */
  getAll(type = 'tools') {
    if (type === 'tools') {
      return Array.from(this.tools.values());
    } else if (type === 'agents') {
      return Array.from(this.agents.values());
    }
    throw new Error(`Unknown type: ${type}`);
  }

  /**
   * Gets all registered tool names
   *
   * @returns {Array<string>} Array of tool names
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Gets all registered agent names
   *
   * @returns {Array<string>} Array of agent names
   */
  getAgentNames() {
    return Array.from(this.agents.keys());
  }

  /**
   * Checks if a tool is registered
   *
   * @param {string} name - Tool name or alias
   * @returns {boolean} True if registered
   */
  hasTool(name) {
    const resolved = this.aliases.get(name) || name;
    return this.tools.has(resolved);
  }

  /**
   * Checks if an agent is registered
   *
   * @param {string} name - Agent name or alias
   * @returns {boolean} True if registered
   */
  hasAgent(name) {
    const resolved = this.aliases.get(name) || name;
    return this.agents.has(resolved);
  }

  /**
   * Returns count of registered tools and agents
   *
   * @returns {Object} Counts object
   */
  getCounts() {
    return {
      tools: this.tools.size,
      agents: this.agents.size,
      total: this.tools.size + this.agents.size
    };
  }

  /**
   * Clears all registrations (mostly for testing)
   *
   * @returns {void}
   */
  clear() {
    this.tools.clear();
    this.agents.clear();
    this.aliases.clear();
    this.logger.debug('Registry cleared');
  }

  /**
   * Returns metadata about the registry
   *
   * @returns {Object} Metadata with counts and version
   */
  getMetadata() {
    return {
      ...this.metadata,
      ...this.getCounts()
    };
  }
}
