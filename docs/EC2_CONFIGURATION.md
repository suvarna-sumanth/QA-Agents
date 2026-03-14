# EC2 Configuration for QA-Agents

This guide covers recommended EC2 instance and OS setup for running the QA-Agents dashboard and cognitive agent (Playwright, Cloudflare discovery, Mission Control jobs). You can run **Supabase on the same EC2** using the project’s Docker setup.

---

## Summary

| Item | App only | App + Supabase (same EC2) |
|------|----------|----------------------------|
| **Instance type** | `t3.medium` (4 GiB) min | **t3.large** (8 GiB) or **t3.xlarge** (16 GiB) |
| **AMI** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Architecture** | x86_64 | x86_64 |
| **Storage** | 20–30 GB gp3 | **40 GB gp3** (app + Docker + Postgres data) |
| **Node.js** | 20.x or 22.x LTS | 20.x or 22.x LTS |

### Approximate cost (us-east-1, on-demand, 24/7)

| Component | Spec | ~Monthly (USD) |
|-----------|------|----------------|
| **t3.medium** | 2 vCPU, 4 GiB RAM | ~\$30 |
| **t3.large** | 2 vCPU, 8 GiB RAM | ~\$60 |
| **EBS gp3** | 30 GiB (3,000 IOPS included) | ~\$2.40 |
| **EBS gp3** | 40 GiB | ~\$3.20 |

**Example:** t3.medium + 30 GiB gp3 ≈ **\$32–33/month**. Prices vary by region; check [EC2 Pricing](https://aws.amazon.com/ec2/pricing/on-demand/) and [EBS Pricing](https://aws.amazon.com/ebs/pricing/). Reserved/Spot instances can reduce cost.

---

## Why These Requirements

- **Next.js app** – ~300–500 MB RAM, CPU for build (dev) or serve (prod).
- **Playwright / Chromium** – Each browser instance can use ~500 MB–1.5 GB RAM. The agent pools 1–2 browsers (Cloudflare + optional PerimeterX); with Mission Payload Depth (e.g. 10 articles) you may have one Cloudflare browser plus article-page loads. **4 GB is workable for 1 concurrent job; 8 GB is safer for stability and headroom.**
- **Standalone Cloudflare discovery** – Spawns a separate Node process that launches Chromium; same RAM as above.
- **curl-impersonate** – Optional but recommended for HTTP-level Cloudflare bypass. Binaries are **x86_64 Linux** only (no ARM in this project’s `bin/`).
- **Disk** – `node_modules`, Playwright browsers (~400 MB+), project `bin/`, logs; 20–30 GB avoids space issues.
- **With Supabase on same EC2** – Postgres + PostgREST + Realtime add ~500 MB–1 GB RAM and extra disk for the DB; use **t3.large** (8 GiB) minimum and **40 GB** storage.

---

## 1. Instance Type

- **Light use (1 job at a time, small Mission Payload Depth)**  
  - **t3.medium** (2 vCPU, 4 GiB) – OK if you keep max articles low and avoid running many jobs in parallel.

- **Typical use (Mission Payload Depth up to ~10, occasional concurrent jobs)**  
  - **t3.large** (2 vCPU, 8 GiB) – Good balance.

- **Heavier use (higher depth, more concurrent jobs or future scaling)**  
  - **t3.xlarge** (4 vCPU, 16 GiB) or larger.

- **App + Supabase on same EC2**  
  - Use **t3.large** (8 GiB) minimum so Postgres and the app have enough RAM; **t3.xlarge** if you run many jobs or need headroom.

Avoid **ARM (Graviton)** unless you drop curl-impersonate (or build it for ARM) and rely only on Playwright’s bundled Chromium.

---

## 2. AMI / OS

- **Ubuntu 22.04 LTS** – Easiest for Node, Playwright, and system packages; well documented.
- **Amazon Linux 2** – Also fine; install Node via `nvm` or NodeSource and install Playwright dependencies (see below).

Use **x86_64** so the project’s `bin/` curl-impersonate binaries work.

---

## 3. Storage

- **App only**: 20 GB minimum, **30 GB recommended** (gp3).
- **App + Supabase on same EC2**: **40 GB** recommended (OS, Node, app, Playwright, Docker, Postgres data volume).

---

## 4. Running Supabase on the same EC2

You can run the project’s **self-hosted Supabase** (Postgres + PostgREST + Realtime) on the same instance as the app. The app then talks to Supabase on `localhost`.

### 4.1 Install Docker

On Ubuntu 22.04:

```bash
apt-get update && apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 4.2 Start Supabase before the app

From the project root:

```bash
./scripts/setup-db.sh
```

This starts (see `supabase/docker/docker-compose.yml`):

- **Postgres** – port `54322` (host) → 5432 (container)
- **PostgREST** – port `54321` (REST API)
- **Realtime** – port `4000` (WebSockets)

Migrations in `supabase/migrations/` are applied automatically.

### 4.3 App .env for local Supabase

Point the app at localhost:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase/docker/.env.docker>
SUPABASE_SERVICE_ROLE_KEY=<from supabase/docker/.env.docker>
```

Get the anon and service_role keys from `supabase/docker/.env.docker` after the first run (they are generated for the local JWT secret). For a quick start you can use the placeholder keys in that file; for production, generate proper JWTs with the same `JWT_SECRET` used in `docker-compose.yml` / `.env.docker`.

### 4.4 Startup order

1. Start Supabase: `./scripts/setup-db.sh`
2. Start the app: `npm run start` (or `npm run dev`)

You can run Supabase via systemd or a small script so it starts on boot; the app (PM2/systemd) should start after Docker and Supabase are up.

### 4.5 Ports (no conflict)

- App: **9002**
- PostgREST: **54321**
- Realtime: **4000**
- Postgres (host): **54322**

Only **9002** needs to be open in the security group for external access; keep 54321/4000/54322 bound to localhost or a private IP unless you need direct DB/API access from outside.

---

## 5. User Data / Bootstrap (Ubuntu 22.04)

Minimal example to get Node, project deps, and Playwright browsers in place. Run as root (e.g. EC2 user data) or adapt for a normal user. Add the Docker block if you run Supabase on the same EC2.

```bash
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

# System updates and basics
apt-get update && apt-get upgrade -y
apt-get install -y curl git unzip xvfb

# Optional: Docker (for Supabase on same EC2)
# apt-get install -y ca-certificates gnupg
# install -m 0755 -d /etc/apt/keyrings
# curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
# chmod a+r /etc/apt/keyrings/docker.gpg
# echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
# apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Node 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Playwright system dependencies (required for Chromium)
npx playwright install-deps chromium || true
npx playwright install chromium

# Optional: system curl-impersonate (if not using project bin/)
# apt-get install -y curl-impersonate || true
```

Then clone repo, `npm ci`, set env (see below). If using Supabase on same host, run `./scripts/setup-db.sh` first, then:

- Dev: `npm run dev` (port 9002).
- Prod: `npm run build && npm run start` (port 9002).

---

## 6. Environment Variables

Set these (e.g. in `.env` or the process manager):

| Variable | Required | Notes |
|----------|----------|--------|
| `OPENAI_API_KEY` | Yes | Plan/discovery and LLM filtering |
| `NEXT_PUBLIC_SUPABASE_URL` | If using Supabase | Jobs/dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | If using Supabase | |
| `SUPABASE_SERVICE_ROLE_KEY` | If using Supabase | |
| `CLOUDFLARE_DISCOVERY_SCRIPT` | Yes for Cloudflare | Path to `agents/shivani/src/run-cloudflare-discovery.js` so standalone discovery is used |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | If using S3 | Screenshots/reports |
| `AWS_REGION` | If using S3 | |

For **Cloudflare discovery** when running under Next.js, the dev wrapper sets `CLOUDFLARE_DISCOVERY_SCRIPT`; on EC2 you must set it (or use the same wrapper) so the internal API runs the standalone script.

---

## 7. Security Group

- **Inbound**:
  - **22 (SSH)** – Restrict to **your IP** or a known range (e.g. office/VPN), not `0.0.0.0/0`, for production.
  - **9002 (TCP)** – Required for the QA dashboard. Add a custom rule: Type **Custom TCP**, Port **9002**, Source **0.0.0.0/0** (or your IP/load balancer). The app listens on 9002; HTTP/HTTPS (80/443) are only needed if you put a reverse proxy in front.
- **Outbound**: allow HTTPS (443) and HTTP (80) for Playwright, OpenAI, Supabase, and S3.

---

## 8. Optional: curl-impersonate

For better Cloudflare bypass, use one of:

- **Project `bin/`** – Copy the project’s `bin/` (x86_64 Linux) to the EC2 app directory so the code finds `curl_chrome116` etc. in `bin/`.
- **System package** – On Ubuntu: `apt-get install -y curl-impersonate` if available, then ensure the binary is on `PATH` or adjust code to use it.

---

## 9. Process Management

Run the app under a process manager so it restarts on crash and survives SSH disconnect:

- **systemd** – Create a unit that runs `npm run start` (prod) or `npm run dev` (dev) with the right `WorkingDirectory` and `Environment`.
- **PM2** – e.g. `pm2 start npm --name "qa-agents" -- start` (prod) or `-- run dev` (dev), then `pm2 save` and `pm2 startup`.

---

## 10. Quick Reference

**App only**

```text
Instance:    t3.medium (4 GiB) min, t3.large (8 GiB) recommended
AMI:         Ubuntu 22.04 LTS x86_64
Storage:     30 GB gp3
Port:        9002
Node:        20.x or 22.x
Required:    Playwright Chromium + deps, OPENAI_API_KEY, CLOUDFLARE_DISCOVERY_SCRIPT
Optional:    curl-impersonate (bin/ or system), Supabase (hosted), S3
```

**App + Supabase on same EC2**

```text
Instance:    t3.large (8 GiB) or t3.xlarge (16 GiB)
AMI:         Ubuntu 22.04 LTS x86_64
Storage:     40 GB gp3
Ports:       9002 (app); 54321, 4000, 54322 (Supabase, localhost only)
Start order: Docker → ./scripts/setup-db.sh → npm run start
Env:         NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 + anon/service_role keys from supabase/docker/.env.docker
```

This setup supports the Mission Control dashboard and agent runs (discovery, detect player, test player) with Mission Payload Depth driven by the dashboard’s “Mission Payload Depth” (max articles) setting.

---

## 11. Launch wizard checklist (EC2 console)

Use this when you're on the "Launch an instance" page.

### Before you launch

| Setting | Recommended | Notes |
|--------|-------------|--------|
| **Instance type** | **t3.large** (8 GiB) if app + Supabase; **t3.medium** (4 GiB) if app only | t3.micro is too small for Playwright + app (and Supabase). |
| **Storage** | **30–40 GiB** gp3 | 8 GiB is too small for app, Node, Playwright browsers, and (if used) Docker/Postgres. |
| **Key pair** | Keep your key (e.g. Website-Monitor) | You need the `.pem` to SSH in. |
| **Security group** | Add **Custom TCP port 9002** | Dashboard runs on 9002. Restrict **SSH (22)** to your IP, not Anywhere. |

### Advanced details (expand and configure)

| Option | Recommendation |
|--------|----------------|
| **User data** | Optional: script at first boot to install Node, Docker (if Supabase), Playwright deps, clone repo, start app. See section 5. Leave blank to set up manually via SSH. |
| **IAM instance profile** | **Recommended** if the app uses S3 or Secrets Manager. Attach a role so the app can access AWS without keys in `.env`. |
| **Shutdown behavior** | Stop (default) or Terminate. |
| **Monitoring** | Detailed CloudWatch optional; standard is usually enough. |

### After launch

1. SSH in: `ssh -i Website-Monitor.pem ec2-user@<public-ip>` (Amazon Linux) or `ubuntu@<public-ip>` (Ubuntu).
2. Install Node, Playwright deps, (optionally) Docker, clone repo, set `.env`, start app—or use user data.
3. Open dashboard at `http://<public-ip>:9002` (security group must allow 9002).
