import { Skill } from './Skill.js';
import path from 'path';

export class TakeScreenshotSkill extends Skill {
  constructor() {
    super(
      'take_screenshot',
      'Take a screenshot of the current browser page. Options available for full page or bounding box.',
      {
        type: 'object',
        properties: {
          screenshotName: { type: 'string', description: 'Name of the screenshot file' },
          screenshotDir: { type: 'string', description: 'Directory to place the screenshot' },
          fullPage: { type: 'boolean', description: 'Whether to take a full page screenshot', default: true },
          selectorConfig: { 
            type: 'string', 
            description: 'CSS Selector to capture just that element. Ignores fullPage if set.' 
          }
        },
        required: ['screenshotName', 'screenshotDir']
      },
      { type: 'object', properties: { filePath: { type: 'string', nullable: true } } }
    );
  }

  async execute(input, context) {
    const { screenshotName, screenshotDir, fullPage = false, selectorConfig = null } = input;

    if (!context || !context.sharedBrowser || !context.sharedBrowser.page) {
      throw new Error('A browser page must be provided in the context.sharedBrowser.page');
    }

    const page = context.sharedBrowser.page;
    const name = screenshotName || input.label || 'screenshot';
    const finalDir = screenshotDir || path.resolve(process.cwd(), 'agents/shivani/screenshots');
    const finalPath = path.join(finalDir, `${name}_${Date.now()}.png`);

    try {
      if (selectorConfig) {
        const el = await page.$(selectorConfig);
        if (el) {
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          const boundingBox = await el.boundingBox();
          if (boundingBox) {
            await page.screenshot({ path: finalPath, clip: boundingBox });
            return { filePath: finalPath };
          }
        }
        console.warn(`[TakeScreenshotSkill] Could not find selector ${selectorConfig}`);
      }

      await page.screenshot({ path: finalPath, fullPage });
      console.log(`[TakeScreenshotSkill] ✓ Screenshot saved: ${finalPath}`);
      return { filePath: finalPath };

    } catch (err) {
      console.warn(`[TakeScreenshotSkill] Failed: ${err.message}`);
      return { filePath: null };
    }
  }
}
