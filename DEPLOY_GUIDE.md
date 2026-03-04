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

## Étape 1 — Créer le dépôt GitHub

Le repo git est déjà initialisé. Il faut maintenant le connecter à GitHub.

### 1.1 Créer le repo sur GitHub

1. Va sur **https://github.com/new**
2. Repository name : `omniflow` (ou le nom que tu veux)
3. Visibility : **Private** (recommandé — contient ton code source)
4. **NE COCHE PAS** "Add a README" ni ".gitignore" (on a déjà tout)
5. Click **Create repository**

### 1.2 Push le code

Ouvre un terminal PowerShell dans le dossier du projet :

```powershell
cd "c:\Users\altaf\OneDrive\Documents\Omniflow-woob"

# Ajouter le remote (remplace TON_USER par ton username GitHub)
git remote add origin https://github.com/TON_USER/omniflow.git

# Premier commit
git add .
git commit -m "feat: OmniFlow v0.5.0 — full-stack FinTech app"

# Push
git push -u origin main
```

> **Vérification** : Va sur `https://github.com/TON_USER/omniflow` — tu dois voir tout le code.

---

## Étape 2 — Créer la base de données (Neon PostgreSQL)

### 2.1 Créer le compte

1. Va sur **https://neon.tech**
2. Click **Sign Up** → utilise ton compte GitHub (plus rapide)
3. Accepte les conditions

### 2.2 Créer le projet

1. Click **Create Project**
2. **Project name** : `omniflow`
3. **Region** : `EU (Frankfurt)` — `eu-central-1`
4. **PostgreSQL version** : `16`
5. Click **Create Project**

### 2.3 Récupérer la connection string

1. Sur la page du projet, tu vois **Connection Details**
2. Sélectionne le mode **Direct Connection**
3. Copie la connection string
4. **IMPORTANT** : Modifie le préfixe :
   - Neon donne : `postgres://neondb_owner:xxxxx@ep-cool-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - Tu dois changer en : `postgresql+asyncpg://neondb_owner:xxxxx@ep-cool-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - (Remplace `postgres://` par `postgresql+asyncpg://`)

> **Garde cette URL** — tu en auras besoin à l'étape 5.

---

## Étape 3 — Créer le cache Redis (Upstash)

### 3.1 Créer le compte

1. Va sur **https://upstash.com**
2. Click **Sign Up** → utilise ton compte GitHub

### 3.2 Créer la database Redis

1. Click **Create Database**
2. **Name** : `omniflow-redis`
3. **Region** : `EU-West-1 (Ireland)` (le plus proche de Frankfurt)
4. **TLS** : Enabled (par défaut)
5. Click **Create**

### 3.3 Récupérer l'URL Redis

1. Sur la page de la database, va dans l'onglet **Details**
2. Copie la **Redis URL** (format `rediss://default:xxxxx@eu1-xxx.upstash.io:6379`)
3. **Vérifie** que ça commence par `rediss://` (avec 2 s = TLS activé)

> **Garde cette URL** — tu en auras besoin à l'étape 5.

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
2. **Connect Repository** → sélectionne `omniflow`
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
| `DATABASE_URL` | `postgresql+asyncpg://...` (ton URL Neon de l'étape 2) |
| `DB_POOL_SIZE` | `5` |
| `DB_MAX_OVERFLOW` | `10` |
| `DB_POOL_RECYCLE` | `300` |
| `REDIS_URL` | `rediss://...` (ton URL Upstash de l'étape 3) |
| `REDIS_MAX_CONNECTIONS` | `10` |
| `SECRET_KEY` | *(voir ci-dessous)* |
| `ENCRYPTION_KEY` | *(voir ci-dessous)* |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `BCRYPT_ROUNDS` | `13` |
| `ALLOWED_ORIGINS` | `["https://omniflow-web.vercel.app"]` |
| `WEB_CONCURRENCY` | `2` |
| `RATE_LIMIT_PER_MINUTE` | `60` |
| `OPENAI_API_KEY` | *(ta clé OpenAI, ou laisse vide pour désactiver l'IA)* |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `AI_DAILY_LIMIT` | `20` |
| `SENTRY_DSN` | *(ton DSN backend de l'étape 4, ou laisse vide)* |
| `SENTRY_ENVIRONMENT` | `production` |

### 5.4 Générer SECRET_KEY et ENCRYPTION_KEY

Ouvre un terminal PowerShell et exécute :

```powershell
# SECRET_KEY (64 caractères hex — obligatoire, sinon le backend refuse de démarrer)
python -c "import secrets; print(secrets.token_hex(64))"

# ENCRYPTION_KEY (32 caractères hex — obligatoire)
python -c "import secrets; print(secrets.token_hex(32))"
```

Copie les résultats dans les variables Render correspondantes.

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
2. **Import Git Repository** → sélectionne `omniflow`
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
| `NEXT_PUBLIC_SENTRY_DSN` | *(ton DSN frontend de l'étape 4, ou laisse vide)* |
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
📦 GitHub Repo     : https://github.com/TON_USER/omniflow
🌐 Frontend        : https://omniflow-web.vercel.app
⚡ Backend API     : https://omniflow-api.onrender.com
📊 API Docs        : https://omniflow-api.onrender.com/docs
🐘 Database        : Neon (eu-central-1) — console.neon.tech
🔴 Redis           : Upstash — console.upstash.com
🐛 Error Tracking  : Sentry — sentry.io
🔄 CI/CD           : GitHub Actions — github.com/TON_USER/omniflow/actions
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

- [ ] GitHub repo créé et code pushé
- [ ] Neon PostgreSQL créé (eu-central-1) — `DATABASE_URL` copiée
- [ ] Upstash Redis créé (eu-west-1) — `REDIS_URL` copiée
- [ ] Sentry projets créés (optionnel) — 2 DSN copiés
- [ ] Render Web Service créé — toutes les env vars ajoutées — `SECRET_KEY` et `ENCRYPTION_KEY` générées
- [ ] Migrations Alembic exécutées (via Render Shell)
- [ ] Backend accessible : `/health/live` retourne `{"status": "ok"}`
- [ ] Vercel projet créé — root directory `apps/web` — env vars ajoutées
- [ ] Frontend accessible et connecté au backend
- [ ] CORS vérifié (pas d'erreur dans la console)
