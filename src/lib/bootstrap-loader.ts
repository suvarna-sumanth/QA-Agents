/**
 * Bootstrap Loader - Server-only module
 * Dynamically imports the agent bootstrap system at runtime.
 * Uses path-based dynamic import to prevent Turbopack from bundling agent code.
 */

import path from 'path';

let cachedBootstrap: any = null;
let cachedCognitiveSystem: any = null;

export async function getBootstrap() {
  if (cachedBootstrap) return cachedBootstrap;

  // Construct the path at runtime so Turbopack cannot statically analyze it
  const bootstrapPath = path.resolve(process.cwd(), 'agents', 'core', 'bootstrap.js');
  cachedBootstrap = await import(/* webpackIgnore: true */ bootstrapPath);
  return cachedBootstrap;
}

export async function bootstrapAgents() {
  const bootstrap = await getBootstrap();
  return bootstrap.bootstrapAgents();
}

export async function getCognitiveSystem() {
  if (cachedCognitiveSystem) return cachedCognitiveSystem;

  // Construct the path at runtime so Webpack cannot statically analyze it
  const indexPath = path.resolve(process.cwd(), 'agents', 'core', 'index.js');
  const mod = await import(/* webpackIgnore: true */ indexPath);
  cachedCognitiveSystem = mod.createCognitiveSystem();
  return cachedCognitiveSystem;
}
