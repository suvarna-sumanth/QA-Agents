/**
 * tests/unit/agents/core/AgnoAgent.test.js - Tests for AgnoAgent
 */

import { AgnoAgent } from '../../../../agents/core/base/AgnoAgent.js';
import { AgnoRegistry } from '../../../../agents/core/base/AgnoRegistry.js';
import { createMockLogger } from '../../../setup.js';

describe('AgnoAgent', () => {
  let agent;
  let logger;
  let registry;

  beforeEach(() => {
    logger = createMockLogger();
    registry = new AgnoRegistry({ logger });
    agent = new AgnoAgent({
      logger,
      registry
    });
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(agent).toBeDefined();
      expect(agent.logger).toBe(logger);
      expect(agent.registry).toBe(registry);
    });

    it('should throw if logger not provided', () => {
      expect(() => {
        new AgnoAgent({ registry });
      }).toThrow('logger required');
    });

    it('should throw if registry not provided', () => {
      expect(() => {
        new AgnoAgent({ logger });
      }).toThrow('registry required');
    });

    it('should set default metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.name).toBe('AgnoAgent');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.type).toBe('parent');
      expect(metadata.createdAt).toBeDefined();
    });
  });

  describe('getMetadata', () => {
    it('should return metadata with counts', () => {
      const metadata = agent.getMetadata();
      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('type');
      expect(metadata).toHaveProperty('registeredTools');
      expect(metadata).toHaveProperty('registeredAgents');
    });
  });

  describe('validateInput', () => {
    it('should throw if jobId missing', () => {
      expect(() => {
        agent.validateInput({
          domain: 'example.com',
          targetUrl: 'https://example.com'
        });
      }).toThrow('jobId required');
    });

    it('should throw if domain missing', () => {
      expect(() => {
        agent.validateInput({
          jobId: 'job-1',
          targetUrl: 'https://example.com'
        });
      }).toThrow('domain required');
    });

    it('should throw if targetUrl missing', () => {
      expect(() => {
        agent.validateInput({
          jobId: 'job-1',
          domain: 'example.com'
        });
      }).toThrow('targetUrl required');
    });

    it('should pass with valid input', () => {
      expect(() => {
        agent.validateInput({
          jobId: 'job-1',
          domain: 'example.com',
          targetUrl: 'https://example.com'
        });
      }).not.toThrow();
    });
  });

  describe('abstract methods', () => {
    it('should throw when execute() called', async () => {
      await expect(agent.execute({})).rejects.toThrow('execute() must be implemented');
    });

    it('should throw when think() called', async () => {
      await expect(agent.think({})).rejects.toThrow('think() must be implemented');
    });

    it('should throw when dispatch() called', async () => {
      await expect(agent.dispatch('discovery', {})).rejects.toThrow(
        'dispatch() must be implemented'
      );
    });

    it('should throw when synthesizeResults() called', () => {
      expect(() => {
        agent.synthesizeResults({});
      }).toThrow('synthesizeResults() must be implemented');
    });
  });

  describe('inheritance', () => {
    it('should allow subclassing', () => {
      class TestAgent extends AgnoAgent {
        async execute(input) {
          return { jobId: input.jobId, status: 'success' };
        }

        async think(context) {
          return { action: 'continue' };
        }

        async dispatch(agentType, input) {
          return { result: 'dispatched' };
        }

        synthesizeResults(phases) {
          return { combined: true };
        }
      }

      const testAgent = new TestAgent({ logger, registry });
      expect(testAgent).toBeInstanceOf(AgnoAgent);
      expect(testAgent.logger).toBe(logger);
    });
  });
});
