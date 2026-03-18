/**
 * tests/unit/agents/core/AgnoRegistry.test.js - Tests for AgnoRegistry
 */

import { AgnoRegistry } from '../../../../agents/core/base/AgnoRegistry.js';
import { AgnoTool } from '../../../../agents/core/base/AgnoTool.js';
import { AgnoAgent } from '../../../../agents/core/base/AgnoAgent.js';
import { createMockLogger } from '../../../setup.js';

describe('AgnoRegistry', () => {
  let registry;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    registry = new AgnoRegistry({ logger });
  });

  describe('constructor', () => {
    it('should create empty registry', () => {
      expect(registry.tools.size).toBe(0);
      expect(registry.agents.size).toBe(0);
      expect(registry.aliases.size).toBe(0);
    });

    it('should set metadata', () => {
      const metadata = registry.getMetadata();
      expect(metadata.type).toBe('registry');
      expect(metadata.version).toBe('1.0.0');
    });
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool);
      expect(registry.tools.size).toBe(1);
    });

    it('should throw if tool already registered', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool);
      expect(() => {
        registry.registerTool(tool);
      }).toThrow('Tool already registered');
    });

    it('should support aliases', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool, ['alias1', 'alias2']);
      expect(registry.aliases.size).toBe(2);
    });

    it('should throw if tool has no name', () => {
      const tool = new AgnoTool();
      // Override metadata without name
      tool.metadata = { type: 'tool' };
      tool.getMetadata = () => ({ type: 'tool' });

      expect(() => {
        registry.registerTool(tool);
      }).toThrow('Tool must have a name');
    });
  });

  describe('registerTools', () => {
    it('should register multiple tools', () => {
      const tools = [new AgnoTool(), new AgnoTool(), new AgnoTool()];
      registry.registerTools(tools);
      expect(registry.tools.size).toBe(3);
    });

    it('should throw if not array', () => {
      expect(() => {
        registry.registerTools('not array');
      }).toThrow('tools must be an array');
    });
  });

  describe('getTool', () => {
    it('should get registered tool by name', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool);
      const found = registry.getTool('AgnoTool');
      expect(found).toBe(tool);
    });

    it('should get tool by alias', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool, ['my-alias']);
      const found = registry.getTool('my-alias');
      expect(found).toBe(tool);
    });

    it('should return undefined for missing tool', () => {
      const found = registry.getTool('NonExistent');
      expect(found).toBeUndefined();
    });
  });

  describe('hasTool', () => {
    it('should return true for registered tool', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool);
      expect(registry.hasTool('AgnoTool')).toBe(true);
    });

    it('should return false for unregistered tool', () => {
      expect(registry.hasTool('NonExistent')).toBe(false);
    });

    it('should support alias checking', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool, ['my-alias']);
      expect(registry.hasTool('my-alias')).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should get all tools', () => {
      const tool1 = new AgnoTool();
      const tool2 = new AgnoTool();
      registry.registerTool(tool1);
      registry.registerTool(tool2);

      const tools = registry.getAll('tools');
      expect(tools.length).toBe(2);
    });

    it('should throw for invalid type', () => {
      expect(() => {
        registry.getAll('invalid');
      }).toThrow('Unknown type');
    });
  });

  describe('getCounts', () => {
    it('should return correct counts', () => {
      registry.registerTool(new AgnoTool());
      registry.registerTool(new AgnoTool());

      const counts = registry.getCounts();
      expect(counts.tools).toBe(2);
      expect(counts.agents).toBe(0);
      expect(counts.total).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      registry.registerTool(new AgnoTool());
      registry.registerTool(new AgnoTool());

      registry.clear();
      expect(registry.tools.size).toBe(0);
      expect(registry.aliases.size).toBe(0);
    });
  });

  describe('logging', () => {
    it('should log registration', () => {
      const tool = new AgnoTool();
      registry.registerTool(tool);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered tool')
      );
    });

    it('should log clear', () => {
      registry.clear();
      expect(logger.debug).toHaveBeenCalledWith('Registry cleared');
    });
  });
});
