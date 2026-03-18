/**
 * jest.config.cjs - Jest test configuration for ESM
 */

module.exports = {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'agents/core/base/**/*.js',
    'agents/core/memory/**/*.js',
    'agents/core/agents/**/*.js',
    'agents/core/tools/**/*.js',
    '!agents/core/**/index.js',
    '!**/node_modules/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
  ],
  testTimeout: 10000,
  verbose: true,
  bail: false,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
