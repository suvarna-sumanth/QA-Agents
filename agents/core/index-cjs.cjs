/**
 * CommonJS wrapper for cognitive system bootstrap
 * Provides CJS-compatible exports for Next.js API routes
 */

// Use dynamic import with proper error handling
async function createCognitiveSystemAsync() {
  try {
    const mod = await import('./index.mjs');
    return mod.createCognitiveSystem();
  } catch (err) {
    console.error('[Bootstrap] Failed to load cognitive system:', err);
    throw err;
  }
}

// Export as promise-returning function for async context
module.exports = {
  createCognitiveSystemAsync,
  // For compatibility with existing code expecting sync access
  createCognitiveSystem: () => {
    throw new Error('createCognitiveSystem is async - use createCognitiveSystemAsync instead');
  }
};
