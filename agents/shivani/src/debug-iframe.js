import { launchUndetectedBrowser } from './browser.js';
import { dismissPopups } from './bypass.js';

const { browser, cleanup } = await launchUndetectedBrowser();
const context = browser.contexts()[0];
const page = await context.newPage();

await page.goto('https://selfdrivenews.com/zoox-robotaxis-coming-to-uber-in-las-vegas/', { waitUntil: 'domcontentloaded', timeout: 30000 });

for (let i = 0; i < 8; i++) {
  const title = await page.title();
  if (!title.toLowerCase().includes('just a moment')) break;
  await page.waitForTimeout(5000);
}
await page.waitForTimeout(3000);
await dismissPopups(page);

// Access the iframe content
const iframeEl = await page.$('iframe[id="instaread_iframe"]');
if (!iframeEl) { console.log('No iframe found'); await cleanup(); process.exit(1); }

const frame = await iframeEl.contentFrame();
if (!frame) { console.log('Cannot access frame content'); await cleanup(); process.exit(1); }

await frame.waitForTimeout(2000);

// Dump the iframe DOM tree
const info = await frame.evaluate(() => {
  function dumpTree(root, depth = 0) {
    const results = [];
    for (const child of root.children || []) {
      const tag = child.tagName?.toLowerCase() || '?';
      const cls = child.className ? '.' + (typeof child.className === 'string' ? child.className.replace(/\s+/g, '.') : '') : '';
      const attrs = [];
      if (child.id) attrs.push('id=' + child.id);
      if (child.getAttribute?.('aria-label')) attrs.push('aria-label=' + child.getAttribute('aria-label'));
      if (child.getAttribute?.('type')) attrs.push('type=' + child.getAttribute('type'));
      if (child.getAttribute?.('role')) attrs.push('role=' + child.getAttribute('role'));
      if (child.src) attrs.push('src=' + child.src.substring(0, 100));

      const prefix = '  '.repeat(depth);
      let line = prefix + tag + cls;
      if (attrs.length) line += ' [' + attrs.join(', ') + ']';
      results.push(line);

      if (child.shadowRoot) {
        results.push(prefix + '  #shadow-root');
        results.push(...dumpTree(child.shadowRoot, depth + 2));
      }
      if (depth < 8) {
        results.push(...dumpTree(child, depth + 1));
      }
    }
    return results;
  }
  return dumpTree(document.body, 0).join('\n');
});

console.log('=== IFRAME DOM TREE ===');
console.log(info);

// Check for interactive elements
const audioInfo = await frame.evaluate(() => {
  const audios = document.querySelectorAll('audio');
  const buttons = document.querySelectorAll('button');
  const ranges = document.querySelectorAll('input[type="range"]');
  const svgs = document.querySelectorAll('svg');
  const divsWithClick = document.querySelectorAll('[onclick], [class*="play"], [class*="btn"]');
  return {
    audioCount: audios.length,
    buttonCount: buttons.length,
    rangeCount: ranges.length,
    svgCount: svgs.length,
    clickableCount: divsWithClick.length,
    buttons: [...buttons].map(b => ({
      text: b.textContent?.trim()?.substring(0, 50),
      class: b.className,
      ariaLabel: b.getAttribute('aria-label'),
      innerHTML: b.innerHTML.substring(0, 100),
    })),
    clickables: [...divsWithClick].map(d => ({
      tag: d.tagName,
      class: d.className,
      text: d.textContent?.trim()?.substring(0, 50),
    })),
  };
});
console.log('\n=== INTERACTIVE ELEMENTS ===');
console.log(JSON.stringify(audioInfo, null, 2));

await cleanup();
