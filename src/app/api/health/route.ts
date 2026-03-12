/**
 * GET /api/health
 * Health check endpoint
 */

export async function GET() {
  return Response.json(
    {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    { status: 200 }
  );
}
