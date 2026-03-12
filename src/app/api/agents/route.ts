/**
 * GET /api/agents
 * Returns list of registered agents and their capabilities
 */

import { bootstrapAgents } from '@/lib/bootstrap-loader';

export async function GET() {
  try {
    const { registry } = await bootstrapAgents();
    const agents = registry.getAgentsMetadata();

    return Response.json(
      {
        success: true,
        agents,
        count: agents.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET /api/agents error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
