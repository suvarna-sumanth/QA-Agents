/**
 * WebCrawlerTool - Crawl website to discover article URLs
 *
 * Recursively crawls a website starting from a URL to discover article URLs
 *
 * Input: { startUrl, depth, maxPages, pageSelector }
 * Output: Array of { url, title, source, depth }
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class WebCrawlerTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'WebCrawler';
    this.description = 'Crawl website to discover article URLs';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        startUrl: {
          type: 'string',
          description: 'Starting URL for crawl'
        },
        depth: {
          type: 'number',
          default: 2,
          description: 'Maximum crawl depth'
        },
        maxPages: {
          type: 'number',
          default: 100,
          description: 'Maximum pages to crawl'
        },
        pageSelector: {
          type: 'string',
          description: 'CSS selector for article links'
        }
      },
      required: ['startUrl']
    };
  }

  get outputSchema() {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          source: { type: 'string' },
          depth: { type: 'number' }
        },
        required: ['url', 'source']
      }
    };
  }

  /**
   * Execute web crawler
   * @param {Object} input - Input with startUrl and configuration
   * @returns {Promise<Array>} Array of discovered URLs
   */
  async execute(input) {
    try {
      await this.onBefore(input);

      const { startUrl, depth = 2, maxPages = 100, pageSelector } = input;
      const urls = new Set();
      const visited = new Set();

      this.logger?.info(`[${this.name}] Starting crawl from ${startUrl}`);

      await this.crawl(startUrl, 0, depth, pageSelector, urls, visited, maxPages);

      const urlArray = Array.from(urls).map(url => ({
        url,
        source: 'crawl'
      }));

      this.logger?.info(`[${this.name}] Crawled ${visited.size} pages, found ${urlArray.length} unique URLs`);

      await this.onAfter(urlArray);
      return urlArray;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }

  /**
   * Recursively crawl URLs
   * @param {string} url - Current URL
   * @param {number} currentDepth - Current depth level
   * @param {number} maxDepth - Maximum depth
   * @param {string} pageSelector - CSS selector for links
   * @param {Set} urlsSet - Set of discovered URLs
   * @param {Set} visited - Set of visited URLs
   * @param {number} maxPages - Maximum pages limit
   */
  async crawl(url, currentDepth, maxDepth, pageSelector, urlsSet, visited, maxPages) {
    // Check limits
    if (visited.size >= maxPages || currentDepth > maxDepth) {
      return;
    }

    if (visited.has(url)) {
      return;
    }

    visited.add(url);

    try {
      const domain = new URL(url).hostname;
      const response = await fetch(url, { timeout: 10000 });

      if (!response.ok) {
        this.logger?.debug(`[${this.name}] HTTP ${response.status} for ${url}`);
        return;
      }

      const html = await response.text();

      // Extract links from page
      const links = this.extractLinks(html, domain, pageSelector);

      for (const link of links) {
        if (visited.size >= maxPages) break;

        urlsSet.add(link);

        // Continue crawling if not at max depth
        if (currentDepth < maxDepth) {
          await this.crawl(link, currentDepth + 1, maxDepth, pageSelector, urlsSet, visited, maxPages);
        }
      }

    } catch (e) {
      this.logger?.debug(`[${this.name}] Failed to crawl ${url}: ${e.message}`);
    }
  }

  /**
   * Extract links from HTML
   * @param {string} html - HTML content
   * @param {string} domain - Domain to filter by
   * @param {string} pageSelector - CSS selector for article links
   * @returns {Array} Array of extracted URLs
   */
  extractLinks(html, domain, pageSelector) {
    const links = [];

    try {
      // If specific selector provided, use it
      if (pageSelector) {
        // Simple regex-based extraction for common selectors
        const regex = new RegExp(`href=["']([^"']+)["']`, 'g');
        let match;

        while ((match = regex.exec(html)) !== null) {
          const href = match[1];
          try {
            const linkUrl = new URL(href, `https://${domain}`);
            if (linkUrl.hostname === domain && this.isLikelyArticle(linkUrl.pathname)) {
              links.push(linkUrl.toString());
            }
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      } else {
        // Default: extract all href attributes
        const regex = /href=["']([^"']+)["']/g;
        let match;

        while ((match = regex.exec(html)) !== null) {
          const href = match[1];
          try {
            const linkUrl = new URL(href, `https://${domain}`);
            if (linkUrl.hostname === domain) {
              links.push(linkUrl.toString());
            }
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      }

    } catch (e) {
      this.logger?.debug(`[${this.name}] Error extracting links: ${e.message}`);
    }

    return [...new Set(links)]; // Deduplicate
  }

  /**
   * Check if URL path looks like an article
   * @param {string} pathname - URL pathname
   * @returns {boolean} True if likely article
   */
  isLikelyArticle(pathname) {
    const articlePatterns = [
      /\/\d{4}\//, // Date-based URLs like /2024/...
      /\/article/, // /article/...
      /\/blog/, // /blog/...
      /\/post/, // /post/...
      /\/news/, // /news/...
      /\/story/, // /story/...
      /[a-z0-9-]+\/[a-z0-9-]+/ // At least two path segments
    ];

    return articlePatterns.some(pattern => pattern.test(pathname));
  }
}

module.exports = WebCrawlerTool;
