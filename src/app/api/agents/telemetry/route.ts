import { NextRequest } from 'next/server';

/**
 * SSE endpoint for real-time agent telemetry.
 * Connects the "Deep Swarm Matrix" to live log events from the cognitive agents.
 * Uses static import path so Next.js/Turbopack can resolve the module.
 */
export async function GET(req: NextRequest) {
  let agentLogger: { subscribe: (cb: (log: any) => void) => () => void };
  try {
    const mod = await import('../../../../../agents/core/Logger.js');
    agentLogger = mod.agentLogger;
  } catch (e) {
    console.error('[Telemetry] Failed to load Logger:', e);
    return new Response(
      JSON.stringify({ error: 'Telemetry unavailable: could not load agent logger' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event so the UI knows the stream is active
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          time: new Date().toLocaleTimeString(),
          msg: 'Connected to event pool. Run a job to see live agent logs.',
          type: 'System',
          jobId: 'telemetry',
          timestamp: Date.now(),
          connected: true,
        })}\n\n`));
      } catch (_) {}

      const unsubscribe = agentLogger.subscribe((log: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(log)}\n\n`));
        } catch (e) {
          unsubscribe();
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      req.signal.onabort = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
