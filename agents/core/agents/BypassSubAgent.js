/**
 * BypassSubAgent - Deterministic sub-agent for WAF bypass handling
 *
 * Responsibility: Handle WAF obstacles when tests fail using:
 * - Cloudflare bypass
 * - PerimeterX bypass
 * - Proxy rotation
 * - User agent rotation
 * - Cookie management
 * - Retry with exponential backoff
 *
 * Execution: Conditional tool invocation based on WAF detection
 * Input: { url, failureReason, browser, proxy, retryCount }
 * Output: { phase, url, wafDetected, bypassResult, timestamp }
 *
 * @extends AgnoSubAgent
 */

const { AgnoSubAgent } = require('../base');
const {
  CloudflareBypassTool,
  PerimeterXBypassTool,
  ProxyRotationTool,
  UserAgentRotationTool,
  CookieManagementTool,
  RetryWithBackoffTool
} = require('../tools/index');

class BypassSubAgent extends AgnoSubAgent {
  /**
   * Initialize bypass sub-agent with required tools
   * @param {Object} config - Configuration object
   * @param {Object} config.logger - Logger instance
   * @param {Object} config.browser - Browser pool instance
   * @param {Object} config.proxy - Proxy manager instance
   */
  constructor(config = {}) {
    super(config);
    this.name = 'BypassSubAgent';
    this.description = 'Bypass WAF obstacles and retry failed operations';

    // Initialize tools
    this.tools = [
      new CloudflareBypassTool(config),
      new PerimeterXBypassTool(config),
      new ProxyRotationTool(config),
      new UserAgentRotationTool(config),
      new CookieManagementTool(config),
      new RetryWithBackoffTool(config)
    ];
  }

  /**
   * Input schema for bypass phase
   * @type {Object}
   */
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL that failed'
        },
        failureReason: {
          type: 'string',
          description: 'Reason for failure (error message or status)'
        },
        browser: {
          type: 'object',
          description: 'Browser instance reference'
        },
        proxy: {
          type: 'object',
          description: 'Proxy manager instance'
        },
        retryCount: {
          type: 'number',
          default: 0,
          description: 'Number of retries attempted'
        },
        maxRetries: {
          type: 'number',
          default: 3,
          description: 'Maximum retry attempts'
        }
      },
      required: ['url', 'failureReason', 'browser', 'proxy']
    };
  }

  /**
   * Output schema for bypass phase
   * @type {Object}
   */
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        phase: {
          enum: ['bypass'],
          description: 'Phase identifier'
        },
        url: {
          type: 'string',
          description: 'URL that was bypassed'
        },
        wafDetected: {
          type: 'string',
          description: 'Type of WAF detected (cloudflare, perimeterx, unknown)'
        },
        bypassResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            method: { type: 'string' },
            attempts: { type: 'number' },
            error: { type: 'string' }
          },
          required: ['success']
        },
        timestamp: {
          type: 'number',
          description: 'Execution timestamp'
        }
      },
      required: ['phase', 'url', 'bypassResult']
    };
  }

  /**
   * Execute bypass phase
   *
   * Process:
   * 1. Identify WAF type from failure reason
   * 2. Apply WAF-specific bypass
   * 3. Fall back to generic bypass if needed
   * 4. Return bypass result
   *
   * @param {Object} input - Bypass input
   * @param {string} input.url - Failed URL
   * @param {string} input.failureReason - Failure reason
   * @param {Object} input.browser - Browser instance
   * @param {Object} input.proxy - Proxy manager
   * @param {number} input.retryCount - Current retry count
   * @param {number} input.maxRetries - Max retries
   * @returns {Promise<Object>} Bypass result
   */
  async execute(input) {
    try {
      // Validate input
      this.validate(input);

      const {
        url,
        failureReason,
        browser,
        proxy,
        retryCount = 0,
        maxRetries = 3
      } = input;

      let bypassResult = {
        success: false,
        method: null,
        attempts: retryCount + 1,
        error: null
      };

      this.logger?.info(`[${this.name}] Starting bypass for ${url} (attempt ${retryCount + 1})`);

      // Identify WAF type
      const wafType = this.identifyWAF(failureReason);
      this.logger?.info(`[${this.name}] WAF detected: ${wafType}`);

      try {
        if (wafType === 'cloudflare') {
          // Try Cloudflare-specific bypass
          try {
            bypassResult = await this.tools[0].execute({
              url,
              browser
            });
            if (!bypassResult.success && retryCount < maxRetries) {
              this.logger?.info(`[${this.name}] Cloudflare bypass failed, trying generic methods`);
              bypassResult = await this.applyGenericBypass(browser, proxy);
            }
          } catch (e) {
            this.logger?.warn(`[${this.name}] Cloudflare bypass threw: ${e.message}`);
            bypassResult.error = e.message;
            bypassResult = await this.applyGenericBypass(browser, proxy);
          }
        } else if (wafType === 'perimeterx') {
          // Try PerimeterX-specific bypass
          try {
            bypassResult = await this.tools[1].execute({
              url,
              browser
            });
            if (!bypassResult.success && retryCount < maxRetries) {
              this.logger?.info(`[${this.name}] PerimeterX bypass failed, trying generic methods`);
              bypassResult = await this.applyGenericBypass(browser, proxy);
            }
          } catch (e) {
            this.logger?.warn(`[${this.name}] PerimeterX bypass threw: ${e.message}`);
            bypassResult.error = e.message;
            bypassResult = await this.applyGenericBypass(browser, proxy);
          }
        } else {
          // Unknown WAF or generic error, try generic bypass
          bypassResult = await this.applyGenericBypass(browser, proxy);
        }

      } catch (e) {
        bypassResult.error = e.message;
        this.logger?.error(`[${this.name}] Bypass failed: ${e.message}`);
      }

      const result = {
        phase: 'bypass',
        url,
        wafDetected: wafType,
        bypassResult,
        timestamp: Date.now()
      };

      // Validate output
      this.validateOutput(result);

      this.logger?.info(`[${this.name}] Bypass complete: success=${result.bypassResult.success}`);
      return result;

    } catch (error) {
      this.logger?.error(`[${this.name}] Execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply generic bypass strategies
   * @param {Object} browser - Browser instance
   * @param {Object} proxy - Proxy manager
   * @returns {Promise<Object>} Bypass result
   */
  async applyGenericBypass(browser, proxy) {
    const result = {
      success: false,
      method: null,
      attempts: 1,
      error: null
    };

    try {
      // Try user agent rotation
      try {
        const uaResult = await this.tools[3].execute({ browser });
        result.method = 'user-agent-rotation';
        result.success = uaResult?.success || false;
        if (result.success) return result;
      } catch (e) {
        this.logger?.debug(`[${this.name}] User agent rotation failed: ${e.message}`);
      }

      // Try proxy rotation
      try {
        const proxyResult = await this.tools[2].execute({ proxy });
        result.method = 'proxy-rotation';
        result.success = proxyResult?.success || false;
        if (result.success) return result;
      } catch (e) {
        this.logger?.debug(`[${this.name}] Proxy rotation failed: ${e.message}`);
      }

      // Try cookie clearing
      try {
        const cookieResult = await this.tools[4].execute({ browser });
        result.method = 'cookie-management';
        result.success = cookieResult?.success || false;
        if (result.success) return result;
      } catch (e) {
        this.logger?.debug(`[${this.name}] Cookie management failed: ${e.message}`);
      }

    } catch (e) {
      result.error = e.message;
    }

    return result;
  }

  /**
   * Identify WAF type from failure reason
   * @param {string} failureReason - Failure reason string
   * @returns {string} WAF type (cloudflare, perimeterx, unknown)
   */
  identifyWAF(failureReason) {
    if (!failureReason) return 'unknown';

    const lowerReason = failureReason.toLowerCase();

    if (lowerReason.includes('cloudflare') ||
        lowerReason.includes('cf-ray') ||
        lowerReason.includes('captcha') ||
        lowerReason.includes('challenge')) {
      return 'cloudflare';
    }

    if (lowerReason.includes('perimeterx') ||
        lowerReason.includes('px') ||
        lowerReason.includes('challenge')) {
      return 'perimeterx';
    }

    return 'unknown';
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

module.exports = BypassSubAgent;
