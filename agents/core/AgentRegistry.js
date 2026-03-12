/**
 * In-memory Agent Registry
 * Tracks registered agents and their capabilities for discovery and orchestration.
 */

export class AgentRegistry {
  constructor() {
    this.agents = new Map(); // Map<agentId, agentInstance>
    this.capabilityIndex = new Map(); // Map<capability, [agentIds]>
  }

  /**
   * Register an agent instance.
   * @param {Agent} agent - Agent instance to register
   * @throws {Error} if agent ID is already registered
   */
  register(agent) {
    const agentId = agent.id;

    if (this.agents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already registered`);
    }

    this.agents.set(agentId, agent);

    // Index capabilities
    for (const capability of agent.capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, []);
      }
      this.capabilityIndex.get(capability).push(agentId);
    }

    console.log(`[Registry] Registered agent: ${agentId} (${agent.name})`);
  }

  /**
   * Unregister an agent by ID.
   * @param {string} agentId - Agent ID to unregister
   */
  unregister(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`[Registry] Agent ${agentId} not found for unregistration`);
      return;
    }

    this.agents.delete(agentId);

    // Remove from capability index
    for (const capability of agent.capabilities) {
      const agents = this.capabilityIndex.get(capability);
      if (agents) {
        const idx = agents.indexOf(agentId);
        if (idx !== -1) {
          agents.splice(idx, 1);
        }
      }
    }

    console.log(`[Registry] Unregistered agent: ${agentId}`);
  }

  /**
   * Get an agent by ID.
   * @param {string} agentId - Agent ID
   * @returns {Agent|undefined}
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents.
   * @returns {Agent[]}
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by capability.
   * @param {string} capability - Capability name
   * @returns {Agent[]}
   */
  getAgentsByCapability(capability) {
    const agentIds = this.capabilityIndex.get(capability) || [];
    return agentIds.map((id) => this.agents.get(id)).filter(Boolean);
  }

  /**
   * Get metadata for all agents (for API responses).
   * @returns {Object[]}
   */
  getAgentsMetadata() {
    return this.getAllAgents().map((agent) => agent.getMetadata());
  }

  /**
   * Check if an agent is registered.
   * @param {string} agentId - Agent ID
   * @returns {boolean}
   */
  hasAgent(agentId) {
    return this.agents.has(agentId);
  }

  /**
   * Get list of available capabilities.
   * @returns {string[]}
   */
  getCapabilities() {
    return Array.from(this.capabilityIndex.keys());
  }
}

// Singleton instance
let registryInstance = null;

export function getRegistry() {
  if (!registryInstance) {
    registryInstance = new AgentRegistry();
  }
  return registryInstance;
}

export default AgentRegistry;
