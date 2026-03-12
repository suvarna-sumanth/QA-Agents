/**
 * Cloudflare HTTP Bypass Module
 * 
 * Uses HTTP requests with realistic TLS fingerprinting to bypass Cloudflare
 * without needing a browser. This is more reliable than automation in headless mode.
 * 
 * This module attempts to get a cf_clearance cookie that can then be used in Playwright.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { INSTAREAD_USER_AGENT } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_BIN_DIR = join(__dirname, '../../..', 'bin');

/**
 * Try to get cf_clearance cookie using curl with TLS impersonation.
 * This is more effective than browser automation for Cloudflare.
 * 
 * @param {string} url - Target URL
 * @returns {Promise<Object>} Object with { cookies: string[], headers: Object, success: boolean }
 */
export async function getCfClearanceCookie(url) {
  const curlPath = await findCurlImpersonate();
  
  if (curlPath) {
    return await getCfClearanceWithCurlImpersonate(url, curlPath);
  } else {
    console.log('[Cloudflare-HTTP] curl-impersonate not available, skipping HTTP bypass');
    return { cookies: [], headers: {}, success: false };
  }
}

/**
 * Find curl-impersonate binary in project bin or system PATH
 */
async function findCurlImpersonate() {
  // Check project bin directory first
  const projectCurlPath = join(PROJECT_BIN_DIR, 'curl_chrome116');
  if (existsSync(projectCurlPath)) {
    console.log('[Cloudflare-HTTP] Using local curl-impersonate from project bin');
    return projectCurlPath;
  }
  
  // Try other Chrome versions in project bin
  for (const version of ['curl_chrome110', 'curl_chrome104', 'curl_chrome101', 'curl_chrome100']) {
    const curlPath = join(PROJECT_BIN_DIR, version);
    if (existsSync(curlPath)) {
      console.log(`[Cloudflare-HTTP] Using local ${version} from project bin`);
      return curlPath;
    }
  }
  
  // Check system PATH
  return await checkCommand('curl-impersonate') ? 'curl-impersonate' : null;
}

/**
 * Check if a command is available in PATH
 */
function checkCommand(cmd) {
  return new Promise((resolve) => {
    const child = spawn('which', [cmd], { stdio: 'pipe' });
    child.on('close', (code) => resolve(code === 0 ? cmd : null));
  });
}

/**
 * Use curl-impersonate (Chrome TLS fingerprint) to get cf_clearance cookie.
 * Much more reliable than browser automation for Cloudflare.
 */
async function getCfClearanceWithCurlImpersonate(url, curlPath) {
  return new Promise((resolve) => {
    console.log('[Cloudflare-HTTP] Attempting curl-impersonate for Cloudflare bypass...');
    
    const args = [
      '-L', // Follow redirects
      '-i', // Include response headers
      '-H', `User-Agent: ${INSTAREAD_USER_AGENT}`,
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Accept-Encoding: gzip, deflate',
      '-H', 'DNT: 1',
      '--compressed',
      // Note: curl-impersonate uses --connect-timeout and --max-time instead of --timeout
      '--connect-timeout', '10',
      '--max-time', '30',
      url,
    ];

    const curl = spawn(curlPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 35000,
    });

    let output = '';
    let errors = '';

    curl.stdout.on('data', (data) => {
      output += data.toString();
    });

    curl.stderr.on('data', (data) => {
      errors += data.toString();
    });

    curl.on('close', (code) => {
      if (code !== 0) {
        if (errors) {
          console.log(`[Cloudflare-HTTP] curl-impersonate failed (code ${code}): ${errors.substring(0, 200)}`);
        } else {
          console.log(`[Cloudflare-HTTP] curl-impersonate failed (code ${code})`);
        }
        resolve({ cookies: [], headers: {}, success: false });
        return;
      }

      try {
        // Parse response to extract cf_clearance cookie
        const [headerSection] = output.split('\r\n\r\n');
        const headers = {};
        const cookies = [];

        for (const line of headerSection.split('\r\n')) {
          if (line.toLowerCase().startsWith('set-cookie:')) {
            const cookieStr = line.substring('set-cookie:'.length).trim();
            cookies.push(cookieStr);
            
            // Extract cookie name=value for parsing
            const [nameValue] = cookieStr.split(';');
            const [name, value] = nameValue.split('=');
            
            if (name.trim() === 'cf_clearance') {
              console.log('[Cloudflare-HTTP] ✓ Got cf_clearance cookie!');
              resolve({ cookies: [cookieStr], headers, success: true });
              return;
            }
          }
        }

        if (cookies.length > 0) {
          console.log(`[Cloudflare-HTTP] Got ${cookies.length} cookies, but no cf_clearance`);
          resolve({ cookies, headers, success: false });
        } else {
          console.log('[Cloudflare-HTTP] No cookies set, likely passed Turnstile or it\'s not needed');
          resolve({ cookies: [], headers, success: true });
        }
      } catch (err) {
        console.log(`[Cloudflare-HTTP] Error parsing response: ${err.message}`);
        resolve({ cookies: [], headers: {}, success: false });
      }
    });

    curl.on('error', (err) => {
      console.log(`[Cloudflare-HTTP] curl-impersonate error: ${err.message}`);
      resolve({ cookies: [], headers: {}, success: false });
    });
  });
}

/**
 * Alternative: Use curl with custom TLS ciphers to look more like a real browser.
 * Less reliable than curl-impersonate but might be available on more systems.
 */
export async function getCfClearanceWithCurl(url) {
  return new Promise((resolve) => {
    console.log('[Cloudflare-HTTP] Attempting curl with real browser headers...');
    
    const args = [
      '-L', // Follow redirects
      '-i', // Include response headers
      '-H', 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Accept-Encoding: gzip, deflate, br',
      '-H', 'DNT: 1',
      '-H', 'Connection: keep-alive',
      '-H', 'Upgrade-Insecure-Requests: 1',
      '--compressed',
      '--timeout', '30',
      url,
    ];

    const curl = spawn('curl', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 35000,
    });

    let output = '';

    curl.stdout.on('data', (data) => {
      output += data.toString();
    });

    curl.on('close', (code) => {
      if (code !== 0) {
        console.log(`[Cloudflare-HTTP] curl failed (code ${code})`);
        resolve({ cookies: [], headers: {}, success: false });
        return;
      }

      try {
        const cookies = [];
        const [headerSection] = output.split('\r\n\r\n');

        for (const line of headerSection.split('\r\n')) {
          if (line.toLowerCase().startsWith('set-cookie:')) {
            const cookieStr = line.substring('set-cookie:'.length).trim();
            cookies.push(cookieStr);
            
            const [nameValue] = cookieStr.split(';');
            if (nameValue.includes('cf_clearance')) {
              console.log('[Cloudflare-HTTP] ✓ Got cf_clearance cookie!');
              resolve({ cookies: [cookieStr], headers: {}, success: true });
              return;
            }
          }
        }

        // If we got any cookies or content, consider it partial success
        const hasContent = output.length > 10000;
        console.log(`[Cloudflare-HTTP] Request ${hasContent ? 'succeeded' : 'had limited content'}`);
        resolve({ cookies, headers: {}, success: hasContent || cookies.length > 0 });
      } catch (err) {
        console.log(`[Cloudflare-HTTP] Error parsing: ${err.message}`);
        resolve({ cookies: [], headers: {}, success: false });
      }
    });

    curl.on('error', (err) => {
      console.log(`[Cloudflare-HTTP] curl error: ${err.message}`);
      resolve({ cookies: [], headers: {}, success: false });
    });
  });
}
