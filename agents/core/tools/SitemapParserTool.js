/**
 * SitemapParserTool - Extract URLs from domain sitemap.xml
 *
 * Parses sitemap.xml files to discover article URLs
 *
 * Input: { domain, maxArticles }
 * Output: Array of { url, title, source, lastmod }
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class SitemapParserTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'SitemapParser';
    this.description = 'Parse sitemap.xml to find article URLs';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Target domain (e.g., "example.com")'
        },
        maxArticles: {
          type: 'number',
          default: 100,
          description: 'Maximum articles to extract'
        }
      },
      required: ['domain']
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
          lastmod: { type: 'string' }
        },
        required: ['url', 'source']
      }
    };
  }

  /**
   * Execute sitemap parsing
   * @param {Object} input - Input with domain and maxArticles
   * @returns {Promise<Array>} Array of discovered URLs
   */
  async execute(input) {
    try {
      await this.onBefore(input);

      const { domain, maxArticles = 100 } = input;
      const sitemapUrl = `https://${domain}/sitemap.xml`;

      let urls = [];

      try {
        const response = await fetch(sitemapUrl, { timeout: 10000 });
        if (!response.ok) {
          this.logger?.warn(`[${this.name}] Sitemap not found for ${domain} (${response.status})`);
          return [];
        }

        const xml = await response.text();
        urls = this.parseSitemapXml(xml, maxArticles);

        this.logger?.info(`[${this.name}] Parsed ${urls.length} URLs from ${domain}/sitemap.xml`);

      } catch (e) {
        this.logger?.warn(`[${this.name}] Failed to fetch sitemap for ${domain}: ${e.message}`);
        return [];
      }

      await this.onAfter(urls);
      return urls;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }

  /**
   * Parse sitemap XML and extract URLs
   * @param {string} xml - Sitemap XML content
   * @param {number} maxArticles - Maximum URLs to extract
   * @returns {Array} Array of parsed URLs
   */
  parseSitemapXml(xml, maxArticles) {
    const urls = [];

    try {
      // Match <loc>URL</loc> patterns
      const locRegex = /<loc>(.*?)<\/loc>/g;
      let match;

      while ((match = locRegex.exec(xml)) !== null && urls.length < maxArticles) {
        const url = match[1]?.trim();
        if (url) {
          urls.push({
            url,
            source: 'sitemap',
            lastmod: this.extractLastMod(xml, url)
          });
        }
      }

      this.logger?.debug(`[${this.name}] Extracted ${urls.length} URLs from sitemap`);

    } catch (e) {
      this.logger?.warn(`[${this.name}] Error parsing sitemap XML: ${e.message}`);
    }

    return urls;
  }

  /**
   * Extract lastmod date for a URL from sitemap
   * @param {string} xml - Sitemap XML
   * @param {string} url - URL to find lastmod for
   * @returns {string|null} Last modification date or null
   */
  extractLastMod(xml, url) {
    try {
      // Find the entry for this URL and get its lastmod
      const urlPattern = new RegExp(
        `<url>\\s*<loc>${this.escapeRegex(url)}</loc>([\\s\\S]*?)<\\/url>`,
        'i'
      );
      const urlMatch = xml.match(urlPattern);

      if (urlMatch) {
        const lastmodMatch = urlMatch[1].match(/<lastmod>(.*?)<\/lastmod>/i);
        if (lastmodMatch) {
          return lastmodMatch[1];
        }
      }
    } catch (e) {
      // Ignore errors in extracting lastmod
    }

    return null;
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = SitemapParserTool;
