/**
 * Proxy Rotation Manager
 * Rotates through different proxy IPs and zones to avoid detection/blocking
 */

let currentZoneIndex = 0;
let requestCount = 0;

// BrightData proxy zones - rotate through different residential proxy zones
const PROXY_ZONES = [
  'residential_proxy1',   // Primary zone
  'residential_proxy2',   // Secondary zone
  'residential_proxy3',   // Tertiary zone
  'residential_proxy4',   // Quaternary zone
];

// BrightData configuration from environment
const BRIGHTDATA_CUSTOMER = process.env.BRIGHTDATA_CUSTOMER_ID || 'hl_c1f8b73c';
const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE || 'residential_proxy1';
const BRIGHTDATA_PASSWORD = process.env.BRIGHTDATA_PASSWORD || 'vpu76p04mazb';

/**
 * Get rotating proxy URL
 * Cycles through different zones on each request
 * @returns {string} Complete proxy URL
 */
export function getRotatingProxyUrl() {
  const zone = PROXY_ZONES[currentZoneIndex % PROXY_ZONES.length];
  currentZoneIndex++;

  const proxyUsername = `${BRIGHTDATA_CUSTOMER}-zone-${zone}`;
  const proxyUrl = `http://${proxyUsername}:${BRIGHTDATA_PASSWORD}@brd.superproxy.io:33335`;

  console.log(`[ProxyRotation] Using zone: ${zone} (request #${requestCount++})`);
  return proxyUrl;
}

/**
 * Get rotating proxy object for Playwright
 * @returns {object} Proxy config for browser launch
 */
export function getRotatingProxyConfig() {
  const proxyUrl = getRotatingProxyUrl();
  const url = new URL(proxyUrl);

  return {
    server: `http://${url.host}`,
    username: url.username,
    password: url.password,
  };
}

/**
 * Reset rotation counter (e.g., when starting new job)
 */
export function resetRotation() {
  currentZoneIndex = 0;
  console.log('[ProxyRotation] Reset to first zone');
}

/**
 * Force next zone immediately (when current IP is blocked)
 */
export function forceNextZone() {
  currentZoneIndex++;
  const zone = PROXY_ZONES[currentZoneIndex % PROXY_ZONES.length];
  console.log(`[ProxyRotation] Forced next zone: ${zone}`);
  return zone;
}

/**
 * Get proxy statistics
 */
export function getProxyStats() {
  return {
    currentZone: PROXY_ZONES[currentZoneIndex % PROXY_ZONES.length],
    totalRequests: requestCount,
    availableZones: PROXY_ZONES.length,
  };
}

export const ProxyRotation = {
  getRotatingProxyUrl,
  getRotatingProxyConfig,
  resetRotation,
  forceNextZone,
  getProxyStats,
};
