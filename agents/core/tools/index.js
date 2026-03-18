/**
 * Agno Tools Export Index
 *
 * Exports all 24 tools used in the Agno system
 */

// Discovery Tools (3)
const SitemapParserTool = require('./SitemapParserTool');
const RSSParserTool = require('./RSSParserTool');
const WebCrawlerTool = require('./WebCrawlerTool');

// Detection Tools (6)
const DOMScannerTool = require('./DOMScannerTool');
const HTML5PlayerDetectorTool = require('./HTML5PlayerDetectorTool');
const HLSPlayerDetectorTool = require('./HLSPlayerDetectorTool');
const YouTubeDetectorTool = require('./YouTubeDetectorTool');
const VimeoDetectorTool = require('./VimeoDetectorTool');
const CustomPlayerDetectorTool = require('./CustomPlayerDetectorTool');

// Testing Tools (6)
const PlayButtonClickerTool = require('./PlayButtonClickerTool');
const AudioDetectorTool = require('./AudioDetectorTool');
const ControlTesterTool = require('./ControlTesterTool');
const ProgressDetectorTool = require('./ProgressDetectorTool');
const ErrorListenerTool = require('./ErrorListenerTool');
const ScreenshotCapturerTool = require('./ScreenshotCapturerTool');

// Bypass Tools (6)
const CloudflareBypassTool = require('./CloudflareBypassTool');
const PerimeterXBypassTool = require('./PerimeterXBypassTool');
const ProxyRotationTool = require('./ProxyRotationTool');
const UserAgentRotationTool = require('./UserAgentRotationTool');
const CookieManagementTool = require('./CookieManagementTool');
const RetryWithBackoffTool = require('./RetryWithBackoffTool');

// Evidence Tools (3)
const ScreenshotUploaderTool = require('./ScreenshotUploaderTool');
const ManifestCreatorTool = require('./ManifestCreatorTool');
const LogAggregatorTool = require('./LogAggregatorTool');

/**
 * Create all tools
 * @param {Object} config - Configuration to pass to tools
 * @returns {Object} Map of tool name to tool instance
 */
function createAllTools(config = {}) {
  return {
    // Discovery
    sitemapParser: new SitemapParserTool(config),
    rssParser: new RSSParserTool(config),
    webCrawler: new WebCrawlerTool(config),

    // Detection
    domScanner: new DOMScannerTool(config),
    html5PlayerDetector: new HTML5PlayerDetectorTool(config),
    hlsPlayerDetector: new HLSPlayerDetectorTool(config),
    youtubeDetector: new YouTubeDetectorTool(config),
    vimeoDetector: new VimeoDetectorTool(config),
    customPlayerDetector: new CustomPlayerDetectorTool(config),

    // Testing
    playButtonClicker: new PlayButtonClickerTool(config),
    audioDetector: new AudioDetectorTool(config),
    controlTester: new ControlTesterTool(config),
    progressDetector: new ProgressDetectorTool(config),
    errorListener: new ErrorListenerTool(config),
    screenshotCapturer: new ScreenshotCapturerTool(config),

    // Bypass
    cloudflareBypass: new CloudflareBypassTool(config),
    perimeterXBypass: new PerimeterXBypassTool(config),
    proxyRotation: new ProxyRotationTool(config),
    userAgentRotation: new UserAgentRotationTool(config),
    cookieManagement: new CookieManagementTool(config),
    retryWithBackoff: new RetryWithBackoffTool(config),

    // Evidence
    screenshotUploader: new ScreenshotUploaderTool(config),
    manifestCreator: new ManifestCreatorTool(config),
    logAggregator: new LogAggregatorTool(config)
  };
}

module.exports = {
  // Discovery Tools
  SitemapParserTool,
  RSSParserTool,
  WebCrawlerTool,

  // Detection Tools
  DOMScannerTool,
  HTML5PlayerDetectorTool,
  HLSPlayerDetectorTool,
  YouTubeDetectorTool,
  VimeoDetectorTool,
  CustomPlayerDetectorTool,

  // Testing Tools
  PlayButtonClickerTool,
  AudioDetectorTool,
  ControlTesterTool,
  ProgressDetectorTool,
  ErrorListenerTool,
  ScreenshotCapturerTool,

  // Bypass Tools
  CloudflareBypassTool,
  PerimeterXBypassTool,
  ProxyRotationTool,
  UserAgentRotationTool,
  CookieManagementTool,
  RetryWithBackoffTool,

  // Evidence Tools
  ScreenshotUploaderTool,
  ManifestCreatorTool,
  LogAggregatorTool,

  // Factory
  createAllTools
};
