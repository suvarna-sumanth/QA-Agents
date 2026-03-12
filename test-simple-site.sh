#!/bin/bash
pkill -f "next dev" || true
sleep 2

npm run dev &
sleep 10

echo "Submitting test job for simple site..."
curl -s -X POST http://localhost:9003/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-shivani", "type": "domain", "target": "https://example.com"}' | head -1

echo "Waiting for job..."
sleep 45

echo ""
echo "Checking results..."
tail -30 /home/sumanth/.cursor/projects/home-sumanth-Projects-QA-Agents/terminals/1.txt | grep -E "Discovery.*links|articles discovered"
