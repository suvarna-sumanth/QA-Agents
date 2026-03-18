/**
 * DetectionSubAgent - Deterministic sub-agent for video player detection
 *
 * Responsibility: For a given article URL, detect all video players present using:
 * - DOM scanning
 * - HTML5 player detection
 * - HLS stream detection
 * - YouTube embed detection
 * - Vimeo embed detection
 * - Custom player detection
 *
 * Execution: Parallel tool invocation with result merging
 * Input: { url, browser, articleTitle }
 * Output: { phase, url, playerCount, players, timestamp }
 *
 * @extends AgnoSubAgent
 */

const { AgnoSubAgent } = require('../base');
const {
  DOMScannerTool,
  HTML5PlayerDetectorTool,
  HLSPlayerDetectorTool,
  YouTubeDetectorTool,
  VimeoDetectorTool,
  CustomPlayerDetectorTool
} = require('../tools/index');

class DetectionSubAgent extends AgnoSubAgent {
  /**
   * Initialize detection sub-agent with required tools
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.browser - Browser pool instance
   */
  constructor(config = {}) {
    super(config);
    this.name = 'DetectionSubAgent';
    this.description = 'Detect video players on a given article URL';

    // Initialize tools
    this.tools = [
      new DOMScannerTool(config),
      new HTML5PlayerDetectorTool(config),
      new HLSPlayerDetectorTool(config),
      new YouTubeDetectorTool(config),
      new VimeoDetectorTool(config),
      new CustomPlayerDetectorTool(config)
    ];
  }

  /**
   * Input schema for detection phase
   * @type {Object}
   */
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Article URL to scan for players'
        },
        browser: {
          type: 'object',
          description: 'Browser instance reference'
        },
        articleTitle: {
          type: 'string',
          description: 'Article title (optional, for logging)'
        },
        timeout: {
          type: 'number',
          default: 30000,
          description: 'Page load timeout in ms'
        }
      },
      required: ['url', 'browser']
    };
  }

  /**
   * Output schema for detection phase
   * @type {Object}
   */
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        phase: {
          enum: ['detection'],
          description: 'Phase identifier'
        },
        url: {
          type: 'string',
          description: 'Article URL scanned'
        },
        playerCount: {
          type: 'number',
          description: 'Total players detected'
        },
        players: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { enum: ['html5', 'hls', 'youtube', 'vimeo', 'custom'] },
              selector: { type: 'string' },
              sources: { type: 'array' },
              metadata: { type: 'object' }
            },
            required: ['id', 'type', 'selector']
          },
          description: 'List of detected players'
        },
        timestamp: {
          type: 'number',
          description: 'Execution timestamp'
        }
      },
      required: ['phase', 'url', 'players']
    };
  }

  /**
   * Execute detection phase
   *
   * Process:
   * 1. Navigate to URL
   * 2. Run all detector tools in parallel
   * 3. Merge results
   * 4. Deduplicate players
   * 5. Return structured result
   *
   * @param {Object} input - Detection input
   * @param {string} input.url - Article URL
   * @param {Object} input.browser - Browser instance
   * @param {string} input.articleTitle - Article title (optional)
   * @param {number} input.timeout - Page load timeout
   * @returns {Promise<Object>} Detection result
   */
  async execute(input) {
    let page;
    try {
      // Validate input
      this.validate(input);

      const { url, browser, articleTitle, timeout = 30000 } = input;
      const players = [];

      this.logger?.info(`[${this.name}] Starting detection for ${url}`);

      // Create new page
      page = await browser.newPage();

      // Navigate to URL
      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout
        });
      } catch (e) {
        this.logger?.warn(`[${this.name}] Navigation timeout for ${url}: ${e.message}`);
        // Continue anyway, some content may still be detected
      }

      // Run all detectors in parallel
      const detectionPromises = [
        this.tools[1].execute({ page }).catch(e => {
          this.logger?.debug(`[${this.name}] HTML5 detection failed: ${e.message}`);
          return [];
        }),
        this.tools[2].execute({ page }).catch(e => {
          this.logger?.debug(`[${this.name}] HLS detection failed: ${e.message}`);
          return [];
        }),
        this.tools[3].execute({ page }).catch(e => {
          this.logger?.debug(`[${this.name}] YouTube detection failed: ${e.message}`);
          return [];
        }),
        this.tools[4].execute({ page }).catch(e => {
          this.logger?.debug(`[${this.name}] Vimeo detection failed: ${e.message}`);
          return [];
        }),
        this.tools[5].execute({ page }).catch(e => {
          this.logger?.debug(`[${this.name}] Custom player detection failed: ${e.message}`);
          return [];
        })
      ];

      const results = await Promise.all(detectionPromises);
      for (const result of results) {
        if (result && Array.isArray(result)) {
          players.push(...result);
        }
      }

      // Deduplicate players by ID
      const uniquePlayers = this.deduplicatePlayers(players);

      const result = {
        phase: 'detection',
        url,
        playerCount: uniquePlayers.length,
        players: uniquePlayers,
        timestamp: Date.now()
      };

      // Validate output
      this.validateOutput(result);

      this.logger?.info(`[${this.name}] Detection complete: ${result.playerCount} players found`);
      return result;

    } catch (error) {
      this.logger?.error(`[${this.name}] Execution failed: ${error.message}`);
      throw error;
    } finally {
      // Clean up page
      if (page) {
        try {
          await page.close();
        } catch (e) {
          this.logger?.debug(`[${this.name}] Failed to close page: ${e.message}`);
        }
      }
    }
  }

  /**
   * Deduplicate players by ID
   * @param {Array} players - Players to deduplicate
   * @returns {Array} Deduplicated players
   */
  deduplicatePlayers(players) {
    const seen = new Set();
    return players.filter(player => {
      if (!player || !player.id) return false;
      if (seen.has(player.id)) return false;
      seen.add(player.id);
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

module.exports = DetectionSubAgent;
