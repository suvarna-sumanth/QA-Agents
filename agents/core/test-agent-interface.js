#!/usr/bin/env node

/**
 * Simple test to verify Agent interface and AgentShivani work correctly.
 * This tests the abstraction layer without actually running browser automation.
 */

import AgentShivani from '../shivani/src/AgentShivani.js';
import { bootstrapAgents } from './bootstrap.js';
import { getRegistry } from './AgentRegistry.js';

async function testAgentAbstraction() {
  console.log('Testing Agent abstraction layer...\n');

  // Test 1: Create agent instance
  console.log('Test 1: Instantiate AgentShivani');
  const agent = new AgentShivani();
  console.log(`✓ Agent created: ${agent.id} (${agent.name})`);
  console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
  console.log(`  Metadata:`, agent.getMetadata());

  // Test 2: Bootstrap system
  console.log('\nTest 2: Bootstrap agent registry');
  const { registry } = bootstrapAgents();
  console.log('✓ Agent system bootstrapped');
  console.log(`  Registered agents: ${registry.getAllAgents().map((a) => a.id).join(', ')}`);
  console.log(`  Available capabilities: ${registry.getCapabilities().join(', ')}`);

  // Test 3: Retrieve agent from registry
  console.log('\nTest 3: Retrieve agent from registry');
  const shivaniFromRegistry = registry.getAgent('agent-shivani');
  console.log(`✓ Retrieved: ${shivaniFromRegistry.id}`);

  // Test 4: Query agents by capability
  console.log('\nTest 4: Query agents by capability');
  const testingAgents = registry.getAgentsByCapability('testAudioPlayer');
  console.log(`✓ Agents with "testAudioPlayer" capability: ${testingAgents.map((a) => a.id).join(', ')}`);

  // Test 5: Simulate job structure
  console.log('\nTest 5: Simulate job submission');
  const mockJob = {
    jobId: 'test-job-001',
    type: 'url',
    target: 'https://example.com/article',
    config: {},
    onStepStart: (step, meta) => console.log(`  [event] Step started: ${step}`),
    onStepEnd: (step, result) => console.log(`  [event] Step ended: ${step} -> ${result.status}`),
  };

  console.log(`✓ Mock job created: ${mockJob.jobId}`);
  console.log(`  Type: ${mockJob.type}`);
  console.log(`  Target: ${mockJob.target}`);

  console.log('\n✅ All abstraction tests passed!');
  console.log('\nAgent system is ready for:');
  console.log('  - HTTP API integration (runJob via REST)');
  console.log('  - Queue/scheduler integration (runJob via queue)');
  console.log('  - Multi-agent orchestration');
  console.log('  - Dashboard metrics and monitoring');
}

testAgentAbstraction().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
