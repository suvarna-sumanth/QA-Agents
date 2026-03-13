/**
 * Article Discovery Module
 * Discovers latest article URLs from a domain via sitemap, RSS, or homepage crawl.
 * Uses parallel multi-strategy approach for speed across any site.
 * 
 * Strategy:
 * 1. Try sitemap + RSS (no bot detection needed)
 * 2. If those fail, try HTTP-level Cloudflare bypass with curl-impersonate
 * 3. Fall back to browser automation with Turnstile bypass
 */
import { INSTAREAD_USER_AGENT } from './config.js';
import { launchForUrl, detectProtection } from './browser.js';
import { bypassChallenge } from './bypass.js';
import { bypassCloudflareIfNeeded } from './cloudflare-browser-bypass.js';
import { getCfClearanceCookie, getCfClearanceWithCurl } from './cloudflare-http.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

const rootEnv = path.resolve(import.meta.dirname, '../../../.env');
dotenv.config({ path: rootEnv });
dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'MISSING_KEY'
});

/** Fetch timeout for sitemap/RSS requests (ms) — enough for redirects + CDN */
const FETCH_TIMEOUT = 8000;

/**
 * Discover latest article URLs from a given domain.
 * Runs sitemap + RSS in parallel for speed, falls back to homepage crawl.
 * @param {string} domain - The publisher domain (e.g. "https://example.com")
 * @param {number} maxArticles - Maximum number of article URLs to return
 * @returns {Promise<string[]>} Array of discovered article URLs
 */
export async function discoverArticles(domain, maxArticles = 10) {
  // Normalize domain — ensure it has a protocol
  if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
    domain = 'https://' + domain;
  }
  const baseUrl = new URL(domain);

  // Phase 1: Race sitemap and RSS in parallel (fast path)
  // Try both with and without www to handle any site
  const origins = [baseUrl.origin];
  if (baseUrl.hostname.startsWith('www.')) {
    origins.push(baseUrl.origin.replace('://www.', '://'));
  } else {
    origins.push(baseUrl.origin.replace('://', '://www.'));
  }
  console.log('[Discovery] Phase 1: Trying sitemap + RSS in parallel...');
  const allResults = await Promise.all(
    origins.flatMap(origin => [
      discoverFromSitemap(origin, maxArticles * 2).catch(() => []),
      discoverFromRSS(origin, maxArticles * 2).catch(() => []),
    ])
  );
  // Pick first non-empty result (sitemap preferred over RSS)
  const sitemapUrls = allResults[0].length > 0 ? allResults[0] : allResults[2] || [];
  const rssUrls = allResults[1].length > 0 ? allResults[1] : allResults[3] || [];

  // Prefer sitemap (usually more complete), fallback to RSS
  let urls = sitemapUrls.length > 0 ? sitemapUrls : rssUrls;

  if (urls.length > 0) {
    console.log(`[Discovery] Found ${urls.length} URLs from ${sitemapUrls.length > 0 ? 'sitemap' : 'RSS'}`);
    // Validate with LLM
    const linkObjs = urls.map(url => ({ url, text: new URL(url).pathname }));
    console.log(`[Discovery] Validating ${urls.length} URLs with LLM...`);
    urls = await filterArticlesWithLLM(linkObjs, maxArticles);
  } else {
    // Phase 2: Homepage crawl fallback (slower but works on any site)
    console.log('[Discovery] Phase 2: No sitemap/RSS found, crawling homepage...');
    urls = await discoverFromHomepage(domain, baseUrl, maxArticles);
  }

  console.log(`[Discovery] Final result: ${urls.length} articles discovered`);
  return urls;
}

/**
 * Fetch a URL as text with short timeout.
 */
async function fetchText(url, timeoutMs = FETCH_TIMEOUT) {
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

/**
 * Extract article URLs from sitemap XML.
 * Tries all sitemap paths in parallel for speed.
 */
async function discoverFromSitemap(origin, maxArticles) {
  const sitemapPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-news.xml',
    '/news-sitemap.xml',
    '/post-sitemap.xml',
    '/sitemap-1.xml',
  ];

  // Fire all sitemap requests in parallel
  const results = await Promise.all(
    sitemapPaths.map(async (sitemapPath) => {
      const url = origin + sitemapPath;
      console.log(`  [Sitemap] Trying ${url}`);
      const xml = await fetchText(url);
      if (!xml) return [];

      // Sitemap index — follow up to 3 sub-sitemaps in parallel
      if (xml.includes('<sitemapindex')) {
        const subUrls = extractXmlTags(xml, 'loc').slice(0, 3);
        const subResults = await Promise.all(
          subUrls.map(async (subUrl) => {
            console.log(`  [Sitemap] Following sub-sitemap: ${subUrl}`);
            const subXml = await fetchText(subUrl);
            if (!subXml) return [];
            return extractXmlTags(subXml, 'loc').filter((u) => isArticleUrl(u, origin));
          })
        );
        // Merge all sub-sitemap results
        return subResults.flat();
      }

      // Direct sitemap with <url> entries
      return extractXmlTags(xml, 'loc').filter((u) => isArticleUrl(u, origin));
    })
  );

  // Take the first non-empty result (prefer earlier paths like /sitemap.xml)
  for (const articleUrls of results) {
    if (articleUrls.length > 0) {
      return articleUrls.slice(-maxArticles).reverse();
    }
  }

  return [];
}

/**
 * Extract article URLs from RSS/Atom feeds.
 * Tries all feed paths in parallel for speed.
 */
async function discoverFromRSS(origin, maxArticles) {
  const feedPaths = [
    '/feed',
    '/rss',
    '/feed/rss',
    '/rss.xml',
    '/atom.xml',
    '/feed.xml',
    '/index.xml',
  ];

  // Fire all feed requests in parallel
  const results = await Promise.all(
    feedPaths.map(async (feedPath) => {
      const url = origin + feedPath;
      console.log(`  [RSS] Trying ${url}`);
      const xml = await fetchText(url);
      if (!xml) return [];

      // RSS <link> tags
      let urls = extractXmlTags(xml, 'link')
        .filter((u) => u.startsWith('http') && isArticleUrl(u, origin));

      if (urls.length === 0) {
        // Try <guid> for RSS 2.0
        urls = extractXmlTags(xml, 'guid')
          .filter((u) => u.startsWith('http') && isArticleUrl(u, origin));
      }

      return urls;
    })
  );

  // Take the first non-empty result
  for (const urls of results) {
    if (urls.length > 0) {
      return urls.slice(0, maxArticles);
    }
  }

  return [];
}

/**
 * Fallback: crawl homepage with undetected Chrome to bypass bot protection.
 * Uses LLM to identify real article URLs from page links.
 * 
 * Strategy:
 * 1. Try curl-impersonate (HTTP-level, more reliable for Cloudflare)
 * 2. Fall back to browser automation with Turnstile bypass
 * 3. Extract whatever links we can even if challenges partially fail
 */
async function discoverFromHomepage(domain, baseUrl, maxArticles) {
  // Pre-flight: Try HTTP-level bypass using curl-impersonate
  let cfResult = null;
  try {
    console.log(`[Discovery] Attempting HTTP-level Cloudflare bypass...`);
    cfResult = await getCfClearanceCookie(domain);
    if (cfResult.success) {
      console.log(`[Discovery] ✓ HTTP bypass succeeded`);
    } else {
      console.log(`[Discovery] HTTP bypass inconclusive, falling back to browser...`);
    }
  } catch (err) {
    console.log(`[Discovery] HTTP bypass error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const protection = await detectProtection(domain);
  const { browser, cleanup } = await launchForUrl(domain);

  try {
    let context, page;

    if (protection === 'cloudflare') {
      // CLOUDFLARE: Fresh context with stealth applied BEFORE navigation
      // (matching the proven approach from test-cloudflare-articles.js)
      context = await browser.newContext();
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });
      page = await context.newPage();
      await page.setViewportSize({ width: 1280, height: 720 });
    } else {
      // PERIMETERX / OTHER: Use the default context which already has
      // full stealth scripts (chrome runtime, WebGL, plugins, etc.)
      context = browser.contexts()[0];
      page = context.pages()[0] || await context.newPage();
    }

    console.log(`[Discovery] Loading homepage: ${domain} (protection: ${protection})`);
    await page.goto(domain, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    // Check for Cloudflare challenge and try the proven bypass (allow up to 90 seconds)
    const bypassSuccess = await bypassCloudflareIfNeeded(page, 90000);
    
    if (!bypassSuccess) {
      console.log('[Discovery] ⚠️ Cloudflare challenge bypass failed or timed out');
    } else {
      console.log('[Discovery] ✓ Successfully bypassed challenge or no challenge present');
    }
    
    // Wait for content to fully load after bypass
    await page.waitForTimeout(3000);

    // Wait for any remaining dynamic content
    await page.waitForTimeout(3000);

    // Debug: Get page info before extracting
    const pageDebug = await page.evaluate(() => {
      return {
        title: document.title,
        bodyLength: document.body?.innerText?.length || 0,
        totalAnchors: document.querySelectorAll('a').length,
        anchorsWithHref: document.querySelectorAll('a[href]').length,
      };
    }).catch(() => ({}));
    
    console.log(`[Discovery] Page: title="${pageDebug.title}", bodyLen=${pageDebug.bodyLength}, anchors=${pageDebug.anchorsWithHref}`);

    // Try scrolling to trigger lazy-loading
    try {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await page.waitForTimeout(2000);
    } catch (e) {
      // Ignore scroll errors
    }

    // Extract links - SIMPLE approach
    const linkData = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      console.log('In evaluate: found', anchors.length, 'anchors');
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

    console.log(`[Discovery] Found ${linkData.length} links (after scroll and extract)`);

    // Filter for internal links only
    const internalLinks = linkData.filter(l => {
      const sameHost = l.hostname === baseUrl.hostname || 
                       l.hostname.replace('www.', '') === baseUrl.hostname.replace('www.', '');
      return sameHost;
    });

    console.log(`[Discovery] Found ${internalLinks.length} internal links`);

    // Remove duplicates
    const uniqueLinks = [...new Map(internalLinks.map((l) => [l.url, l])).values()]
      .filter(l => l.pathname !== '/' && l.pathname !== '');

    console.log(`[Discovery] Extracted ${uniqueLinks.length} unique links`);

    if (uniqueLinks.length === 0) {
      console.log(`[Discovery] No links found`);
      return [];
    }

    // Send to LLM
    console.log(`[Discovery] Sending ${uniqueLinks.length} links to LLM...`);
    const articleUrls = await filterArticlesWithLLM(uniqueLinks, maxArticles);
    return articleUrls;
  } catch (err) {
    console.warn(`[Discovery] Error: ${err.message}`);
    return [];
  } finally {
    await cleanup();
  }
}

/**
 * Use OpenAI to identify real article/news URLs from a list of links.
 */
async function filterArticlesWithLLM(links, maxArticles) {
  try {
    if (links.length === 0) {
      console.log('[Discovery] No links to filter');
      return [];
    }

    // Cap input to avoid huge token usage
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
      console.log('[Discovery] LLM returned empty response, using fallback');
      return heuristicFilter(links, maxArticles);
    }

    // Handle markdown code fences in response
    const jsonStr = content.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log(`[Discovery] LLM identified ${parsed.length} articles from ${cappedLinks.length} links`);
      return parsed.slice(0, maxArticles);
    } else {
      console.log(`[Discovery] LLM returned empty array, using fallback heuristic`);
    }
  } catch (err) {
    console.warn(`[Discovery] LLM filtering failed: ${err.message}, falling back to heuristic`);
  }

  return heuristicFilter(links, maxArticles);
}

/**
 * Heuristic fallback for article identification when LLM is unavailable.
 */
function heuristicFilter(links, maxArticles) {
  console.log('[Discovery] Using heuristic fallback for article identification...');
  const fallbackArticles = links
    .map((l) => l.url)
    .filter((url) => {
      const p = new URL(url).pathname.toLowerCase();
      const skip = ['/sponsor', '/subscribe', '/about', '/contact', '/privacy', '/terms', '/tag/', '/category/', '/author/', '/page/', '/search', '/login', '/register', '/account', '/feed', '/rss', '/sitemap', '/robots'];
      if (skip.some((s) => p.includes(s))) return false;
      const segments = p.split('/').filter(Boolean);
      return segments.length >= 2;
    })
    .slice(0, maxArticles);

  console.log(`[Discovery] Fallback heuristic found ${fallbackArticles.length} potential articles`);
  return fallbackArticles;
}

/**
 * Extract text content of XML tags.
 */
function extractXmlTags(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'gi');
  const results = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  }
  return results;
}

/**
 * Check if a URL looks like an article (not a category/tag/static page).
 */
function isArticleUrl(url, origin) {
  try {
    const u = new URL(url);
    // Accept both www and non-www variants of the origin
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
    // Accept 1+ path segments — many sites use flat URLs like /article-slug/
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return false;
    // Single-segment URLs: require slug-like format (contains hyphen or 4+ chars)
    if (segments.length === 1) {
      return segments[0].includes('-') || segments[0].length >= 4;
    }
    return true;
  } catch {
    return false;
  }
}
