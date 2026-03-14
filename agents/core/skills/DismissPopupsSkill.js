import { Skill } from './Skill.js';
import { dismissPopups } from '../../shivani/src/bypass.js';

export class DismissPopupsSkill extends Skill {
  constructor() {
    super(
      'dismiss_popups',
      'Searches the current page for overlays, cookie banners, newsletters, and ad popups and attempts to close them.',
      {
        type: 'object',
        properties: {}
      },
      { type: 'object', properties: { count: { type: 'number' } } }
    );
  }

  async execute(input, context) {
    if (!context || !context.sharedBrowser || !context.sharedBrowser.page) {
      throw new Error('A browser page must be provided in the context.sharedBrowser.page');
    }

    const page = context.sharedBrowser.page;

    try {
      console.log('[DismissPopupsSkill] Scanning for popups...');
      // dismissPopups currently returns true/false or void, but we can assume it completes
      await dismissPopups(page);
      return { success: true };
    } catch (err) {
      console.warn(`[DismissPopupsSkill] Failed: ${err.message}`);
      return { success: false };
    }
  }
}
