/**
 * GET /api/health
 * Health check for EC2 / ALB / k8s. Reports app and dependency status.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {
    app: { status: 'up' },
  };

  try {
    const { supabase } = await import('../../../../agents/core/memory/supabase-client.js');
    if (supabase) {
      const { error } = await supabase.from('site_profiles').select('domain').limit(1);
      checks.supabase = error ? { status: 'degraded', detail: error.message } : { status: 'up' };
    } else {
      checks.supabase = { status: 'skipped', detail: 'no Supabase URL' };
    }
  } catch (e) {
    checks.supabase = { status: 'down', detail: (e as Error).message };
  }

  try {
    const { getS3Client } = await import('@/lib/s3Client');
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const bucket = process.env.S3_BUCKET || 'qa-agents-reports-dev';
    await getS3Client().send(new HeadBucketCommand({ Bucket: bucket }));
    checks.s3 = { status: 'up' };
  } catch (e) {
    checks.s3 = { status: 'degraded', detail: (e as Error).message };
  }

  const allUp = Object.values(checks).every((c) => c.status === 'up' || c.status === 'skipped');
  return Response.json(
    {
      success: allUp,
      status: allUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allUp ? 200 : 503 }
  );
}
