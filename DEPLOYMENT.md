# OmniFlow — Deployment Guide

> **Stack**: Railway (Docker) + Neon (PostgreSQL) + Upstash (Redis) + Sentry (APM) + Cloudflare (DNS/CDN/WAF)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Neon — PostgreSQL Setup](#2-neon--postgresql-setup)
3. [Upstash — Redis Setup](#3-upstash--redis-setup)
4. [Sentry — Error Tracking Setup](#4-sentry--error-tracking-setup)
5. [Railway — Backend Deployment](#5-railway--backend-deployment)
6. [Cloudflare — DNS & Security](#6-cloudflare--dns--security)
7. [First Deploy Checklist](#7-first-deploy-checklist)
8. [Post-Deploy Verification](#8-post-deploy-verification)
9. [Database Migrations](#9-database-migrations)
10. [Rollback Procedures](#10-rollback-procedures)
11. [Monitoring & Alerts](#11-monitoring--alerts)
12. [Cost Estimation](#12-cost-estimation)

---

## 1. Prerequisites

| Tool                | Version    | Purpose               |
|---------------------|------------|----------------------|
| Railway CLI         | latest     | Deploy & manage      |
| `openssl`           | any        | Generate secrets     |
| Neon account        | Free/Pro   | PostgreSQL serverless |
| Upstash account     | Free/Pro   | Redis serverless     |
| Sentry account      | Free/Team  | Error tracking       |
| Cloudflare account  | Free       | DNS + WAF + SSL      |

Generate secrets now (you'll need them later):

```bash
# SECRET_KEY — 64 hex chars (256-bit)
openssl rand -hex 64

# ENCRYPTION_KEY — 32 hex chars (128-bit)
openssl rand -hex 32
```

---

## 2. Neon — PostgreSQL Setup

### 2.1 Create Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. **Create Project** → Region: `eu-central-1` (Frankfurt)
3. Name: `omniflow-production`
4. PostgreSQL version: **16**

### 2.2 Get Connection String

```
postgresql+asyncpg://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require
```

- Dashboard → **Connection Details** → Select `asyncpg` driver
- Copy the connection string, prepend `postgresql+asyncpg://`

### 2.3 Enable Extensions

Connect via Neon SQL Editor or `psql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- Fuzzy search
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- Range indexing
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- Query analytics
```

### 2.4 Configure Autoscaling

- Dashboard → **Settings** → Compute
- Min: **0.25 CU** (auto-suspend after 5 min idle)
- Max: **2 CU** (scales up under load)
- Autosuspend: **5 minutes** (saves cost)

### 2.5 Branching (Optional)

Create a `staging` branch for safe migration testing:

```bash
# Via Neon API or dashboard
neon branches create --name staging --parent main
```

---

## 3. Upstash — Redis Setup

### 3.1 Create Database

1. Go to [console.upstash.com](https://console.upstash.com)
2. **Create Database**
3. Name: `omniflow-prod`
4. Region: `eu-central-1` (same as Neon for low latency)
5. TLS: **Enabled** (mandatory)
6. Eviction: **Enabled** (acts as cache, not persistent store)

### 3.2 Get Connection String

```
rediss://default:<password>@<endpoint>.upstash.io:6379
```

> **Important**: Use `rediss://` (double 's') for TLS. The code auto-detects this.

### 3.3 Usage Patterns

| Feature            | Key Pattern              | TTL     | Est. Commands/day |
|--------------------|--------------------------|---------|--------------------|
| Rate Limiting      | `rate:*`                 | 60-900s | ~5,000             |
| JWT Blacklist      | `blacklist:*`            | 30d     | ~200               |
| Dashboard Cache    | `cache:dashboard:*`      | 120s    | ~2,000             |
| Session Data       | `session:*`              | 30d     | ~500               |
| OmniScore Cache    | `cache:omniscore:*`      | 24h     | ~100               |

Free tier (10k/day) is sufficient for beta. Upgrade to Pro when needed.

---

## 4. Sentry — Error Tracking Setup

### 4.1 Create Project

1. Go to [sentry.io](https://sentry.io) → **Create Project**
2. Platform: **FastAPI** (Python)
3. Name: `omniflow-api`
4. Team: Create or select

### 4.2 Get DSN

- Project → **Settings** → **Client Keys (DSN)**
- Copy the DSN: `https://<key>@o<org_id>.ingest.sentry.io/<project_id>`

### 4.3 Configure Alerts

Recommended alert rules:
- **P0 — Instant**: Any `5xx` error → Slack/Email
- **P1 — 5 min window**: Error rate > 5% → Slack
- **P2 — Daily**: New unresolved issues → Email digest
- **Performance**: P95 latency > 2s on any endpoint → Slack

### 4.4 What's Auto-Captured

The SDK (`app/core/sentry_config.py`) is pre-configured to:
- **Filter out**: 401, 404, 422 errors (noise)
- **Scrub**: Authorization headers, passwords, cookies (RGPD)
- **Drop**: `/health/*` and `/metrics` transactions (cost saving)
- **Track**: All 5xx errors, slow queries, background tasks

---

## 5. Railway — Backend Deployment

### 5.1 Connect Repository

```bash
railway login
railway init
# or link to existing project:
railway link
```

### 5.2 Set Environment Variables

Go to Railway Dashboard → Project → **Variables** tab.

Copy all variables from `.env.production.example` and fill in real values:

```bash
# Or via CLI (one by one):
railway variables set ENVIRONMENT=production
railway variables set DATABASE_URL="postgresql+asyncpg://..."
railway variables set REDIS_URL="rediss://..."
railway variables set SECRET_KEY="$(openssl rand -hex 64)"
railway variables set ENCRYPTION_KEY="$(openssl rand -hex 32)"
railway variables set SENTRY_DSN="https://...@sentry.io/..."
# ... set all other variables
```

### 5.3 Configure Service

Railway reads `railway.toml` at the repo root. The file is pre-configured:

- **Build**: Uses `apps/api/Dockerfile` (3-stage multi-stage)
- **Deploy**: Gunicorn with Uvicorn workers
- **Health Check**: `GET /health/live` (10s timeout)
- **Release**: `alembic upgrade head` (runs before traffic switch)
- **Restart**: On failure, max 5 retries

### 5.4 Custom Domain

1. Railway → **Settings** → **Networking** → **Custom Domain**
2. Add: `api.omniflow.app`
3. Copy the CNAME target
4. In Cloudflare: Add CNAME record → `api.omniflow.app` → Railway target

### 5.5 Deploy

```bash
# First deploy
railway up

# Or push to main branch (auto-deploy if connected)
git push origin main
```

### 5.6 Verify

```bash
# Health check
curl https://api.omniflow.app/health/live
# Expected: {"status":"ok","version":"0.5.0"}

# Readiness (includes DB + Redis)
curl https://api.omniflow.app/health/ready
```

---

## 6. Cloudflare — DNS & Security

### 6.1 DNS Records

| Type  | Name              | Target                        | Proxy |
|-------|-------------------|-------------------------------|-------|
| CNAME | `api`             | `<railway-cname>.up.railway.app` | ☁️ On  |
| CNAME | `app`             | `<vercel-cname>.vercel.app`   | ☁️ On  |
| A     | `@` (root)        | Landing page host             | ☁️ On  |

### 6.2 SSL/TLS

- Mode: **Full (Strict)**
- Minimum TLS: **1.2**
- Always Use HTTPS: **On**
- HSTS: **On** (max-age 31536000, includeSubDomains)

### 6.3 Security Rules (WAF)

```
Rule 1: Block known bad bots
  Expression: cf.client.bot and not cf.bot_management.verified_bot
  Action: Block

Rule 2: Rate limit API auth
  Expression: http.request.uri.path contains "/auth/" and http.request.method eq "POST"
  Action: Rate limit (20 req/min per IP)

Rule 3: Geographic restriction (optional, RGPD)
  Expression: not ip.geoip.country in {"FR" "DE" "BE" "CH" "LU" "IT" "ES" "NL" "PT" "AT"}
  Action: Challenge
```

### 6.4 Page Rules

```
api.omniflow.app/health/*  → Cache Level: Bypass, Security: Off
api.omniflow.app/*          → SSL: Full (Strict), Cache: Bypass
```

---

## 7. First Deploy Checklist

```
[ ] Neon project created, connection string obtained
[ ] Upstash database created, TLS connection string obtained
[ ] Sentry project created, DSN obtained
[ ] Generate SECRET_KEY (openssl rand -hex 64)
[ ] Generate ENCRYPTION_KEY (openssl rand -hex 32)
[ ] All env vars set in Railway dashboard
[ ] Railway connected to GitHub repo
[ ] Custom domain configured (DNS + SSL)
[ ] First deploy triggered (railway up or git push)
[ ] Health check passes: GET /health/live → 200
[ ] Readiness check passes: GET /health/ready → 200
[ ] Database migrations ran (check Railway deploy logs)
[ ] Sentry receiving events (trigger a test error)
[ ] Cloudflare proxy enabled (orange cloud)
[ ] WAF rules configured
```

---

## 8. Post-Deploy Verification

### 8.1 Full Health Check

```bash
API="https://api.omniflow.app"

# Liveness
curl -s "$API/health/live" | python -m json.tool

# Readiness
curl -s "$API/health/ready" | python -m json.tool

# Auth flow
TOKEN=$(curl -s -X POST "$API/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!@#$"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Authenticated endpoint
curl -s -H "Authorization: Bearer $TOKEN" "$API/api/v1/users/me" | python -m json.tool
```

### 8.2 Sentry Verification

```bash
# Trigger a test error (admin only)
curl -X POST "$API/api/v1/admin/sentry-test" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check Sentry dashboard for the event
```

### 8.3 Performance Baseline

Expected response times (P95):
- `GET /health/live` → < 50ms
- `GET /health/ready` → < 200ms
- `POST /auth/login` → < 500ms
- `GET /dashboard/summary` → < 800ms (cached)

---

## 9. Database Migrations

### 9.1 Automatic (Default)

Migrations run automatically via Railway's `releaseCommand`:
```toml
[deploy]
releaseCommand = "cd /app && alembic upgrade head"
```

This runs **before** the new version receives traffic (zero-downtime).

### 9.2 Manual Migration

```bash
# Via Railway CLI
railway run alembic upgrade head

# Check current revision
railway run alembic current

# Migration history
railway run alembic history --verbose
```

### 9.3 Neon Branching for Safe Migrations

```bash
# 1. Create a branch from production
neon branches create --name migration-test --parent main

# 2. Run migration on branch
DATABASE_URL="<branch-url>" alembic upgrade head

# 3. Verify data integrity
DATABASE_URL="<branch-url>" python -c "
from sqlalchemy import create_engine, text
e = create_engine('<branch-url-sync>')
with e.connect() as c:
    tables = c.execute(text(\"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\")).scalar()
    print(f'Tables: {tables}')
"

# 4. If OK, run on production
railway run alembic upgrade head

# 5. Clean up branch
neon branches delete migration-test
```

---

## 10. Rollback Procedures

### 10.1 Application Rollback

```bash
# Railway keeps previous deployments
# Go to Dashboard → Deployments → Click previous deploy → Redeploy
```

### 10.2 Database Rollback

```bash
# Downgrade one revision
railway run alembic downgrade -1

# Downgrade to specific revision
railway run alembic downgrade <revision_id>
```

### 10.3 Neon Point-in-Time Recovery

```bash
# Restore to specific timestamp (last 7 days on Pro)
neon branches create --name recovery --parent main --restore-time "2025-01-15T10:00:00Z"
```

---

## 11. Monitoring & Alerts

### 11.1 Sentry Dashboards

- **Errors**: Real-time error tracking with stack traces
- **Performance**: P50/P75/P95/P99 latency per endpoint
- **Profiles**: CPU flame graphs on 10% of traces

### 11.2 Railway Metrics

- **CPU/Memory**: Dashboard → Metrics tab
- **Deploy Logs**: Dashboard → Deployments → Logs
- **Alerts**: Configure in Settings → Notifications

### 11.3 Upstash Monitoring

- **Commands/sec**: Dashboard → Analytics
- **Memory Usage**: Dashboard → Analytics
- **Slow Commands**: Built-in slow log

### 11.4 Neon Monitoring

- **Query Performance**: `pg_stat_statements` extension
- **Connection Count**: Dashboard → Monitoring
- **Storage Usage**: Dashboard → Usage

---

## 12. Cost Estimation

### Monthly costs (Beta phase, ~100 users)

| Service       | Plan      | Cost/month | Notes                           |
|---------------|-----------|------------|--------------------------------|
| Railway       | Hobby     | ~$5        | $5 credit included             |
| Neon          | Free      | $0         | 0.5 GB storage, auto-suspend  |
| Upstash       | Free      | $0         | 10k commands/day               |
| Sentry        | Developer | $0         | 5k errors/month                |
| Cloudflare    | Free      | $0         | DNS + SSL + WAF basics         |
| **Total**     |           | **~$5**    |                                |

### Growth phase (~1,000 users)

| Service       | Plan      | Cost/month | Notes                           |
|---------------|-----------|------------|--------------------------------|
| Railway       | Pro       | ~$20       | Auto-scale, more resources     |
| Neon          | Launch    | ~$19       | 10 GB, branching, PITR         |
| Upstash       | Pro       | ~$10       | Unlimited commands              |
| Sentry        | Team      | ~$26       | 50k errors, performance        |
| Cloudflare    | Pro       | ~$20       | WAF + Bot Management            |
| **Total**     |           | **~$95**   |                                |
