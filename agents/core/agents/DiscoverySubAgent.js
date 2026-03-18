/**
 * DiscoverySubAgent - Deterministic sub-agent for article URL discovery
 *
 * Responsibility: Find all article URLs on a domain using multiple discovery methods:
 * - Sitemap parsing
 * - RSS feed discovery
 * - Web crawling
 *
 * Execution: Sequential tool invocation with result merging
 * Input: { domain, targetUrl, depth, maxArticles }
 * Output: { phase, domain, articleCount, articles, methods }
 *
 * @extends AgnoSubAgent
 */

const { AgnoSubAgent } = require('../base');
const {
  SitemapParserTool,
  RSSParserTool,
  WebCrawlerTool
} = require('../tools/index');

class DiscoverySubAgent extends AgnoSubAgent {
  /**
   * Initialize discovery sub-agent with required tools
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.browser - Browser pool instance
   * @param {Object} config.proxy - Proxy manager instance
   */
  constructor(config = {}) {
    super(config);
    this.name = 'DiscoverySubAgent';
    this.description = 'Discover article URLs on a domain using multiple methods';

    // Initialize tools
    this.tools = [
      new SitemapParserTool(config),
      new RSSParserTool(config),
      new WebCrawlerTool(config)
    ];
  }

  /**
   * Input schema for discovery phase
   * @type {Object}
   */
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Target domain (e.g., "example.com")'
        },
        targetUrl: {
          type: 'string',
          description: 'Starting URL for crawling'
        },
        depth: {
          type: 'number',
          default: 2,
          description: 'Crawl depth limit'
        },
        maxArticles: {
          type: 'number',
          default: 100,
          description: 'Maximum articles to discover'
        }
      },
      required: ['domain', 'targetUrl']
    };
  }

  /**
   * Output schema for discovery phase
   * @type {Object}
   */
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        phase: {
          enum: ['discovery'],
          description: 'Phase identifier'
        },
        domain: {
          type: 'string',
          description: 'Target domain'
        },
        articleCount: {
          type: 'number',
          description: 'Total unique articles discovered'
        },
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
              source: { enum: ['sitemap', 'rss', 'crawl'] },
              lastmod: { type: 'string' }
            },
            required: ['url', 'source']
          },
          description: 'List of discovered articles'
        },
        methods: {
          type: 'array',
          items: { type: 'string' },
          description: 'Discovery methods used'
        }
      },
      required: ['phase', 'domain', 'articles']
    };
  }

  /**
   * Execute discovery phase
   *
   * Process:
   * 1. Try sitemap extraction
   * 2. Try RSS feed discovery
   * 3. Crawl if needed (insufficient results)
   * 4. Deduplicate URLs
   * 5. Return structured result
   *
   * @param {Object} input - Discovery input
   * @param {string} input.domain - Target domain
   * @param {string} input.targetUrl - Starting URL
   * @param {number} input.depth - Crawl depth
   * @param {number} input.maxArticles - Max articles limit
   * @returns {Promise<Object>} Discovery result
   */
  async execute(input) {
    try {
      // Validate input
      this.validate(input);

      const { domain, targetUrl, depth = 2, maxArticles = 100 } = input;
      const articles = [];
      const methodsUsed = [];

      this.logger?.info(`[${this.name}] Starting discovery for ${domain}`);

      // Phase 1: Try sitemap
      try {
        const sitemapArticles = await this.tools[0].execute({
          domain,
          maxArticles
        });
        if (sitemapArticles && sitemapArticles.length > 0) {
          articles.push(...sitemapArticles);
          methodsUsed.push('sitemap');
          this.logger?.info(`[${this.name}] Found ${sitemapArticles.length} articles from sitemap`);
        }
      } catch (e) {
        this.logger?.debug(`[${this.name}] Sitemap parsing failed: ${e.message}`);
      }

      // Phase 2: Try RSS feeds
      try {
        const rssArticles = await this.tools[1].execute({
          domain,
          maxFeed: 50
        });
        if (rssArticles && rssArticles.length > 0) {
          articles.push(...rssArticles);
          methodsUsed.push('rss');
          this.logger?.info(`[${this.name}] Found ${rssArticles.length} articles from RSS`);
        }
      } catch (e) {
        this.logger?.debug(`[${this.name}] RSS parsing failed: ${e.message}`);
      }

      // Phase 3: Crawl if needed
      if (articles.length < 10) {
        try {
          const crawlArticles = await this.tools[2].execute({
            startUrl: targetUrl,
            depth,
            maxPages: maxArticles
          });
          if (crawlArticles && crawlArticles.length > 0) {
            articles.push(...crawlArticles);
            methodsUsed.push('crawl');
            this.logger?.info(`[${this.name}] Found ${crawlArticles.length} articles from crawl`);
          }
        } catch (e) {
          this.logger?.debug(`[${this.name}] Web crawling failed: ${e.message}`);
        }
      }

      // Deduplicate and limit
      const uniqueArticles = this.deduplicateUrls(articles).slice(0, maxArticles);

      const result = {
        phase: 'discovery',
        domain,
        articleCount: uniqueArticles.length,
        articles: uniqueArticles,
        methods: methodsUsed
      };

      // Validate output
      this.validateOutput(result);

      this.logger?.info(`[${this.name}] Discovery complete: ${result.articleCount} unique articles`);
      return result;

    } catch (error) {
      this.logger?.error(`[${this.name}] Execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deduplicate URLs while preserving order
   * @param {Array} articles - Articles to deduplicate
   * @returns {Array} Deduplicated articles
   */
  deduplicateUrls(articles) {
    const seen = new Set();
    return articles.filter(article => {
      if (!article || !article.url) return false;
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    });
  }

  /**
   * Get schema for this agent
   * @returns {Object} Combined input/output schema
   */
  getSchema() {
    return {
      input: this.inputSchema,
      output: this.outputSchema
    };
  }
}

module.exports = DiscoverySubAgent;
