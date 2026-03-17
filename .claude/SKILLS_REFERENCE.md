# Skills Reference Guide

All agent testing capabilities are implemented as **Skills** registered in the **SkillRegistry**. The Supervisor executes them in sequence based on the execution plan.

## Skill Interface

```javascript
class Skill {
  constructor(name) {
    this.name = name;  // Unique identifier
  }

  async run(state) {
    // Implement testing logic
    // Input: AgentState
    // Output: Updated AgentState
    return updatedState;
  }
}
```

## Registered Skills

### 1. DiscoverArticlesSkill
**Purpose**: Find testable article URLs from target domain

**Process**:
1. Tries sitemap.xml (multiple variants)
2. Falls back to RSS feeds if sitemap unavailable
3. Validates URLs with LLM to ensure they're article pages
4. Filters duplicates

**Output**:
- `articles[]` - Array of discovered URLs
- `discoveryMethod` - 'sitemap' or 'rss'

**Status in Dashboard**: Discovery (5%)

---

### 2. DetectPlayerSkill
**Purpose**: Check if video player exists on discovered articles

**Process**:
1. Launches undetected browser context
2. Navigates to each article URL
3. Waits for DOM content loaded
4. Checks for player selectors (Hls.js, JW Player, Brightcove, etc.)
5. Sets `player_detected = true/false`

**Status in Dashboard**: Detection (8%)

---

### 3. TestPlayerSkill
**Purpose**: Test if video player actually plays content

**Process**:
1. Injects JavaScript to monitor video events
2. Attempts to play video
3. Waits for 'play', 'playing' events
4. Records playback status
5. Returns `can_play_video: true/false`

**Status in Dashboard**: Functional (10%)

---

### 4. BypassCloudflareSkill
**Purpose**: Handle Cloudflare protection

**Status**: Passive (only logs detection, doesn't actively bypass)

**How it works**:
- Checks for Cloudflare challenge pages
- Logs protection type
- Relies on acceptInsecureCerts + Chrome flags

---

### 5. BypassPerimeterXSkill
**Purpose**: Handle PerimeterX WAF protection

**Status**: Passive (observes, doesn't bypass)

**How it works**:
- Detects PerimeterX cookie-setting behavior
- Uses proxy rotation via BrightData
- Launches "Undetected Browser" variant

---

### 6. DismissPopupsSkill
**Purpose**: Remove modal/popup overlays blocking video player

**Process**:
1. Looks for common modal selectors
2. Clicks close buttons
3. Presses Escape key
4. Removes overlay elements via DOM manipulation

---

### 7. TakeScreenshotSkill
**Purpose**: Capture evidence of test results

**Process**:
1. Takes fullpage screenshots at each step
2. Uploads to AWS S3
3. Stores reference in test_history

**Output**: S3 URL for each screenshot

---

## Skill Execution Flow

```
Plan Created (e.g., [discover_articles, detect_player, test_player])
    ↓
For each step in plan:
    ├─ Execute skill
    ├─ Update AgentState
    ├─ Log progress to agentLogger
    └─ Dashboard updates in real-time
    ↓
All skills complete
    ↓
Evaluate node computes mission status
```

## AgentState Structure

```typescript
{
  url: string;              // Target domain
  jobId: string;            // Unique job ID
  plan: string[];           // List of skills to execute
  currentStep: number;      // Index in plan
  articles: Array<{         // Discovered URLs
    url: string;
    discoveryMethod: 'sitemap' | 'rss';
    player_detected: boolean;
    can_play_video: boolean;
  }>;
  results: {
    playable_count: number;
    total_tested: number;
    has_cloudflare: boolean;
    has_perimeterx: boolean;
  };
  finalStatus: 'pass' | 'fail' | 'partial';
}
```

## Dashboard Metrics

The four specialist bars in Mission Control show real-time progress:

| Specialist | What It Measures |
|-----------|-----------------|
| **Senior Engineer** | Planner node completion (12%) |
| **Discovery** | Sitemap/RSS articles found (5%) |
| **Detection** | Player detection on articles (8%) |
| **Functional** | Playback capability confirmed (10%) |

**Note**: Percentages are cumulative based on how many articles are processed. If 3 articles discovered but only 2 have playable players, Functional shows 6.67% (2/3).

## Debugging Skills

### View Active Skill Execution
```bash
pm2 logs qa-agents | grep "Executing skill:"
```

### Sample Output
```
[Detection] Executing skill: detect_player
[Browser] Launching Undetected browser (perimeterx)...
[DetectPlayerSkill] Checking: https://thehill.com/article/path
[DetectPlayerSkill] Loading page...
[DetectPlayerSkill] Player detected: true
```

### Check Skill Registry
```bash
curl http://100.54.233.117:9002/api/agents
```

Returns list of registered skills and agents.

## Adding New Skills

1. Create file: `agents/core/skills/MyNewSkill.js`
2. Extend Skill base class
3. Implement `run(state)` method
4. Register in `agents/core/index.js`:
   ```javascript
   skills.register(new MyNewSkill());
   ```
5. Reference in plan by name: `my_new_skill`

## Skill Chaining

Skills can conditionally trigger others based on results:

```javascript
// In expand node logic
if (state.articles.length > 0) {
  plan.push('detect_player');  // Only if articles found
}
```

This prevents running detection on empty article lists.
