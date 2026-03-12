/**
 * GET /api/jobs/[id]
 * Retrieve job status and report
 */

import { jobRegistry } from '../route';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = jobRegistry.get(id);

    if (!job) {
      return Response.json(
        {
          success: false,
          error: `Job "${id}" not found`,
        },
        { status: 404 }
      );
    }

    return Response.json(
      {
        success: true,
        job,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[API] GET /api/jobs/:id error:`, error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
