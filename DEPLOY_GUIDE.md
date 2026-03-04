# OmniFlow — Guide de Déploiement 100% Gratuit

> **Coût total : 0€/mois** — Tous les services utilisent des free tiers sans carte bancaire requise.
>
> **Temps estimé : 30-45 minutes** pour tout mettre en ligne.

---

## Architecture de Production

```
┌─────────────────────────────────────────────────────────────┐
│                    UTILISATEUR (navigateur)                  │
│                          │                                  │
│                 https://omniflow-web.vercel.app              │
│                          │                                  │
│              ┌───────────┴───────────┐                      │
│              │                       │                      │
│    ┌─────────▼─────────┐   ┌────────▼────────┐             │
│    │    Vercel (CDN)    │   │  Render (API)   │             │
│    │  Next.js Frontend  │   │  FastAPI Docker  │             │
│    │   FREE Hobby       │   │  FREE 750h/mo   │             │
│    └────────────────────┘   └───────┬─────────┘             │
│                                     │                       │
│                          ┌──────────┼──────────┐            │
│                          │          │          │            │
│                    ┌─────▼───┐ ┌────▼────┐ ┌──▼──────┐     │
│                    │  Neon   │ │ Upstash │ │ Sentry  │     │
│                    │Postgres │ │  Redis  │ │  APM    │     │
│                    │ FREE    │ │  FREE   │ │  FREE   │     │
│                    └─────────┘ └─────────┘ └─────────┘     │
└─────────────────────────────────────────────────────────────┘
```

| Service | Free Tier | Limite |
|---------|-----------|--------|
| **Vercel** | Hobby (sans CB) | Unlimited deploys, 100GB bandwidth |
| **Render** | Free (sans CB) | 750h/mois, 512MB RAM, auto-sleep 15min |
| **Neon** | Free (sans CB) | 0.5 GB storage, 1 projet, auto-suspend |
| **Upstash** | Free (sans CB) | 10,000 commandes/jour, 256MB |
| **Sentry** | Developer (sans CB) | 5,000 events/mois |
| **GitHub** | Free | Repos illimités, 2000 min CI/mois |

> **Note sur Render Free** : Le backend se met en veille après 15 min d'inactivité. La première requête après veille prend ~30-60s (cold start). C'est normal pour un tier gratuit. Les requêtes suivantes sont instantanées.

---

## Pré-requis

- **Git** installé sur ta machine
- **Un compte GitHub** (gratuit)
- **Un navigateur** pour créer les comptes services

---

## Étape 1 — Créer le dépôt GitHub ✅ FAIT

Le code est déjà pushé sur GitHub : **https://github.com/danielaltaf-stack/omniflow**

> **Vérification** : Va sur https://github.com/danielaltaf-stack/omniflow — tu dois voir tout le code (457 fichiers, Python 52.5% + TypeScript 46.2%).

---

## Étape 2 — Base de données (Neon PostgreSQL) ✅ FAIT

Neon est déjà créé. Voici l'URL convertie pour l'app :

```
postgresql+asyncpg://neondb_owner:npg_f06oAsBkGmXL@ep-hidden-fire-agkq2kay-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

> **Note** : Le préfixe a été converti de `postgresql://` en `postgresql+asyncpg://` et `channel_binding=require` a été retiré (non supporté par asyncpg). C'est cette URL qu'il faut mettre dans `DATABASE_URL` sur Render.

---

## Étape 3 — Cache Redis (Upstash) ✅ FAIT

Upstash configuré : `vast-koala-21919.upstash.io` (TLS, free tier).

```
REDIS_URL=rediss://default:AVWfAAIncDI0NDAyNmNmMGNkZTA0MzhhOTBkMmYyNzgxZmNmODljZXAyMjE5MTk@vast-koala-21919.upstash.io:6379
```

> Déjà pré-rempli dans le `.env`. Rien à faire ici.

---

## Étape 4 — Créer le monitoring (Sentry)

> Cette étape est optionnelle. Si tu la skip, l'app fonctionne quand même (Sentry se désactive automatiquement si pas de DSN).

### 4.1 Créer le compte

1. Va sur **https://sentry.io/signup/**
2. Crée un compte (gratuit)
3. Organisation name : `omniflow`

### 4.2 Créer le projet backend

1. Click **Create Project**
2. Platform : **Python** → **FastAPI**
3. Project name : `omniflow-api`
4. Click **Create Project**
5. Copie le **DSN** affiché (format `https://abc123@o123456.ingest.sentry.io/111111`)

### 4.3 Créer le projet frontend

1. Même chose, **Create Project**
2. Platform : **JavaScript** → **Next.js**
3. Project name : `omniflow-web`
4. Copie le **DSN** (différent du backend)

> **Garde les 2 DSN** — tu en auras besoin aux étapes 5 et 6.

---

## Étape 5 — Déployer le Backend sur Render (GRATUIT)

### 5.1 Créer le compte

1. Va sur **https://render.com**
2. Click **Get Started for Free** → **Sign up with GitHub**
3. Autorise l'accès à ton repo `omniflow`

### 5.2 Créer le Web Service

1. Click **New** → **Web Service**
2. **Connect Repository** → sélectionne `danielaltaf-stack/omniflow`
3. Configure :
   - **Name** : `omniflow-api`
   - **Region** : `Frankfurt (EU Central)`
   - **Root Directory** : `apps/api`
   - **Runtime** : `Docker`
   - **Instance Type** : **Free** ← IMPORTANT
4. Click **Create Web Service**

### 5.3 Ajouter les variables d'environnement

Dans le dashboard Render du service `omniflow-api`, va dans **Environment** → **Add Environment Variable** :

| Variable | Valeur |
|----------|--------|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `LOG_LEVEL` | `WARNING` |
| `LAUNCH_MODE` | `beta` |
| `DATABASE_URL` | `postgresql+asyncpg://neondb_owner:npg_f06oAsBkGmXL@ep-hidden-fire-agkq2kay-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require` |
| `DB_POOL_SIZE` | `5` |
| `DB_MAX_OVERFLOW` | `10` |
| `DB_POOL_RECYCLE` | `300` |
| `REDIS_URL` | `rediss://default:AVWfAAIncDI0NDAyNmNmMGNkZTA0MzhhOTBkMmYyNzgxZmNmODljZXAyMjE5MTk@vast-koala-21919.upstash.io:6379` |
| `REDIS_MAX_CONNECTIONS` | `10` |
| `SECRET_KEY` | `3ab7fec5fb37a17f8a7e36d6736c1cbb4b81c49d27b141b9068d62144baca9a79bd687a0033fb5679a62e3c1526a51bc2daf109ca90f165f2f7e29fe9b1b3e83` |
| `ENCRYPTION_KEY` | `4189683dec0113ac76b9ef62e97329b5fb6a2f2b86a111cfb859c71559f5222c` |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `BCRYPT_ROUNDS` | `13` |
| `ALLOWED_ORIGINS` | `["https://omniflow-web.vercel.app","https://omniflow-danielaltaf-stacks-projects.vercel.app"]` |
| `WEB_CONCURRENCY` | `2` |
| `RATE_LIMIT_PER_MINUTE` | `60` |
| `AI_PROVIDERS` | *(copie la valeur depuis ton fichier `.env` local — contient tes clés Groq + Gemini)* |
| `OPENAI_API_KEY` | *(copie depuis ton `.env` local — ta clé OpenAI `sk-proj-...`)* |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `AI_DAILY_LIMIT` | `20` |
| `SENTRY_DSN` | *(laisse vide — Sentry est optionnel et l'app marchera sans)* |
| `SENTRY_ENVIRONMENT` | `production` |

### 5.4 Clés de sécurité ✅ GÉNÉRÉES

Les clés ont déjà été générées. Utilise-les dans Render :

```
SECRET_KEY=3ab7fec5fb37a17f8a7e36d6736c1cbb4b81c49d27b141b9068d62144baca9a79bd687a0033fb5679a62e3c1526a51bc2daf109ca90f165f2f7e29fe9b1b3e83
ENCRYPTION_KEY=4189683dec0113ac76b9ef62e97329b5fb6a2f2b86a111cfb859c71559f5222c
```

> **IMPORTANT** : Ces clés sont uniques et irremplaçables. Si tu les perds, les données chiffrées en base seront irrécupérables. Note-les quelque part de sûr.

### 5.5 Lancer le déploiement

1. Click **Manual Deploy** → **Deploy latest commit**
2. Attends ~5-10 minutes (le premier build Docker est long car il installe les 34 modules bancaires Woob)
3. Render affiche une URL : `https://omniflow-api.onrender.com` (ou similaire)
4. **Copie cette URL** — tu en auras besoin à l'étape 6

### 5.6 Vérifier le backend

Ouvre dans ton navigateur :
- `https://omniflow-api.onrender.com/health/live` → doit afficher `{"status": "ok"}`
- `https://omniflow-api.onrender.com/docs` → Swagger UI de l'API

> **Note** : Si tu obtiens une erreur 503, attends quelques minutes — le premier build est long. Vérifie les logs dans Render Dashboard → Logs.

### 5.7 Exécuter les migrations de base de données

Les migrations Alembic doivent être exécutées une fois. Dans Render Dashboard :

1. Va dans ton service → **Shell**
2. Exécute : `cd /app && alembic upgrade head`
3. Tu devrais voir les 25 migrations s'exécuter

> Alternative : Si tu as accès au shell, tu peux aussi le faire via le Render CLI ou ajouter `alembic upgrade head` dans un script de démarrage.

---

## Étape 6 — Déployer le Frontend sur Vercel (GRATUIT)

### 6.1 Créer le compte

1. Va sur **https://vercel.com**
2. Click **Sign Up** → **Continue with GitHub**
3. Autorise l'accès

### 6.2 Importer le projet

1. Click **Add New...** → **Project**
2. **Import Git Repository** → sélectionne `danielaltaf-stack/omniflow`
3. Configure :
   - **Framework Preset** : `Next.js` (auto-détecté grâce au `vercel.json`)
   - **Root Directory** : `apps/web` ← IMPORTANT, click **Edit** et tape `apps/web`
   - **Build Command** : `npm run build` (défaut — laisse tel quel)
   - **Output Directory** : `.next` (défaut)

### 6.3 Ajouter les variables d'environnement

Avant de déployer, ajoute ces variables dans la section **Environment Variables** :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://omniflow-api.onrender.com` (ton URL Render de l'étape 5.5) |
| `NEXT_PUBLIC_APP_URL` | `https://omniflow-web.vercel.app` (sera mis à jour après deploy) |
| `NEXT_PUBLIC_APP_VERSION` | `0.5.0` |
| `NEXT_PUBLIC_SENTRY_DSN` | *(laisse vide — l'app marchera parfaitement sans)* |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` |

### 6.4 Déployer

1. Click **Deploy**
2. Attends ~2-3 minutes
3. Vercel affiche l'URL : `https://omniflow-web.vercel.app` (ou nom personnalisé)
4. **C'EST EN LIGNE !** 🎉

### 6.5 Mettre à jour l'URL CORS backend

Maintenant que tu connais l'URL Vercel exacte :

1. Retourne dans **Render Dashboard** → ton service → **Environment**
2. Mets à jour `ALLOWED_ORIGINS` avec ton URL Vercel exacte :
   ```
   ["https://omniflow-web.vercel.app"]
   ```
   (Remplace par le vrai sous-domaine si Vercel t'a donné un nom différent)
3. Render va re-déployer automatiquement

### 6.6 Mettre à jour NEXT_PUBLIC_APP_URL

1. Retourne dans **Vercel Dashboard** → Project Settings → Environment Variables
2. Mets à jour `NEXT_PUBLIC_APP_URL` avec la vraie URL Vercel
3. Click **Redeploy** (Deployments → ... → Redeploy)

---

## Étape 7 — Configurer le CI/CD GitHub Actions (OPTIONNEL)

> Le CI/CD est déjà configuré. Les tests et le build tournent automatiquement à chaque push. Le deploy automatique est optionnel — Render et Vercel auto-déploient déjà sur chaque push à `main`.

### 7.1 Pour activer le deploy automatique via CI (optionnel)

Si tu veux que GitHub Actions déclenche les déploiements (au lieu du auto-deploy Render/Vercel) :

1. Va sur GitHub → ton repo → **Settings** → **Secrets and variables** → **Actions**
2. Ajoute ces **Secrets** :

| Secret | Où le trouver |
|--------|---------------|
| `DEPLOY_WEBHOOK_URL` | Render Dashboard → Service → Settings → Deploy Hook → Copy URL |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens → Create new (scope: `project:releases`) |

3. Ajoute ces **Variables** :

| Variable | Valeur |
|----------|--------|
| `DEPLOY_API_URL` | `https://omniflow-api.onrender.com` |
| `SENTRY_ORG` | `omniflow` (ou ton nom d'org Sentry) |
| `SENTRY_PROJECT` | `omniflow-api` |

### 7.2 Ce qui se passe automatiquement

A chaque `git push main`, GitHub Actions exécute 6 jobs :

```
backend-lint ─────────→ backend-test ────┐
frontend-quality ─────→ frontend-build ──┼──→ deploy (si tout passe)
security-scan ───────────────────────────┘
```

Sans les secrets configurés, les jobs 1-5 (lint, test, build, security) tournent normalement. Le job 6 (deploy) skip les étapes webhook/health/sentry gracefully.

---

## Étape 8 — Vérification finale

### 8.1 Tester le backend

Ouvre dans un navigateur :

```
https://omniflow-api.onrender.com/health/live
```

Réponse attendue : `{"status": "ok"}`

```
https://omniflow-api.onrender.com/health/ready
```

Réponse attendue : `{"status": "ok", "database": "connected", "redis": "connected"}`

```
https://omniflow-api.onrender.com/docs
```

→ Swagger UI complète de l'API

### 8.2 Tester le frontend

Ouvre dans un navigateur :

```
https://omniflow-web.vercel.app
```

→ L'application OmniFlow doit se charger

### 8.3 Tester la connexion frontend → backend

Dans la console du navigateur (F12) sur ton frontend :

```javascript
fetch('https://omniflow-api.onrender.com/health/live')
  .then(r => r.json())
  .then(console.log)
```

→ Doit afficher `{status: "ok"}` sans erreur CORS

### 8.4 Créer un compte test

1. Sur le frontend, click **S'inscrire**
2. Crée un compte avec un email test
3. Si tout fonctionne, le compte est créé dans Neon PostgreSQL

---

## Résumé des comptes et URLs

Une fois tout déployé, note ces informations :

```
📦 GitHub Repo     : https://github.com/danielaltaf-stack/omniflow
🌐 Frontend        : https://omniflow-web-sigma.vercel.app
⚡ Backend API     : https://omniflow-api-g6p2.onrender.com
📊 API Docs        : https://omniflow-api-g6p2.onrender.com/docs (désactivé en prod)
🐘 Database        : Neon (eu-central-1) — console.neon.tech
🔴 Redis           : Upstash (vast-koala-21919) — console.upstash.com
🐛 Error Tracking  : Sentry (optionnel) — sentry.io
🔄 CI/CD           : GitHub Actions — github.com/danielaltaf-stack/omniflow/actions
```

---

## Troubleshooting

### Le backend retourne 503 (Service Unavailable)

- **Cause** : Render free tier — le service est en veille (cold start après 15 min d'inactivité)
- **Solution** : Attends 30-60 secondes, relance la requête. Le service se réveille automatiquement.
- **Astuce** : Utilise [UptimeRobot](https://uptimerobot.com/) (gratuit — 50 monitors) pour pinger `https://omniflow-api.onrender.com/health/live` toutes les 14 minutes et éviter le cold start.

### Erreur CORS (blocked by CORS policy)

- **Cause** : L'URL du frontend n'est pas dans `ALLOWED_ORIGINS` du backend
- **Solution** : Dans Render → Environment → mets à jour `ALLOWED_ORIGINS` :
  ```
  ["https://omniflow-web.vercel.app","https://ton-custom-domain.com"]
  ```

### Build Docker échoue sur Render

- **Cause possible** : Mémoire insuffisante (512MB free tier)
- **Solution** : Le Dockerfile est optimisé en multi-stage. Si ça échoue, vérifie les logs Render. La plupart du temps c'est un timeout — relance le build.

### Migrations Alembic échouent

- **Cause** : `DATABASE_URL` mal formatée ou base inaccessible
- **Vérification** :
  - L'URL commence par `postgresql+asyncpg://` (pas `postgres://`)
  - Elle contient `?sslmode=require` à la fin
  - Le host est bien celui de Neon (`.neon.tech`)

### Le frontend build échoue sur Vercel

- **Cause probable** : Variable `NEXT_PUBLIC_API_URL` manquante
- **Solution** : Vérifie que toutes les variables sont configurées dans Vercel → Project Settings → Environment Variables

### L'IA ne fonctionne pas (endpoints /ai/ retournent 500)

- **Cause** : `OPENAI_API_KEY` vide ou invalide
- **Solution** : Ajoute une clé API OpenAI valide dans Render. L'app fonctionne normalement sans IA — les autres fonctionnalités (comptes bancaires, budget, analytics) marchent sans.

---

## Mises à jour futures

Pour déployer une mise à jour, il suffit de :

```powershell
git add .
git commit -m "feat: description de la mise à jour"
git push origin main
```

- **Vercel** re-build automatiquement le frontend (~2 min)
- **Render** re-build automatiquement le backend (~5-10 min, premier build plus long)
- **GitHub Actions** lance les tests et scans de sécurité

---

## Checklist rapide

- [x] GitHub repo créé et code pushé → https://github.com/danielaltaf-stack/omniflow
- [x] Neon PostgreSQL créé (eu-central-1) — `DATABASE_URL` prête
- [x] Clés de sécurité générées (`SECRET_KEY` + `ENCRYPTION_KEY`)
- [x] **Upstash Redis** configuré — `rediss://...@vast-koala-21919.upstash.io:6379`
- [x] **Render** Web Service créé — 24 env vars configurées → https://omniflow-api-g6p2.onrender.com
- [x] **Migrations Alembic** — 28 migrations exécutées sur Neon
- [x] Backend accessible : `/health/ready` → `{"status": "ready", "database": "ok", "redis": "ok"}`
- [x] **Vercel** projet déployé — root directory `apps/web` → https://omniflow-web-sigma.vercel.app
- [x] Frontend accessible (200, 142K chars)
- [ ] CORS vérifié (tester dans la console F12 du navigateur)
