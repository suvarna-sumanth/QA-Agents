# QA-Agents: Project Analysis

> Senior Software Engineer deep-dive into architecture, implementation, and design decisions.

---

### Bot Protection Edge Cases & Stability

1.  **PerimeterX Cross-Origin Iframes**: Some sites (e.g., The Hill) encapsulate the "Press & Hold" challenge in a cross-origin iframe. Standard DOM inspection from the parent page fails. The system now uses iframe bounding-box targeting to bypass these challenges.
2.  **Proxy Interference (407 Errors)**: When using residential proxies, local CDP (Chrome DevTools Protocol) connections can be accidentally intercepted. Hardening via `--proxy-bypass-list` and `NO_PROXY` is required to maintain inter-process communication stability.
3.  **Cognitive Planning vs Swarm**: Small tasks use the Swarm (Shivani), while complex multi-step missions use the Senior Engineer (Cognitive Supervisor) which performs autonomous planning and self-correction.

## What Is This?

**QA-Agents** is an automated QA testing platform that verifies `<instaread-player/>` audio player implementations across publisher websites. It navigates to article pages, detects the player, and runs a full functional test suite (play, pause, seek, speed control) — even when those sites are protected by Cloudflare or PerimeterX bot defenses.

This is **not** a general-purpose web scraper like Firecrawl. The scope is deliberately narrow: automated QA for a single widget (Instaread audio player) embedded across many publisher domains. Firecrawl handles arbitrary content extraction, LLM-ready formatting, sitemap crawling, and structured data output. Our tool does one thing well — it acts as a QA engineer that can test player functionality at scale across protected sites.

### How It Compares to Firecrawl

| Capability | QA-Agents | Firecrawl |
|---|---|---|
| **Purpose** | QA testing of a specific widget | General web scraping/crawling |
| **Output** | Pass/fail test reports with screenshots | Cleaned content (markdown, HTML) |
| **Bot bypass** | Cloudflare + PerimeterX + TownNews + reCAPTCHA v2 (Audio AI) | Basic retry/rate limiting |
| **Browser interaction** | Deep DOM interaction (click play, seek, speed) | Minimal (just content extraction) |
| **Scope** | Instaread audio player only | Any website content |
| **Architecture** | Agent-based swarm with phases | Crawl + extract pipeline |

---

## Architecture Overview

```
┌──────────────────────────────┐
│     QA Dashboard (Next.js)   │
│     /qa-dashboard/*          │
└──────────────┬───────────────┘
               │ REST API
               ▼
┌──────────────────────────────┐
│      API Routes (Next.js)    │
│  POST /api/jobs              │
│  GET  /api/jobs/:id          │
│  GET  /api/reports/*         │
│  GET  /api/screenshots       │
└──────────────┬───────────────┘
               │ Async execution
               ▼
┌──────────────────────────────┐
│   Agent System (Node.js)     │
│  ┌─ AgentRegistry            │
│  ├─ SwarmOrchestrator         │
│  └─ AgentShivani (v2.1.0)    │
│     ├─ DiscoveryAgent        │
│     ├─ DetectionAgent        │
│     └─ FunctionalAgent       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Browser Automation Layer    │
│  ├─ Playwright (Cloudflare / TownNews)   │
│  ├─ rebrowser-playwright (PerimeterX)   │
│  ├─ OpenAI Whisper (reCAPTCHA Audio)   │
│  ├─ curl-impersonate (HTTP)            │
│  └─ Browser Pool Manager               │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     AWS S3 Storage           │
│  ├─ reports/*.json           │
│  └─ screenshots/*.png        │
└──────────────────────────────┘
```

---

## How the Automation Works (End-to-End)

### Phase 1: Job Submission

A user submits a job through the dashboard or API:

```
POST /api/jobs
{
  "agentId": "agent-shivani",
  "type": "domain",         // or "url" for single article
  "target": "https://publisher.com"
}
```

The API creates a `jobId`, stores it in an in-memory registry, and kicks off async execution. The response returns immediately (HTTP 202 pattern).

**Source:** `src/app/api/jobs/route.ts`

### Phase 2: Discovery (Domain Mode Only)

When testing a full domain, the system first discovers article URLs:

1. **Sitemap.xml** — fastest, no bot detection needed. Parses XML for `<loc>` URLs.
2. **RSS feeds** — second attempt, also fast and usually unprotected.
3. **Homepage crawl** — fallback. Launches a browser, bypasses challenges, extracts article links from the page.
4. **LLM filtering** — sends discovered URLs to OpenAI to filter out navigation pages, keeping only real articles.

**Source:** `agents/shivani/src/discover.js`, `agents/shivani/src/DiscoveryAgent.js`

### Phase 3: Detection (Parallel)

For each discovered URL, a detection agent:

1. Launches the appropriate browser (see bypass strategy below)
2. Navigates to the article page
3. Handles any bot challenge (Cloudflare, PerimeterX, TownNews, or reCAPTCHA)
4. Dismisses popups, cookie banners, overlays
5. Searches for `<instaread-player>` in the DOM
6. Takes a screenshot as evidence
7. Returns `{ url, hasPlayer, screenshot }`

Detection runs in parallel across URLs using the SwarmOrchestrator.

**Source:** `agents/shivani/src/detect.js`, `agents/shivani/src/DetectionAgent.js`

### Phase 4: Functional Testing (Parallel)

For every URL where the player was detected, a functional agent runs a 7-step QA suite:

| Step | Test | How It Works |
|------|------|-------------|
| 1 | Page Load | Navigate + bypass challenges + dismiss popups |
| 2 | Player Detection | Find `<instaread-player>` tag, scroll into view |
| 3 | Iframe Access | Get iframe `contentFrame()`, verify internal elements exist |
| 4 | Play | Click `#playCircleBlock`, verify `currentTime` increases |
| 5 | Pause | Click pause, verify `currentTime` stops increasing |
| 6 | Seek | Set `#audioTrackProgress` to 30s, verify position jumps |
| 7 | Speed | Click `#audio_speed`, verify speed change applies |

Each step captures screenshots (full page + player closeup).

**Source:** `agents/shivani/src/test-player.js`, `agents/shivani/src/FunctionalAgent.js`

### Phase 5: Report Generation & Storage

After all tests complete:
- Results are aggregated from all sub-agents
- Screenshots are uploaded to S3 with presigned URLs
- A JSON report is saved to S3
- Local screenshots are cleaned up
- Job status is marked "completed" in memory

**Source:** `agents/shivani/src/AgentShivani.js`, `src/lib/storage.ts`, `src/lib/reportNormalizer.ts`

### Phase 6: Dashboard Display

The dashboard polls `GET /api/reports/normalized` every 5 seconds. Reports are normalized into a consistent schema with pass/fail status, duration, and screenshot links.

**Source:** `src/app/qa-dashboard/`, `src/lib/reportAdapter.ts`

---

## Technology Stack

### Core Framework
- **Next.js 15.5.9** with App Router — serves both the dashboard and API routes
- **React 19** — dashboard UI
- **Tailwind CSS + Radix UI** — component library

### Browser Automation
- **Playwright 1.50.0** — used for Cloudflare-protected sites (unpatched CDP)
- **rebrowser-playwright 1.52.0** — used for PerimeterX sites (patches CDP `Runtime.enable` leak)
- **Manual Chrome spawn + CDP connect** — spawns `google-chrome` directly with `--remote-debugging-port`, connects via CDP websocket

### Bot Protection Bypass
- **curl-impersonate** — Chrome TLS fingerprinting for HTTP-level Cloudflare bypass
- **OpenAI Whisper API** — Automated audio-to-text solver for reCAPTCHA v2 image puzzles
- **Stealth injection scripts** — spoofs `navigator.webdriver`, WebGL renderer, plugins, screen properties, stack traces
- **Behavioral simulation** — human-like mouse trajectories, micro-jitter, randomized hold durations, background reCAPTCHA scoring support

### Data & Storage
- **AWS S3** — screenshots and report JSON
- **In-memory Map** — job registry (MVP, no persistence across restarts)
- **OpenAI API** — LLM-based article URL filtering during discovery

---

## Key Design Decisions

### Why Two Browser Engines?

This is the most critical architectural decision. Cloudflare and PerimeterX have **opposite** detection strategies:

- **Cloudflare Turnstile** verifies the browser is real by checking CDP `Runtime.enable` — the standard Chrome DevTools protocol. If this is patched/hidden, Cloudflare's JavaScript verification fails.
- **PerimeterX/HUMAN** detects automation by looking for the `Runtime.enable` CDP leak. If it's present, the site knows you're using automation.

So the system uses:
- `playwright` (regular) for Cloudflare — keeps CDP unpatched
- `rebrowser-playwright` for PerimeterX — patches the CDP leak

**Source:** `agents/shivani/src/browser.js:1-9` (header comment explains this)

### Why Browser Pooling?

Launching Chrome takes 3-5 seconds. When testing 50 article URLs from the same domain, that's 250 seconds of wasted startup time. The browser pool reuses instances:

- Keyed by protection type (`perimeterx` or `cloudflare`)
- 5-minute idle timeout to prevent stale state
- Full process tree kill + profile directory cleanup on eviction

### Why Headed Mode for Cloudflare?

Cloudflare Turnstile performs device fingerprinting that works better when Chrome has a real display surface. The system tries headed mode first, falls back to headless if no display is available (CI/server environments).

**Source:** `agents/shivani/src/browser.js:103-147`

### Why In-Memory Job Registry?

This is an intentional MVP trade-off. A proper job queue (Redis, SQS, database) adds infrastructure complexity. For the current scale (single-machine, handful of concurrent jobs), in-memory is sufficient. The trade-off: jobs are lost on process restart.

---

## Will Cloudflare Block Us?

**Short answer: No, based on extensive testing. Here's why.**

### What We Tested

Multiple Cloudflare-protected publisher sites were tested repeatedly over multiple sessions. The automation was not blocked or rate-limited.

### Why Cloudflare Doesn't Block This

1. **We're not scraping at scale.** We visit a handful of articles per domain, not thousands. Cloudflare's rate limiting targets high-volume scrapers.

2. **We solve the challenge correctly.** We don't bypass Turnstile by exploiting vulnerabilities — we solve it the same way a real browser does. We click the checkbox, wait for verification, and get the `cf_clearance` cookie legitimately.

3. **We use real Chrome.** Not headless phantom browsers. We spawn actual `google-chrome` with a real user data directory, realistic fingerprints (WebGL, plugins, screen resolution), and proper user-agent strings.

4. **We don't fingerprint as automation.** The stealth injection scripts remove telltale signs:
   - `navigator.webdriver = false`
   - Real WebGL renderer strings (not "SwiftShader")
   - Chrome runtime object present
   - Realistic plugins array
   - Proper screen dimensions

5. **We behave like humans.** Mouse movements follow natural trajectories with micro-jitter, click delays are randomized, and wait times vary between actions.

6. **Our volume is QA-scale, not scraping-scale.** Testing 10-50 articles per domain, a few times per day, is indistinguishable from normal user traffic.

### Risk Factors

- **Aggressive testing** (100+ pages/minute) could trigger rate limiting
- **Cloudflare updates** could change fingerprinting techniques
- **Enterprise-tier Cloudflare** with custom rules could be stricter
- **Repeated failed challenges** from the same IP could trigger temporary blocks

### Mitigation

- Keep test volume reasonable (< 50 articles per run)
- Add delays between requests (already implemented)
- Rotate user data directories (already implemented via profile cleanup)
- Monitor for 403/429 responses and back off

---

## Project Structure

```
QA-Agents/
├── src/                          # Next.js application
│   ├── app/
│   │   ├── api/                  # REST API routes
│   │   │   ├── jobs/             # Job CRUD
│   │   │   ├── reports/          # Report queries
│   │   │   ├── screenshots/      # Screenshot serving
│   │   │   ├── agents/           # Agent discovery
│   │   │   └── health/           # Health check
│   │   ├── qa-dashboard/         # Dashboard pages
│   │   └── layout.tsx            # Root layout
│   └── lib/                      # Shared utilities
│       ├── storage.ts            # S3 abstraction
│       ├── reportNormalizer.ts   # Report schema conversion
│       ├── reportAdapter.ts      # Report transformation
│       ├── s3Client.ts           # AWS S3 client
│       └── bootstrap-loader.ts   # Dynamic agent loader
├── agents/                       # Agent system
│   ├── core/                     # Framework
│   │   ├── Agent.js              # Base agent interface
│   │   ├── AgentRegistry.js      # Agent discovery
│   │   ├── SwarmOrchestrator.js  # Parallel execution
│   │   └── bootstrap.js          # System initialization
│   └── shivani/                  # QA agent
│       └── src/
│           ├── AgentShivani.js   # Main orchestrator
│           ├── DiscoveryAgent.js # Article discovery
│           ├── DetectionAgent.js # Player detection
│           ├── FunctionalAgent.js# Functional testing
│           ├── discover.js       # Sitemap/RSS/crawl
│           ├── detect.js         # DOM inspection
│           ├── test-player.js    # 7-step QA suite
│           ├── browser.js        # Browser launcher + pool
│           ├── bypass.js         # PerimeterX + popups
│           ├── cloudflare-browser-bypass.js  # Turnstile solver
│           ├── cloudflare-http.js # curl-impersonate
│           └── config.js         # User-agent, stealth
├── docs/                         # All documentation (consolidated)
├── package.json                  # Root dependencies
├── next.config.js                # Next.js config
└── .env.example                  # Environment template
```

---

## API Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/jobs` | Submit a new QA job |
| `GET` | `/api/jobs` | List recent jobs |
| `GET` | `/api/jobs/:id` | Get job status + report |
| `GET` | `/api/reports/normalized` | Query normalized reports |
| `GET` | `/api/reports/summary` | Dashboard summary metrics |
| `GET` | `/api/reports/:jobId` | Individual raw report |
| `GET` | `/api/screenshots?key=` | Redirect to signed S3 URL |
| `GET` | `/api/agents` | List registered agents |
| `GET` | `/api/health` | Health check |

---

## Running the Project

```bash
# Install dependencies
npm install
cd agents/shivani && npm install && cd ../..

# Configure environment
cp .env.example .env
# Edit .env with your AWS and OpenAI credentials

# Start development server
npm run dev

# Access dashboard
open http://localhost:3000/qa-dashboard
```

---

## Report Schema

Each test produces a normalized report:

```json
{
  "jobId": "job-1741234567890-abc123",
  "agentId": "agent-shivani",
  "target": "https://publisher.com/article",
  "type": "url",
  "overallStatus": "pass",
  "summary": {
    "passed": 7,
    "failed": 0,
    "partial": 0,
    "skipped": 0,
    "total": 7,
    "passRate": "100%"
  },
  "steps": [
    {
      "name": "Page Load",
      "status": "pass",
      "duration": 5000,
      "screenshot": "s3://bucket/path/step1.png"
    }
  ],
  "duration": 45000
}
```
