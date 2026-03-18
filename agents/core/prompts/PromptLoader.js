/**
 * PromptLoader.js - Dynamic system prompt loader with caching
 *
 * Loads system prompts from markdown files in the prompts directory,
 * supports template substitution, and caches results for performance.
 *
 * @class PromptLoader
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PromptLoader {
  /**
   * Creates a new PromptLoader instance
   *
   * @param {Object} [config] - Configuration options
   * @param {Object} [config.logger] - Logger instance
   * @param {string} [config.promptsDir] - Path to prompts directory
   * @param {boolean} [config.cache] - Enable caching (default: true)
   * @param {number} [config.cacheTTL] - Cache time-to-live in ms (default: 3600000)
   */
  constructor(config = {}) {
    this.logger = config.logger || console;
    this.promptsDir = config.promptsDir || __dirname;
    this.cache = new Map();
    this.cacheEnabled = config.cache !== false;
    this.cacheTTL = config.cacheTTL || 3600000; // 1 hour default
  }

  /**
   * Loads a system prompt from a markdown file
   *
   * @param {string} name - Prompt name (e.g., 'coordinator', 'discovery')
   * @param {Object} [variables] - Template variables for substitution
   * @returns {Promise<string>} Loaded and processed prompt text
   * @throws {Error} if file not found or cannot be read
   *
   * @example
   * const prompt = await loader.load('coordinator', { domain: 'example.com' });
   */
  async load(name, variables = {}) {
    try {
      // Check cache first
      if (this.cacheEnabled) {
        const cached = this.cache.get(name);
        if (cached && !this.isCacheExpired(cached)) {
          this.logger.debug(`Prompt loaded from cache: ${name}`);
          return this.substituteVariables(cached.content, variables);
        }
      }

      // Load from file
      const filePath = path.join(this.promptsDir, `${name}.md`);
      const content = await fs.readFile(filePath, 'utf-8');

      // Cache the result
      if (this.cacheEnabled) {
        this.cache.set(name, {
          content,
          loadedAt: Date.now()
        });
      }

      this.logger.debug(`Prompt loaded from file: ${name}`);

      // Substitute variables and return
      return this.substituteVariables(content, variables);
    } catch (error) {
      this.logger.error(`Failed to load prompt '${name}':`, error);
      throw new Error(`Prompt not found: ${name}`);
    }
  }

  /**
   * Loads multiple prompts at once
   *
   * @param {Array<string>} names - Array of prompt names
   * @param {Object} [variables] - Template variables for all prompts
   * @returns {Promise<Object>} Map of name -> prompt content
   *
   * @example
   * const prompts = await loader.loadAll(['system', 'coordinator', 'discovery']);
   */
  async loadAll(names, variables = {}) {
    try {
      const prompts = {};
      const loadPromises = names.map(async (name) => {
        prompts[name] = await this.load(name, variables);
      });

      await Promise.all(loadPromises);
      return prompts;
    } catch (error) {
      this.logger.error('Failed to load all prompts:', error);
      throw error;
    }
  }

  /**
   * Substitutes variables in prompt text
   *
   * Replaces {{varName}} with corresponding values from variables object.
   * If variable not found, leaves placeholder as-is.
   *
   * @param {string} text - Text with placeholders
   * @param {Object} variables - Variable substitutions
   * @returns {string} Text with variables substituted
   * @private
   */
  substituteVariables(text, variables = {}) {
    return text.replace(/{{(\w+)}}/g, (match, varName) => {
      if (varName in variables) {
        return String(variables[varName]);
      }
      return match;
    });
  }

  /**
   * Checks if a cache entry has expired
   *
   * @param {Object} cacheEntry - Cache entry with loadedAt timestamp
   * @returns {boolean} True if expired
   * @private
   */
  isCacheExpired(cacheEntry) {
    if (!this.cacheEnabled) return true;
    const age = Date.now() - cacheEntry.loadedAt;
    return age > this.cacheTTL;
  }

  /**
   * Clears the prompt cache
   *
   * @param {string} [name] - Optional specific prompt to clear
   *
   * @example
   * loader.clearCache('coordinator'); // Clear one
   * loader.clearCache(); // Clear all
   */
  clearCache(name) {
    if (name) {
      this.cache.delete(name);
      this.logger.debug(`Cache cleared for prompt: ${name}`);
    } else {
      this.cache.clear();
      this.logger.debug('All prompts cleared from cache');
    }
  }

  /**
   * Gets cache statistics
   *
   * @returns {Object} Stats with size, count, etc.
   */
  getCacheStats() {
    const stats = {
      enabled: this.cacheEnabled,
      size: this.cache.size,
      ttl: this.cacheTTL,
      entries: Array.from(this.cache.entries()).map(([name, entry]) => ({
        name,
        age: Date.now() - entry.loadedAt,
        expired: this.isCacheExpired(entry)
      }))
    };
    return stats;
  }

  /**
   * Formats a prompt with metadata headers
   *
   * @param {string} name - Prompt name
   * @param {string} content - Prompt content
   * @param {Object} [metadata] - Additional metadata
   * @returns {Object} Formatted prompt with metadata
   *
   * @example
   * const formatted = loader.format('coordinator', content, { version: '1.0.0' });
   */
  format(name, content, metadata = {}) {
    return {
      name,
      content,
      loadedAt: Date.now(),
      metadata: {
        version: '1.0.0',
        ...metadata
      }
    };
  }

  /**
   * Gets all available prompts in directory
   *
   * @returns {Promise<Array<string>>} List of available prompt names
   */
  async getAvailable() {
    try {
      const files = await fs.readdir(this.promptsDir);
      return files
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => f.replace(/\.md$/, ''));
    } catch (error) {
      this.logger.error('Failed to list available prompts:', error);
      return [];
    }
  }
}

export default PromptLoader;
