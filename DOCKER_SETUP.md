# Local Supabase Setup with Docker

This project supports a self-hosted Supabase environment for local development and testing.

## Prerequisites
- Docker
- Docker Compose

## Quick Start
1. Run the setup script:
   ```bash
   ./scripts/setup-db.sh
   ```
2. This will:
   - Start Postgres, PostgREST, and Realtime containers.
   - Automatically apply the schema from `supabase/migrations/00001_initial_schema.sql`.

## Configuration
Update your root `.env` file with these local values. Get anon and service_role keys from your running Supabase (e.g. `supabase status` or from `supabase/docker/.env.docker` after first run).
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-from-supabase>
```

## Services Summary
- **Postgres:** `localhost:54322`
- **REST API (PostgREST):** `http://localhost:54321`
- **Realtime (Websockets):** `ws://localhost:4000`

## Stopping Services
To stop the local environment:
```bash
cd supabase/docker && docker-compose down
```
