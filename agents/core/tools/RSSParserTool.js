/**
 * RSSParserTool - Extract URLs from RSS feeds
 *
 * Discovers and parses RSS feeds to find article URLs
 *
 * Input: { domain, rssUrls, maxArticles }
 * Output: Array of { url, title, source, pubDate }
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class RSSParserTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'RSSParser';
    this.description = 'Parse RSS feeds to find article URLs';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Target domain (e.g., "example.com")'
        },
        rssUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known RSS feed URLs'
        },
        maxArticles: {
          type: 'number',
          default: 50,
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
          pubDate: { type: 'string' }
        },
        required: ['url', 'source']
      }
    };
  }

  /**
   * Execute RSS parsing
   * @param {Object} input - Input with domain and RSS configuration
   * @returns {Promise<Array>} Array of discovered URLs
   */
  async execute(input) {
    try {
      await this.onBefore(input);

      const { domain, rssUrls = [], maxArticles = 50 } = input;
      const urls = [];

      // Try common RSS locations
      const feedUrls = [
        `https://${domain}/feed`,
        `https://${domain}/feed/`,
        `https://${domain}/rss.xml`,
        `https://${domain}/rss`,
        ...rssUrls
      ];

      this.logger?.info(`[${this.name}] Trying ${feedUrls.length} RSS feed locations`);

      for (const feedUrl of feedUrls) {
        if (urls.length >= maxArticles) break;

        try {
          const feedArticles = await this.parseFeedUrl(feedUrl, maxArticles - urls.length);
          if (feedArticles && feedArticles.length > 0) {
            urls.push(...feedArticles);
            this.logger?.info(`[${this.name}] Found ${feedArticles.length} articles from ${feedUrl}`);
          }
        } catch (e) {
          this.logger?.debug(`[${this.name}] Feed not found at ${feedUrl}: ${e.message}`);
        }
      }

      this.logger?.info(`[${this.name}] Parsed ${urls.length} URLs from RSS feeds`);

      await this.onAfter(urls);
      return urls;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }

  /**
   * Parse a single RSS feed URL
   * @param {string} feedUrl - Feed URL
   * @param {number} limit - Maximum articles to parse
   * @returns {Promise<Array>} Array of parsed articles
   */
  async parseFeedUrl(feedUrl, limit) {
    const response = await fetch(feedUrl, { timeout: 10000 });
    if (!response.ok) {
      throw new Error(`Feed request failed: ${response.status}`);
    }

    const xml = await response.text();
    const urls = [];

    try {
      // Try RSS 2.0 format (link tag)
      let linkRegex = /<link>(.*?)<\/link>/g;
      let match;

      while ((match = linkRegex.exec(xml)) !== null && urls.length < limit) {
        const url = match[1]?.trim();
        if (url && this.isValidUrl(url)) {
          urls.push({
            url,
            source: 'rss',
            title: this.extractTitle(xml, url)
          });
        }
      }

      // Try Atom format (link href)
      if (urls.length < limit) {
        const atomRegex = /<link[^>]*href=["']([^"']+)["']/g;
        while ((match = atomRegex.exec(xml)) !== null && urls.length < limit) {
          const url = match[1]?.trim();
          if (url && this.isValidUrl(url) && !urls.some(u => u.url === url)) {
            urls.push({
              url,
              source: 'rss',
              title: this.extractTitle(xml, url)
            });
          }
        }
      }

    } catch (e) {
      this.logger?.warn(`[${this.name}] Error parsing RSS XML: ${e.message}`);
    }

    return urls;
  }

  /**
   * Check if URL is valid
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract title for a URL from RSS
   * @param {string} xml - RSS XML
   * @param {string} url - URL to find title for
   * @returns {string|null} Title or null
   */
  extractTitle(xml, url) {
    try {
      const escapedUrl = this.escapeRegex(url);
      const itemPattern = new RegExp(
        `<(item|entry)>\\s*([\\s\\S]*?)<link[^>]*>?${escapedUrl}`,
        'i'
      );
      const itemMatch = xml.match(itemPattern);

      if (itemMatch) {
        const titleMatch = itemMatch[0].match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
          return titleMatch[1];
        }
      }
    } catch (e) {
      // Ignore errors in title extraction
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

module.exports = RSSParserTool;
