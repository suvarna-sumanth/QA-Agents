/**
 * ProxyRotationTool - Rotate proxy IP/zone
 *
 * @extends AgnoTool
 */

const { AgnoTool } = require('../base');

class ProxyRotationTool extends AgnoTool {
  constructor(config = {}) {
    super(config);
    this.name = 'ProxyRotation';
    this.description = 'Rotate proxy IP or zone';
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        proxy: { type: 'object' }
      },
      required: ['proxy']
    };
  }

  get outputSchema() {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        newProxy: { type: 'string' }
      }
    };
  }

  async execute(input) {
    try {
      await this.onBefore(input);
      const { proxy } = input;

      let result = {
        success: false,
        newProxy: null
      };

      try {
        if (proxy && proxy.rotate && typeof proxy.rotate === 'function') {
          const newProxy = await proxy.rotate();
          result.success = true;
          result.newProxy = newProxy;
          this.logger?.info(`[${this.name}] Rotated to new proxy`);
        } else {
          this.logger?.warn(`[${this.name}] Proxy manager does not support rotation`);
        }
      } catch (e) {
        this.logger?.error(`[${this.name}] Rotation failed: ${e.message}`);
      }

      await this.onAfter(result);
      return result;

    } catch (error) {
      await this.onError(error);
      throw error;
    }
  }
}

module.exports = ProxyRotationTool;
