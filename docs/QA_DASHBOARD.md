# QA Dashboard Documentation

## Overview

The QA Dashboard is a modern Next.js/React web interface for managing and monitoring QA agent runs. It provides:

- **Real-time job submission** - Submit new test runs via web interface
- **Global Swarm Intelligence** - High-fidelity visualization of the agent specialist network
- **Mission Control Logs** - Real-time terminal-style telemetry across all active agents
- **Specialist Engagement Tracking** - Live utilization and status monitoring of Orchestrator, Discovery, Detection, and Functional agents
- **Detailed results** - View step-by-step test execution with screenshots and AI summaries
- **Historical reports** - Browse completed runs and analyze trends with "Mission History"
- **Agent discovery** - See available agents and their capabilities

## Architecture

```
┌─────────────────────────────────────────────┐
│       QA Dashboard (Next.js/React)          │
├─────────────────────────────────────────────┤
│ ├─ /qa-dashboard/              (Overview)   │
│ ├─ /qa-dashboard/runs/[jobId]  (Details)    │
│ └─ /qa-dashboard/jobs          (Submit)     │
└─────────────────────────────────────────────┘
             │
             │ REST API calls
             ▼
┌─────────────────────────────────────────────┐
│      Next.js API Routes (/api/*)            │
├─────────────────────────────────────────────┤
│ ├─ /api/health                              │
│ ├─ /api/agents                              │
│ ├─ /api/jobs                                │
│ ├─ /api/jobs/[id]                           │
│ ├─ /api/reports/summary                     │
│ ├─ /api/reports/normalized                  │
│ └─ /api/reports/[jobId]                     │
└─────────────────────────────────────────────┘
             │
             │ Agent execution
             ▼
┌─────────────────────────────────────────────┐
│          Agent System                       │
├─────────────────────────────────────────────┤
│ ├─ Agent Registry                           │
│ └─ AgentShivani (QA player testing)         │
└─────────────────────────────────────────────┘
```

## Pages

### 1. Dashboard Overview (`/qa-dashboard`)

Main dashboard showing:
- **Summary metrics**: Total runs, success rate, avg duration
- **Mission Analytics Trends**: Interactive AreaChart showing pass rate performance over time
- **Swarm Specialist Pulse**: Real-time utilization and status of the 4 specialist nodes
- **Mission Control Logs**: Terminal-style stream of global mission events
- **Recent runs table**: Last 10 completed jobs with specialist engagement tracking
- **Real-time updates**: Auto-refreshes every 5 seconds
- **Quick actions**: Submit new job link

**Features:**
- **Premium Visual Telemetry**: Dark-themed specialist cluster and network heartbeat
- **Status badges**: High-fidelity badges with status labeling
- **Specialist Engagement**: Hoverable icons showing which specialists participated in each run
- **Pass rate progress bars**: Real-time visual representation of job health
- **Timestamps**: Localized time for accurate event tracking
- **Links**: Direct access to Mission Details via "Details" action

**Data Fetched:**
- `GET /api/reports/summary` - Dashboard metrics
- `GET /api/reports/normalized?limit=10` - Recent runs

### 2. Run Details (`/qa-dashboard/runs/[jobId]`)

Detailed view of a specific job:
- **Swarm Network Topology**: Animated SVG visualization of the specialist hierarchy
- **AI Executive Analysis**: Natural language summary of mission outcomes
- **Expert Mission Logs**: Real-time terminal output of specialist decisions
- **Parallel Performance**: Metrics for Efficiency, Topology, and Speedup factor
- **Visual Evidence Gallery**: Grid of screenshots captured during the run
- **Article Coverage**: Detailed status of player detection across all tested URLs
- **Technical Step Logs**: Expandable execution timeline with sub-steps and metadata

**Features:**
- **Animated Topology**: Live-pulsing network graph of active specialists
- **Terminal Heartbeats**: Mono-spaced logs for senior engineer debugging
- **High-Fidelity Badges**: pass/fail/partial status with specific color-coding
- **Visual Artifacts**: "Visual Evidence" section with hover-to-zoom capabilities
- **Speedup Metrics**: Displays the 2x-4x efficiency gain of the swarm architecture
- **Navigation**: Clean dashboard back-links and tabbed tech/visual views

**Data Fetched:**
- `GET /api/reports/[jobId]` - Full normalized report
- Auto-polls if job is still running

### 3. Job Submission (`/qa-dashboard/jobs`)

Form to submit new test jobs:
- **Agent selection**: Dropdown with available agents
- **Job type**: Radio buttons for URL or domain crawl
- **Target input**: URL/domain field with validation
- **Configuration**: Type-specific options (e.g., maxArticles for domains)
- **Submission**: Submit button with loading state
- **Success page**: Shows job ID and next steps

**Features:**
- Agent capability display
- URL placeholder updates based on job type
- Form validation
- Success confirmation with job ID
- Copy-to-clipboard functionality
- Quick link to view run details

**Data Fetched:**
- `GET /api/agents` - List available agents
- `POST /api/jobs` - Submit new job

## Components

### Page Components

**`qa-dashboard/page.tsx`** - Overview dashboard
- Metric cards (total runs, success rate, avg time)
- Recent runs table with status indicators
- Auto-refresh logic

**`qa-dashboard/runs/[jobId]/page.tsx`** - Run details
- Summary card with job metadata
- Expandable step list
- Screenshot viewer
- Nested step display

**`qa-dashboard/jobs/page.tsx`** - Job submission
- Agent selection form
- Job type selector
- Configuration inputs
- Success confirmation

### Layout Component

**`qa-dashboard/layout.tsx`** - Shared layout
- Top navigation with branding
- Navigation links
- Footer with attribution
- Styling context

### Utility Functions

**`lib/reportNormalizer.ts`**
- `normalizeReport()` - Convert raw to normalized format
- `normalizeReports()` - Batch normalization
- `getStatusDisplay()` - Status label/color mapping
- `filterReportsByStatus()` - Filter helper

**`lib/reportAdapter.ts`**
- `adaptJobToNormalizedReport()` - API job to dashboard format
- `adaptJobsToNormalizedReports()` - Batch adaptation
- `generateDashboardSummary()` - Summary metrics
- `analyzeStepPerformance()` - Step-level analysis

## Styling

The dashboard uses:
- **Tailwind CSS** for utility-first styling
- **Lucide React** for icons (CheckCircle, XCircle, etc.)
- **Custom color scheme**: Blue primary, slate grays, semantic colors (green/yellow/red)
- **Responsive design**: Mobile-first approach
- **Animations**: Smooth transitions and rotate effects
- **Accessibility**: Proper button roles, semantic HTML, ARIA attributes

## Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Pass | Green | #22c55e |
| Fail | Red | #ef4444 |
| Partial | Yellow | #eab308 |
| Skip | Gray | #6b7280 |
| Error | Dark Red | #dc2626 |

## API Integration

### Endpoints Used

**Dashboard Overview**
```
GET /api/reports/summary
GET /api/reports/normalized?limit=10
```

**Run Details**
```
GET /api/reports/[jobId]
```

**Job Submission**
```
GET /api/agents
POST /api/jobs
GET /api/jobs/:id (for polling)
```

### Polling Behavior

- Dashboard refreshes every 5 seconds
- Run details page polls if status !== 'completed'
- Can be configured per component

## Features & Interactions

### Dashboard Overview

- **Sorting**: Click table headers to sort (implement in future)
- **Filtering**: Status, agent, date range filters (implement in future)
- **Pagination**: Load more older runs (implement in future)
- **Export**: Export results as CSV/JSON (implement in future)

### Run Details

- **Expand steps**: Click to reveal full step details
- **View screenshots**: Inline image viewer
- **Copy URLs**: Copy job ID to clipboard
- **Back navigation**: Return to dashboard

### Job Submission

- **Form validation**: Required field checking
- **Agent info**: Display capabilities on selection
- **Success feedback**: Confirmation with next steps
- **Submit another**: Quick re-submission

## Performance Considerations

- **API caching**: Reports cached in-memory (MVP)
- **Pagination**: Limit queries to recent runs (default 50)
- **Lazy loading**: Images loaded on-demand
- **Debouncing**: Form submissions validated before sending
- **Auto-refresh**: Configurable polling intervals

## Future Enhancements

### Dashboard

- [ ] **Charts & analytics**: Trends, pass rates over time
- [ ] **Filtering UI**: Advanced search and filtering
- [ ] **Comparisons**: Side-by-side run comparisons
- [ ] **Notifications**: Alert on failures
- [ ] **Favorites**: Star/bookmark important runs
- [ ] **Export**: CSV, PDF report generation

### Run Details

- [ ] **Video replay**: Animated step-through
- [ ] **Diff view**: Compare consecutive runs
- [ ] **Raw JSON**: Toggle raw report view
- **Performance graph**: Step timing visualization
- [ ] **Error details**: Expanded error messages
- [ ] **Retry failed steps**: Re-run specific steps

### Job Submission

- [ ] **Scheduled runs**: Cron expression support
- [ ] **Webhooks**: Notify external systems on completion
- [ ] **Presets**: Save job templates
- [ ] **Bulk submission**: CSV import
- [ ] **Advanced config**: Agent-specific settings UI

### General

- [ ] **Dark mode**: Theme toggle
- [ ] **Accessibility**: Full WCAG compliance
- [ ] **Mobile app**: React Native version
- [ ] **WebSocket**: Real-time updates instead of polling
- [ ] **Authentication**: User login & role-based access
- [ ] **Database**: Persistent job history

## Development

### Running the Dashboard

```bash
# Install dependencies (if not already installed)
npm install

# Start development server
npm run dev

# Navigate to
http://localhost:3000/qa-dashboard
```

### File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── health/
│   │   ├── agents/
│   │   ├── jobs/
│   │   └── reports/
│   └── qa-dashboard/
│       ├── layout.tsx        (Shared layout)
│       ├── page.tsx          (Overview)
│       ├── jobs/
│       │   └── page.tsx      (Job submission)
│       └── runs/
│           └── [jobId]/
│               └── page.tsx  (Run details)
│
└── lib/
    ├── reportNormalizer.ts   (Schema conversion)
    └── reportAdapter.ts      (API adaptation)
```

### Adding a New Dashboard Page

1. Create page component in `src/app/qa-dashboard/...`
2. Use shared `layout.tsx` for navigation
3. Import utilities from `src/lib/`
4. Fetch data from API routes
5. Add link in navigation

### Styling Guidelines

- Use Tailwind utility classes
- Follow color scheme (blue, slate, green/yellow/red)
- Mobile-first responsive design
- Use Lucide icons for consistency
- Add hover states for interactive elements

## Testing

### Manual Testing Checklist

- [ ] Dashboard loads and refreshes metrics
- [ ] Click "View" link navigates to run details
- [ ] Run details page shows all steps correctly
- [ ] Screenshots display inline
- [ ] Expand/collapse steps works smoothly
- [ ] Job submission form validates
- [ ] Agent dropdown populates
- [ ] Config fields show/hide based on job type
- [ ] Submit success shows job ID
- [ ] "View Run Details" navigates correctly

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## Known Limitations

1. **In-memory storage**: Reports lost on server restart
2. **No pagination**: Limited to last 50 jobs
3. **No filtering**: Cannot filter by agent/status yet
4. **Polling**: Interval-based instead of WebSocket
5. **Screenshots**: Not stored in S3 yet (local memory)
6. **No authentication**: Anyone can access/submit jobs

See `REPORT_NORMALIZATION.md` and `API_INTEGRATION.md` for additional technical details.
