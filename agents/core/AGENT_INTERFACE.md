# Agent Interface & Architecture

## Overview

The Agent interface provides a reusable contract for QA automation agents. This abstraction decouples execution (CLI, API, queue) from the agent logic, enabling:

- **Multi-agent orchestration**: Run different agents on the same platform
- **API-driven execution**: Submit jobs via REST without CLI
- **Extensibility**: Add new agents by implementing the `Agent` interface
- **Monitoring**: Unified event stream and job tracking across agents

## Agent Interface

```javascript
class Agent {
  // Metadata
  id: string          // unique agent identifier (e.g., 'agent-shivani')
  name: string        // human-readable name
  version: string     // semantic version
  capabilities: string[]  // array of capabilities

  // Core method
  async runJob(job: JobDescriptor): Promise<Report>

  // Metadata retrieval
  getMetadata(): AgentMetadata
}
```

### Job Descriptor

```javascript
{
  jobId: string,                    // Unique job identifier
  type: 'domain' | 'url',          // Job type
  target: string,                   // Domain or URL to test
  config: Object,                   // Agent-specific config overrides
  
  // Event callbacks
  onStepStart(stepName, metadata),
  onStepEnd(stepName, result),
  onScreenshot(stepName, screenshotData),
  onError(error, context)
}
```

### Report (Normalized Output)

```javascript
{
  jobId: string,
  agentId: string,
  type: 'domain' | 'url',
  target: string,
  timestamp: ISO8601,
  overallStatus: 'pass' | 'partial' | 'fail' | 'error',
  
  summary: {
    passed: number,
    partial: number,
    failed: number,
    skipped: number,
    total: number
  },
  
  steps: [
    {
      name: string,
      status: 'pass' | 'fail' | 'skip' | 'partial',
      message: string,
      duration: number (ms),
      screenshot: string (S3 path),
      nestedSteps?: Step[]  // Optional for domain-level jobs
    }
  ],
  
  metadata: {
    agentVersion: string,
    capabilities: string[],
    // Agent-specific fields
  },
  
  duration: number (ms)
}
```

## Agent Registry

In-memory registry for discovering agents and their capabilities:

```javascript
import { getRegistry } from './AgentRegistry.js';

const registry = getRegistry();

// Get specific agent
const agent = registry.getAgent('agent-shivani');

// Query by capability
const testingAgents = registry.getAgentsByCapability('testAudioPlayer');

// List all agents
const allAgents = registry.getAllAgents();
```

## Bootstrap & Initialization

```javascript
import { bootstrapAgents } from './bootstrap.js';

// Initialize all registered agents
const { registry, agents } = bootstrapAgents();
```

## Implementing a New Agent

1. Extend the `Agent` class:

```javascript
import Agent from '../../core/Agent.js';

export class MyAgent extends Agent {
  constructor(config = {}) {
    super({
      id: 'my-agent',
      name: 'My Custom Agent',
      version: '1.0.0',
      capabilities: ['capability1', 'capability2'],
      ...config,
    });
  }

  async runJob(job) {
    const { jobId, type, target, config, onStepStart, onStepEnd } = job;
    
    const report = {
      jobId,
      agentId: this.id,
      type,
      target,
      timestamp: new Date().toISOString(),
      overallStatus: 'pass',
      summary: { passed: 0, partial: 0, failed: 0, skipped: 0, total: 0 },
      steps: [],
      metadata: {},
    };

    try {
      onStepStart('my-step', {});
      // ... perform work ...
      onStepEnd('my-step', { status: 'pass' });
      
      report.steps.push({
        name: 'My Step',
        status: 'pass',
        message: 'Step completed successfully',
        duration: 1000,
      });
      
      return report;
    } catch (err) {
      report.overallStatus = 'error';
      // ... error handling ...
      return report;
    }
  }
}
```

2. Register in `bootstrap.js`:

```javascript
import MyAgent from '../my-agent/src/MyAgent.js';

export function bootstrapAgents() {
  const registry = getRegistry();
  
  const myAgent = new MyAgent();
  registry.register(myAgent);
  
  // ... register other agents ...
}
```

## Event Callbacks

Agents invoke callbacks to provide real-time updates:

```javascript
onStepStart(stepName, metadata)
  // Called when a step begins
  // metadata: { context-specific information }

onStepEnd(stepName, result)
  // Called when a step completes
  // result: { status, duration, message, ... }

onScreenshot(stepName, screenshotData)
  // Called when a screenshot is captured
  // screenshotData: { path/url, timestamp, ... }

onError(error, context)
  // Called on non-fatal errors
  // context: { phase, url, ... }
```

## AgentShivani Implementation

AgentShivani wraps the existing Shivani player QA automation:

```javascript
import AgentShivani from './agents/shivani/src/AgentShivani.js';

const agent = new AgentShivani();

const job = {
  jobId: 'job-001',
  type: 'domain',
  target: 'https://example.com',
  config: { maxArticles: 10 },
};

const report = await agent.runJob(job);
```

### Capabilities

- `detectInstareadPlayer` - Detects `<instaread-player/>` tags
- `testAudioPlayer` - Runs comprehensive player QA tests
- `captureScreenshots` - Captures screenshots during test
- `bypassChallenges` - Bypasses Cloudflare/PerimeterX challenges

## Next Steps

1. **HTTP API** (`add-http-api`):
   - Create Express/Next.js API routes to submit and track jobs
   - Jobs are queued and executed by agents
   - Reports are returned via normalized schema

2. **S3 Storage** (`implement-s3-storage`):
   - Agents save reports and screenshots to S3
   - Storage abstraction module handles S3 interactions
   - Reports queryable by jobId, agentId, timestamp

3. **Dashboard** (`scaffold-dashboard`):
   - Next.js React app displaying job history and results
   - Real-time updates via API
   - Screenshots served from S3

4. **Multi-Agent Support** (`agent-registry`):
   - Add more agents (API testing, performance, etc.)
   - Registry enables dynamic agent discovery
   - Capability-based routing for job assignment
