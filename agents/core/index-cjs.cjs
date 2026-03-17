/**
 * CommonJS wrapper for cognitive system bootstrap
 * Provides CJS-compatible exports for Next.js API routes
 */

// Use dynamic import with proper error handling for .mjs files
async function createCognitiveSystemAsync() {
  try {
    console.log('[Bootstrap] Loading cognitive system from .mjs modules');
    const mod = await import('./index.mjs');
    console.log('[Bootstrap] Successfully imported index.mjs');
    const system = mod.createCognitiveSystem();
    console.log('[Bootstrap] Cognitive system created successfully');
    return system;
  } catch (err) {
    console.error('[Bootstrap] Failed to load cognitive system:', err);
    throw err;
  }
}

// Export as promise-returning function for async context
module.exports = {
  createCognitiveSystemAsync
};
