#!/bin/bash

# Configuration
DOCKER_DIR="supabase/docker"
ENV_FILE=".env.docker"

echo "🚀 Starting Supabase Docker services..."
cd $DOCKER_DIR && docker-compose --env-file $ENV_FILE up -d

echo "⏳ Waiting for database to be ready..."
until docker exec supabase-db pg_isready -U postgres; do
  sleep 2
done

echo "✅ Database is ready!"
echo "📡 PostgREST is running at http://localhost:54321"
echo "🌀 Realtime is running at http://localhost:4000"
echo ""
echo "📝 Note: Initial migrations were applied from supabase/migrations/"
echo "🔗 Update your root .env with the credentials from supabase/docker/.env.docker"
