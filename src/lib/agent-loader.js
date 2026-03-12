/**
 * Agent Loader - Minimal JS file to avoid build-time bundling
 * Loaded only at runtime via dynamic import
 */

let bootstrapCache = null;

async function loadAgentBootstrap() {
  if (bootstrapCache) {
    return bootstrapCache;
  }

  // Import bootstrap.js directly (no .ts wrapper)
  // Use dynamic string construction to prevent build-time analysis by Turbopack
  const path = ['..', 'agents', 'core', 'bootstrap.js'].join('/');
  // Resolve relative to node_modules would fail, so use absolute path construction
  const importPath = '@agents/core/bootstrap.js';
  const module = await import(importPath);
  bootstrapCache = module;
  return module;
}

module.exports = { loadAgentBootstrap };


