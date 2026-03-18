/**
 * TestingSubAgent - Deterministic sub-agent for video player testing
 *
 * Responsibility: Test if a detected player can play video content using:
 * - Play button clicking
 * - Audio detection
 * - Control testing
 * - Progress detection
 * - Error listening
 * - Screenshot capture
 *
 * Execution: Sequential tool invocation with result accumulation
 * Input: { url, player, browser, timeout }
 * Output: { phase, url, playerId, playerType, testResult, timestamp }
 *
 * @extends AgnoSubAgent
 */

const { AgnoSubAgent } = require('../base');
const {
  PlayButtonClickerTool,
  AudioDetectorTool,
  ControlTesterTool,
  ProgressDetectorTool,
  ErrorListenerTool,
  ScreenshotCapturerTool
} = require('../tools/index');

class TestingSubAgent extends AgnoSubAgent {
  /**
   * Initialize testing sub-agent with required tools
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.browser - Browser pool instance
   */
  constructor(config = {}) {
    super(config);
    this.name = 'TestingSubAgent';
    this.description = 'Test if a video player can play content';

    // Initialize tools
    this.tools = [
      new PlayButtonClickerTool(config),
      new AudioDetectorTool(config),
      new ControlTesterTool(config),
      new ProgressDetectorTool(config),
      new ErrorListenerTool(config),
      new ScreenshotCapturerTool(config)
    ];
  }

  /**
   * Input schema for testing phase
   * @type {Object}
   */
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Article URL containing the player'
        },
        player: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            selector: { type: 'string' },
            sources: { type: 'array' }
          },
          required: ['id', 'type', 'selector'],
          description: 'Player object to test'
        },
        browser: {
          type: 'object',
          description: 'Browser instance reference'
        },
        timeout: {
          type: 'number',
          default: 60000,
          description: 'Test timeout in ms'
        },
        skipScreenshot: {
          type: 'boolean',
          default: false,
          description: 'Skip screenshot capture'
        }
      },
      required: ['url', 'player', 'browser']
    };
  }

  /**
   * Output schema for testing phase
   * @type {Object}
   */
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        phase: {
          enum: ['testing'],
          description: 'Phase identifier'
        },
        url: {
          type: 'string',
          description: 'Article URL tested'
        },
        playerId: {
          type: 'string',
          description: 'Player ID tested'
        },
        playerType: {
          type: 'string',
          description: 'Player type'
        },
        testResult: {
          type: 'object',
          properties: {
            playable: { type: 'boolean' },
            hasAudio: { type: 'boolean' },
            controlsWork: { type: 'boolean' },
            progressDetected: { type: 'boolean' },
            errors: { type: 'array' },
            screenshots: { type: 'array' }
          },
          required: ['playable']
        },
        timestamp: {
          type: 'number',
          description: 'Execution timestamp'
        }
      },
      required: ['phase', 'url', 'playerId', 'testResult']
    };
  }

  /**
   * Execute testing phase
   *
   * Process:
   * 1. Navigate to URL
   * 2. Setup error listener
   * 3. Click play button
   * 4. Wait for playback indicators
   * 5. Test controls (if playable)
   * 6. Detect progress (if playable)
   * 7. Detect audio
   * 8. Capture screenshot
   * 9. Determine overall playability
   * 10. Return results
   *
   * @param {Object} input - Testing input
   * @param {string} input.url - Article URL
   * @param {Object} input.player - Player to test
   * @param {Object} input.browser - Browser instance
   * @param {number} input.timeout - Test timeout
   * @param {boolean} input.skipScreenshot - Skip screenshot
   * @returns {Promise<Object>} Testing result
   */
  async execute(input) {
    let page;
    try {
      // Validate input
      this.validate(input);

      const { url, player, browser, timeout = 60000, skipScreenshot = false } = input;

      const testResult = {
        playable: false,
        hasAudio: false,
        controlsWork: false,
        progressDetected: false,
        errors: [],
        screenshots: []
      };

      this.logger?.info(`[${this.name}] Starting test for player ${player.id} on ${url}`);

      // Create new page
      page = await browser.newPage();

      try {
        // Navigate to URL
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: Math.min(timeout, 30000)
        });

        // Setup error listener
        try {
          const errorResults = await this.tools[4].execute({ page });
          if (errorResults && errorResults.errors) {
            testResult.errors.push(...errorResults.errors);
          }
        } catch (e) {
          this.logger?.debug(`[${this.name}] Error listener setup failed: ${e.message}`);
        }

        // Click play button
        try {
          await this.tools[0].execute({
            page,
            playerSelector: player.selector
          });
          await page.waitForTimeout(2000); // Wait for playback to start
          this.logger?.debug(`[${this.name}] Play button clicked`);
        } catch (e) {
          testResult.errors.push(`Play button click failed: ${e.message}`);
          this.logger?.debug(`[${this.name}] Play button click failed: ${e.message}`);
        }

        // Detect audio
        try {
          testResult.hasAudio = await this.tools[1].execute({ page });
        } catch (e) {
          this.logger?.debug(`[${this.name}] Audio detection failed: ${e.message}`);
        }

        // Test controls
        try {
          testResult.controlsWork = await this.tools[2].execute({
            page,
            playerSelector: player.selector
          });
        } catch (e) {
          this.logger?.debug(`[${this.name}] Control test failed: ${e.message}`);
        }

        // Detect progress
        try {
          testResult.progressDetected = await this.tools[3].execute({
            page,
            playerSelector: player.selector
          });
        } catch (e) {
          this.logger?.debug(`[${this.name}] Progress detection failed: ${e.message}`);
        }

        // Capture screenshot
        if (!skipScreenshot) {
          try {
            const screenshot = await this.tools[5].execute({ page });
            if (screenshot) {
              testResult.screenshots.push(screenshot);
            }
          } catch (e) {
            this.logger?.debug(`[${this.name}] Screenshot capture failed: ${e.message}`);
          }
        }

        // Determine overall playability
        testResult.playable = testResult.hasAudio || testResult.progressDetected;

      } catch (e) {
        testResult.errors.push(e.message);
        this.logger?.error(`[${this.name}] Test execution failed: ${e.message}`);
      } finally {
        try {
          await page.close();
        } catch (e) {
          this.logger?.debug(`[${this.name}] Failed to close page: ${e.message}`);
        }
      }

      const result = {
        phase: 'testing',
        url,
        playerId: player.id,
        playerType: player.type,
        testResult,
        timestamp: Date.now()
      };

      // Validate output
      this.validateOutput(result);

      this.logger?.info(`[${this.name}] Test complete: playable=${result.testResult.playable}`);
      return result;

    } catch (error) {
      this.logger?.error(`[${this.name}] Execution failed: ${error.message}`);
      throw error;
    } finally {
      // Ensure page is closed
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore
        }
      }
    }
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

module.exports = TestingSubAgent;
