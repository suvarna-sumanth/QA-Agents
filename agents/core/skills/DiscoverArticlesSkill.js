import { Skill } from './Skill.js';
import { INSTAREAD_USER_AGENT } from '../../shivani/src/config.js';
import { launchForUrl, detectProtection, applyStealthScripts } from '../../shivani/src/browser.js';
import { dismissPopups, bypassChallenge } from '../../shivani/src/bypass.js';
import { bypassCloudflareIfNeeded } from '../../shivani/src/cloudflare-browser-bypass.js';
import { getCfClearanceCookie, getCfClearanceWithCurl } from '../../shivani/src/cloudflare-http.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

const rootEnv = path.resolve(process.cwd(), '.env');
dotenv.config({ path: rootEnv });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'MISSING_KEY'
});

const FETCH_TIMEOUT = 8000;

export class DiscoverArticlesSkill extends Skill {
  constructor() {
    super(
      'discover_articles',
      'Discover latest article URLs from a given domain using sitemap, RSS, or homepage crawl.',
      {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'The publisher domain (e.g. "https://example.com")' },
          maxArticles: { type: 'number', description: 'Maximum number of article URLs to return', default: 10 }
        },
        required: ['domain']
      },
      {
        type: 'object',
        properties: {
          urls: { type: 'array', items: { type: 'string' } }
        }
      }
    );
  }

  async execute(input, context) {
    let { domain, maxArticles = 10 } = input;

    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = 'https://' + domain;
    }
    const baseUrl = new URL(domain);

    const origins = [baseUrl.origin];
    if (baseUrl.hostname.startsWith('www.')) {
      origins.push(baseUrl.origin.replace('://www.', '://'));
    } else {
      origins.push(baseUrl.origin.replace('://', '://www.'));
    }

    console.log('[DiscoverArticlesSkill] Phase 1: Trying sitemap + RSS in parallel...');
    
    const allResults = await Promise.all(
      origins.flatMap(origin => [
        this.discoverFromSitemap(origin, maxArticles * 2).catch(() => []),
        this.discoverFromRSS(origin, maxArticles * 2).catch(() => []),
      ])
    );

    const sitemapUrls = allResults[0].length > 0 ? allResults[0] : allResults[2] || [];
    const rssUrls = allResults[1].length > 0 ? allResults[1] : allResults[3] || [];

    let urls = sitemapUrls.length > 0 ? sitemapUrls : rssUrls;

    if (urls.length > 0) {
      console.log(`[DiscoverArticlesSkill] Found ${urls.length} URLs from ${sitemapUrls.length > 0 ? 'sitemap' : 'RSS'}`);
      const linkObjs = urls.map(url => ({ url, text: new URL(url).pathname }));
      console.log(`[DiscoverArticlesSkill] Validating ${urls.length} URLs with LLM...`);
      urls = await this.filterArticlesWithLLM(linkObjs, maxArticles);
    } else {
      console.log('[DiscoverArticlesSkill] Phase 2: No sitemap/RSS found, crawling homepage...');
      urls = await this.discoverFromHomepage(domain, baseUrl, maxArticles);
    }

    const out = Array.isArray(urls) ? { urls } : urls;
    const count = out?.urls?.length ?? 0;
    console.log(`[DiscoverArticlesSkill] Final result: ${count} articles discovered`);
    return out;
  }

  async fetchText(url, timeoutMs = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': INSTAREAD_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async discoverFromSitemap(origin, maxArticles) {
    const sitemapPaths = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemap-news.xml',
      '/news-sitemap.xml',
      '/post-sitemap.xml',
      '/sitemap-1.xml',
    ];

    const results = await Promise.all(
      sitemapPaths.map(async (sitemapPath) => {
        const url = origin + sitemapPath;
        console.log(`  [Sitemap] Trying ${url}`);
        const xml = await this.fetchText(url);
        if (!xml) return [];

        if (xml.includes('<sitemapindex')) {
          const subUrls = this.extractXmlTags(xml, 'loc').slice(0, 3);
          const subResults = await Promise.all(
            subUrls.map(async (subUrl) => {
              console.log(`  [Sitemap] Following sub-sitemap: ${subUrl}`);
              const subXml = await this.fetchText(subUrl);
              if (!subXml) return [];
              return this.extractXmlTags(subXml, 'loc').filter((u) => this.isArticleUrl(u, origin));
            })
          );
          return subResults.flat();
        }

        return this.extractXmlTags(xml, 'loc').filter((u) => this.isArticleUrl(u, origin));
      })
    );

    for (const articleUrls of results) {
      if (articleUrls.length > 0) {
        return articleUrls.slice(-maxArticles).reverse();
      }
    }

    return [];
  }

  async discoverFromRSS(origin, maxArticles) {
    const feedPaths = [
      '/feed',
      '/rss',
      '/feed/rss',
      '/rss.xml',
      '/atom.xml',
      '/feed.xml',
      '/index.xml',
    ];

    const results = await Promise.all(
      feedPaths.map(async (feedPath) => {
        const url = origin + feedPath;
        console.log(`  [RSS] Trying ${url}`);
        const xml = await this.fetchText(url);
        if (!xml) return [];

        let urls = this.extractXmlTags(xml, 'link')
          .filter((u) => u.startsWith('http') && this.isArticleUrl(u, origin));

        if (urls.length === 0) {
          urls = this.extractXmlTags(xml, 'guid')
            .filter((u) => u.startsWith('http') && this.isArticleUrl(u, origin));
        }

        return urls;
      })
    );

    for (const urls of results) {
      if (urls.length > 0) {
        return urls.slice(0, maxArticles);
      }
    }

    return [];
  }

  async discoverFromHomepage(domain, baseUrl, maxArticles) {
    let cfResult = null;
    try {
      console.log(`[Discovery] Attempting HTTP-level Cloudflare bypass...`);
      cfResult = await getCfClearanceCookie(domain);
      if (cfResult && cfResult.success) {
        console.log(`[Discovery] ✓ HTTP bypass succeeded`);
      } else {
        console.log(`[Discovery] HTTP bypass inconclusive, falling back to browser...`);
      }
    } catch (err) {
      console.log(`[Discovery] HTTP bypass error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const protection = await detectProtection(domain);

    // Cloudflare: run discovery in a standalone process (same as test-cloudflare-articles.js). Use internal API so path is not in the skill bundle (avoids Turbopack resolving it).
    if (protection === 'cloudflare') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://127.0.0.1:9002';
      const apiUrl = `${String(baseUrl).replace(/\/$/, '')}/api/internal/cloudflare-discovery`;
      console.log('[Discovery] Running Cloudflare discovery via standalone process (same as test script)...');
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.links && data.links.length > 0) {
          console.log(`[Discovery] Standalone process returned ${data.links.length} links`);
          const urls = await this.filterArticlesWithLLM(data.links, maxArticles);
          return { urls, discoveryCookies: data.cookies || [] };
        }
        if (data.error) {
          console.warn(`[Discovery] Standalone script error: ${data.error}`);
        }
      } catch (e) {
        console.warn('[Discovery] Standalone discovery request failed:', e?.message || e);
      }
      console.log('[Discovery] Falling back to in-process Cloudflare discovery...');
    }

    const { browser, cleanup } = await launchForUrl(domain);

    try {
      let context, page;
      if (protection === 'townnews') {
        context = await browser.newContext({ userAgent: INSTAREAD_USER_AGENT });
        page = await context.newPage();
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
        await applyStealthScripts(context);
        await page.setViewportSize({ width: 1280, height: 720 });
        console.log(`[Discovery] Loading homepage: ${domain} (protection: ${protection})`);
        await page.goto(domain, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      } else {
        context = browser.contexts()[0] || await browser.newContext({ userAgent: INSTAREAD_USER_AGENT });
        await applyStealthScripts(context);
        page = context.pages()[0] || await context.newPage();
        await page.setViewportSize({ width: 1280, height: 720 });
        console.log(`[Discovery] Loading homepage: ${domain} (protection: ${protection})`);
        await page.goto(domain, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      }

      let bypassSuccess = false;
      if (protection === 'cloudflare') {
        bypassSuccess = await bypassCloudflareIfNeeded(page, 90000);
      } else if (protection === 'townnews') {
        bypassSuccess = await bypassChallenge(page, 3);
      } else {
        bypassSuccess = await bypassChallenge(page, 2);
      }
      
      if (!bypassSuccess) {
        console.log('[Discovery] ⚠️ Challenge bypass failed or timed out');
      } else {
        console.log('[Discovery] ✓ Successfully bypassed challenge or no challenge present');
      }
      
      await page.waitForTimeout(3000);
      await page.waitForTimeout(3000);

      try {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await page.waitForTimeout(2000);
      } catch (e) {}

      const linkData = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
          .map((a) => {
            try {
              const href = a.getAttribute('href');
              if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
              const url = new URL(href, window.location.href);
              const text = a.innerText?.trim().slice(0, 200) || url.pathname;
              return { url: url.href, text, pathname: url.pathname, hostname: url.hostname };
            } catch {
              return null;
            }
          })
          .filter(item => item !== null);
      }).catch(() => []);

      const internalLinks = linkData.filter(l => {
        const sameHost = l.hostname === baseUrl.hostname || 
                         l.hostname.replace('www.', '') === baseUrl.hostname.replace('www.', '');
        return sameHost;
      });

      const uniqueLinks = [...new Map(internalLinks.map((l) => [l.url, l])).values()]
        .filter(l => l.pathname !== '/' && l.pathname !== '');

      if (uniqueLinks.length === 0) {
        return [];
      }

      console.log(`[Discovery] Sending ${uniqueLinks.length} links to LLM...`);
      return await this.filterArticlesWithLLM(uniqueLinks, maxArticles);
    } catch (err) {
      console.warn(`[Discovery] Error: ${err.message}`);
      return [];
    } finally {
      await cleanup();
    }
  }

  async filterArticlesWithLLM(links, maxArticles) {
    try {
      if (links.length === 0) return [];

      const cappedLinks = links.slice(0, 80);
      const linkList = cappedLinks.map((l) => `${l.url}  |  "${l.text}"`).join('\n');

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You are a web scraping assistant. Given a list of URLs and their link text, identify which ones are article/post/content pages.

ARTICLE indicators:
- URLs with readable slugs (descriptive words, hyphens)
- URLs with dates (/2026/03/ or /2026-03- patterns)
- URLs that look like: /news/, /blog/, /article/, /post/, /story/
- Link text that describes content or is substantial
- URLs deeper than just /category/

NON-ARTICLE pages to exclude:
- Navigation: /home, /about, /contact, /privacy, /terms, /search
- Utility: /login, /register, /subscribe, /rss, /feed, /sitemap
- Category aggregations: /tag/, /category/, /author/, /page/
- Short utility paths: /ads/, /api/, /admin/

Return ONLY a JSON array of article URLs, most recent first. Return at most ${maxArticles} URLs.

Response format (no markdown code fences):
["https://example.com/article-1", "https://example.com/article-2"]`,
          },
          {
            role: 'user',
            content: `Identify article URLs from this list:\n\n${linkList}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        return this.heuristicFilter(links, maxArticles);
      }

      const jsonStr = content.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, maxArticles);
      }
    } catch (err) {
      console.warn(`[Discovery] LLM filtering failed: ${err.message}, falling back to heuristic`);
    }

    return this.heuristicFilter(links, maxArticles);
  }

  heuristicFilter(links, maxArticles) {
    return links
      .map((l) => l.url)
      .filter((url) => {
        const p = new URL(url).pathname.toLowerCase();
        const skip = ['/sponsor', '/subscribe', '/about', '/contact', '/privacy', '/terms', '/tag/', '/category/', '/author/', '/page/', '/search', '/login', '/register', '/account', '/feed', '/rss', '/sitemap', '/robots'];
        if (skip.some((s) => p.includes(s))) return false;
        const segments = p.split('/').filter(Boolean);
        return segments.length >= 2;
      })
      .slice(0, maxArticles);
  }

  extractXmlTags(xml, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'gi');
    const results = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      results.push(match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    }
    return results;
  }

  isArticleUrl(url, origin) {
    try {
      const u = new URL(url);
      const originHost = new URL(origin).hostname;
      const urlHost = u.hostname;
      const sameHost = urlHost === originHost ||
                       urlHost === 'www.' + originHost ||
                       originHost === 'www.' + urlHost;
      if (!sameHost) return false;
      const path = u.pathname;
      if (path === '/' || path === '') return false;
      const skipPatterns = [
        '/tag/', '/category/', '/author/', '/page/',
        '/search', '/login', '/register', '/account',
        '/privacy', '/terms', '/about', '/contact',
        '.xml', '.json', '.js', '.css', '.png', '.jpg',
      ];
      if (skipPatterns.some((p) => path.toLowerCase().includes(p))) return false;
      const segments = path.split('/').filter(Boolean);
      if (segments.length === 0) return false;
      if (segments.length === 1) {
        return segments[0].includes('-') || segments[0].length >= 4;
      }
      return true;
    } catch {
      return false;
    }
  }
}
