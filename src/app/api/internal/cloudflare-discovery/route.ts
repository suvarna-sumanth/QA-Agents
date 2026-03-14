/**
 * POST /api/internal/cloudflare-discovery
 * Runs the standalone Cloudflare discovery script when CLOUDFLARE_DISCOVERY_SCRIPT env is set
 * (e.g. via npm run dev:cloudflare). No path in source so Turbopack won't try to resolve it.
 */
export const dynamic = 'force-dynamic';

import { spawnSync } from 'child_process';

export async function POST(request: Request) {
  try {
    const { domain } = await request.json();
    if (!domain || typeof domain !== 'string') {
      return Response.json({ error: 'Missing domain', links: [] }, { status: 400 });
    }
    const scriptPath = process.env.CLOUDFLARE_DISCOVERY_SCRIPT;
    if (!scriptPath) {
      return Response.json(
        { error: 'CLOUDFLARE_DISCOVERY_SCRIPT not set. Use npm run dev:cloudflare for standalone discovery.', links: [] },
        { status: 200 }
      );
    }
    const result = spawnSync('node', [scriptPath, domain], {
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    });
    const out = (result.stdout || '').trim();
    if (!out) {
      return Response.json({ error: result.stderr || 'No output', links: [] }, { status: 200 });
    }
    try {
      const data = JSON.parse(out);
      return Response.json({
        links: data.links || [],
        cookies: data.cookies || [],
        error: data.error || null,
      }, { status: 200 });
    } catch {
      return Response.json({ error: 'Invalid JSON from script', links: [] }, { status: 200 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err), links: [] },
      { status: 500 }
    );
  }
}
