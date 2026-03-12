/**
 * Bootstrap Loader - Server-only module
 * Dynamically imports the agent bootstrap system at runtime.
 * Uses path-based dynamic import to prevent Turbopack from bundling agent code.
 */

import path from 'path';

let cached: any = null;

export async function getBootstrap() {
  if (cached) return cached;

  // Construct the path at runtime so Turbopack cannot statically analyze it
  const bootstrapPath = path.resolve(process.cwd(), 'agents', 'core', 'bootstrap.js');
  cached = await import(/* webpackIgnore: true */ bootstrapPath);
  return cached;
}

export async function bootstrapAgents() {
  const bootstrap = await getBootstrap();
  return bootstrap.bootstrapAgents();
}
