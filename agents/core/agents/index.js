/**
 * Agno Sub-Agents Export Index
 *
 * Exports all sub-agents used in the Agno system
 */

const DiscoverySubAgent = require('./DiscoverySubAgent');
const DetectionSubAgent = require('./DetectionSubAgent');
const TestingSubAgent = require('./TestingSubAgent');
const BypassSubAgent = require('./BypassSubAgent');
const EvidenceSubAgent = require('./EvidenceSubAgent');

/**
 * Get all sub-agents
 * @param {Object} config - Configuration to pass to agents
 * @returns {Object} Map of agent name to agent instance
 */
function createAllSubAgents(config = {}) {
  return {
    discovery: new DiscoverySubAgent(config),
    detection: new DetectionSubAgent(config),
    testing: new TestingSubAgent(config),
    bypass: new BypassSubAgent(config),
    evidence: new EvidenceSubAgent(config)
  };
}

module.exports = {
  DiscoverySubAgent,
  DetectionSubAgent,
  TestingSubAgent,
  BypassSubAgent,
  EvidenceSubAgent,
  createAllSubAgents
};
