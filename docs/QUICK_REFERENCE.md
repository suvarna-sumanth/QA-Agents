# Quick Reference - QA Agents Platform

## 🚀 Start Here

### Check if Server is Running
```bash
ps aux | grep "next dev" | grep -v grep
```

### Start Server
```bash
cd /home/sumanth/Projects/QA-Agents
npm run dev
```

### Access Points
```
Dashboard:  http://localhost:9002/qa-dashboard
API:        http://localhost:9002/api/*
Health:     http://localhost:9002/api/health
```

---

## 📁 Project Structure

```
src/
├── agents/             ← All agent code
│   ├── core/          ← Framework
│   └── shivani/       ← QA player agent
├── app/               ← Next.js app
│   ├── api/           ← API routes
│   └── qa-dashboard/  ← Dashboard UI
└── lib/               ← Utilities (storage, S3, etc)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/agents` | List all agents |
| POST | `/api/jobs` | Submit new job |
| GET | `/api/jobs` | List recent jobs |
| GET | `/api/jobs/[id]` | Get job status |
| GET | `/api/reports/normalized` | Get reports |
| GET | `/api/reports/summary` | Get summary |
| GET | `/api/health` | Health check |

---

## 💾 Environment Variables

Located in: `.env` (root directory)

```bash
# AWS S3
S3_BUCKET=qa-agents-reports-prod
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Node
NODE_ENV=development
```

---

## 📊 Job Submission

```bash
curl -X POST http://localhost:9002/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "agentId": "shivani",
    "type": "url",
    "target": "https://example.com/article",
    "config": {}
  }'
```

Response:
```json
{
  "success": true,
  "jobId": "job-1710259212345-abc123",
  "status": "queued"
}
```

---

## 🔍 Check Job Status

```bash
curl http://localhost:9002/api/jobs/job-1710259212345-abc123
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 9002 in use | `lsof -i :9002` then `kill -9 <PID>` |
| Build errors | `rm -rf .next && npm run dev` |
| Import errors | Check `tsconfig.json` path aliases |
| Playwright errors | Ensure `src/agents/shivani/node_modules` exists |

---

## 📂 Important Files

- `src/app/api/jobs/route.ts` - Job API logic
- `src/app/api/agents/route.ts` - Agent discovery
- `src/agents/core/bootstrap.js` - Agent initialization
- `src/agents/shivani/src/AgentShivani.js` - Shivani agent
- `tsconfig.json` - Path aliases
- `.env` - Environment config

---

## ✨ Key Features

✅ Multi-agent architecture  
✅ Playwright-based automation  
✅ S3 report storage  
✅ React dashboard  
✅ RESTful API  
✅ Job queue  
✅ Report normalization  
✅ Real-time status tracking

---

## 🎯 Typical Workflow

1. **Access Dashboard**
   ```
   http://localhost:9002/qa-dashboard
   ```

2. **Submit Job**
   - Select agent (Shivani)
   - Enter URL or domain
   - Click "Start Test"

3. **Monitor Progress**
   - Watch status change: queued → running → completed
   - View logs in real-time

4. **View Report**
   - Click job to see details
   - View screenshots
   - Download report

---

## 🔗 Path Aliases

```typescript
// Import path alias
"@agents/*": "./src/agents/*"

// Usage
import { bootstrapAgents } from '@agents/core/bootstrap';
// Resolves to: src/agents/core/bootstrap.ts or .js
```

---

## 📞 Support

For issues, check:
1. Server logs: `npm run dev` output
2. Browser console: DevTools → Console
3. API response: HTTP status codes
4. Documentation: `*.md` files in root

---

**Status**: 🟢 LIVE AND WORKING  
**Last Updated**: March 12, 2026
