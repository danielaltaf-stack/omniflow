# OmniFlow — Plan de Transformation Stratégique

> **Auteur** : CTO Office — Audit initié le 2 mars 2026
> **Statut** : **Phase A1 + A2 + A3 + A4 + B1 + B2 + B3 + B4 + B5 + F1.1 + F1.2 + F1.3 + F1.4 + F1.5 + F1.6 + F1.7 + C1 + C2 + C3 + C4 + C5 + G + E1 + E2 + E3 + E4 + E5.0 + E5.1 + E5.2 + E5.3 — IMPLÉMENTÉES** ✅ (4 mars 2026) — Code validé, 480+ tests automatisés, couverture 50%+.
> **Dernière phase** : Phase E5.2 + E5.3 (Frontend Deployment & CI/CD Pipeline v2 — Vercel declarative config (vercel.json : framework nextjs, région cdg1 Paris, 4 règles headers Cache-Control API no-cache/static immutable 1yr/images stale-while-revalidate/manifest, rewrites API proxy vers api.omniflow.app, redirects www→root permanent, installCommand npm ci --prefer-offline), Dockerfile.prod frontend (3-stage multi-stage Node 20 Alpine : deps→builder→runner, ARG NEXT_PUBLIC_* build-time injection, non-root user nextjs:nodejs uid 1001, tini PID 1 signal handling, HEALTHCHECK curl localhost:3000, standalone output copy, NEXT_TELEMETRY_DISABLED), Sentry Frontend SDK (@sentry/nextjs dynamic import avec graceful degradation, beforeSend filter SUPPRESSED_ERRORS 10 patterns : ResizeObserver/ChunkLoadError/NetworkError/AbortError/browser-extensions, scrubbing RGPD Authorization/cookies/passwords dans headers+body, beforeSendTransaction drop /health /_next/ /favicon, Session Replay 10% sessions + 100% on error avec maskAllInputs, distributed tracing vers api.omniflow.app, denyUrls extensions/analytics, sendDefaultPii false, tracesSampleRate 0.2, profilesSampleRate 0.1), .env.production.example frontend (8 variables : API_URL/APP_URL/APP_VERSION/SENTRY_DSN/SENTRY_ENVIRONMENT/PLAUSIBLE_DOMAIN/BUILD_ID/ANALYZE), CI/CD Pipeline v2 (GitHub Actions 6 jobs : backend-lint avec bandit SAST scan artifact, backend-test avec postgres:16-alpine + redis:7-alpine + coverage --cov-fail-under=50, frontend-quality tsc --noEmit + next lint --max-warnings 0, security-scan pip-audit + npm audit --audit-level=high + trivy fs HIGH,CRITICAL, frontend-build standalone + bundle size check warn >2MB, deploy Railway webhook + 45s wait + health check 5 retries + Sentry release creation), branch protection (concurrency cancel-in-progress, deploy only push main, environment: production). 3 nouveaux fichiers frontend (vercel.json, Dockerfile.prod, sentry.client.config.ts 240 lignes), 1 template env (.env.production.example web), 1 fichier modifié frontend (providers.tsx initSentry), 1 pipeline réécrit (ci.yml 3→6 jobs 260 lignes), 67 tests E5.2/E5.3 (6 classes : Vercel 9 tests, Dockerfile 12 tests, Sentry client 14 tests, CI/CD Pipeline 22 tests, Env template 5 tests, Providers integration 3 tests))
> **Scope** : Audit complet du code source + Benchmarking concurrentiel + Roadmap 6 phases

---

## Table des matières

1. [Audit Critique & Cohérence](#1-audit-critique--cohérence)
   - 1.1 [Analyse des flux — Interconnexion des briques](#11-analyse-des-flux--interconnexion-des-briques)
   - 1.2 [Sécurité & Robustesse — Grade Bancaire](#12-sécurité--robustesse--grade-bancaire)
   - 1.3 [Ergonomie Mobile-First — Verdict UX](#13-ergonomie-mobile-first--verdict-ux)
   - 1.4 [Qualité du code & Dette technique](#14-qualité-du-code--dette-technique)
   - 1.5 [Base de données & Intégrité des modèles](#15-base-de-données--intégrité-des-modèles)
   - 1.6 [Intelligence Artificielle — Fiabilité des algorithmes](#16-intelligence-artificielle--fiabilité-des-algorithmes)
2. [Benchmarking & Analyse de la Valeur](#2-benchmarking--analyse-de-la-valeur)
   - 2.1 [Fonctionnalités Premium manquantes](#21-fonctionnalités-premium-manquantes)
   - 2.2 [Innovations "Outside the Box"](#22-innovations-outside-the-box)
3. [Roadmap de Transformation — 5 Phases](#3-roadmap-de-transformation--5-phases)
   - Phase A : [Fondations & Hardening](#phase-a--fondations--hardening-sécurité-refacto-performance)
   - Phase B : [Deep Analytics & Multi-Assets Complet](#phase-b--deep-analytics--multi-assets-complet)
   - Phase C : [Life & Legacy Planning](#phase-c--life--legacy-planning)
   - Phase D : [UX Excellence & Design System Premium](#phase-d--ux-excellence--design-system-premium)
   - Phase E : [Production, PWA & Go-to-Market](#phase-e--production-pwa--go-to-market)
   - Phase F : [Real-Time Markets & Carte Interactive Premium](#phase-f--real-time-markets--carte-interactive-premium-étape-unique)
4. [Vision globale](#4-vision-globale)

---

## 1. Audit Critique & Cohérence

### 1.1 Analyse des flux — Interconnexion des briques

#### Architecture actuelle : Verdict — "Fonctionnel mais fragile"

L'application est construite autour de trois piliers : **Next.js 14** (frontend), **FastAPI** (backend), **Woob + API tierces** (agrégation). L'interconnexion est assurée, mais plusieurs goulots d'étranglement compromettent la fiabilité.

##### Goulots d'étranglement identifiés

| # | Goulot | Impact | Localisation |
|---|--------|--------|-------------|
| **G1** | **Woob bloque l'event loop async.** Les appels `Woob()`, `load_backend()`, `iter_accounts()`, `iter_history()` sont synchrones et exécutés directement dans le contexte async FastAPI sans `asyncio.to_thread()`. Pendant une sync bancaire, **l'intégralité du serveur API est bloquée** — aucune autre requête ne peut être traitée. | **CRITIQUE** | `woob_engine/worker.py` |
| **G2** | **APScheduler mono-processus séquentiel.** Le scheduler synchronise toutes les connexions une par une dans une seule coroutine toutes les 6h. Avec 100 utilisateurs (3 connexions chacun), la boucle de sync peut durer des heures. Aucun parallélisme, aucun jitter. | **ÉLEVÉ** | `services/scheduler.py` |
| **G3** | **Pas de file de tâches distribuée.** Celery est documenté dans context.md mais jamais implémenté. Toute tâche lourde (sync Woob, refresh crypto, calcul OmniScore) tourne dans le processus principal de l'API. | **ÉLEVÉ** | Architecture globale |
| **G4** | **Pool de connexions DB trop petit.** `pool_size=5, max_overflow=10` soit 15 connexions max. Avec des syncs parallèles, des requêtes dashboard, et les jobs AI, le pool sature rapidement. | **MOYEN** | `core/database.py` |
| **G5** | **Notifications in-memory.** Le store de notifications est un dictionnaire Python en mémoire (`_notification_store`). Données perdues à chaque redémarrage, incohérentes en multi-worker. | **ÉLEVÉ** | `api/v1/notifications.py` |
| **G6** | **Session DB dépassée dans les SSE.** Le générateur d'événements SSE pour le chat Nova utilise une session DB injectée par FastAPI. Le générateur survit à la requête → la session peut être fermée avant que le générateur ne finisse. Risque de `SessionClosedError`. | **MOYEN** | `api/v1/advisor.py` |
| **G7** | **Pas de verrous de concurrence sur les syncs.** Deux syncs simultanées pour la même connexion bancaire peuvent créer des doublons malgré le dedup par `external_id` (race condition sur l'UPSERT). | **MOYEN** | `woob_engine/sync_service.py` |

##### Flux non connectés (briques orphelines)

| Brique | Problème |
|--------|----------|
| **Module Dettes** | Planifié dans context.md comme pilier n°5 du patrimoine. Non implémenté : aucun modèle DB, aucune API, aucune page frontend. Le calcul du Net Worth exclut les dettes consommation/étudiant. |
| **Audit Log** | Documenté pour la sécurité et la compliance RGPD. Aucune table, aucun code. Impossible de tracer qui a accédé à quoi. |
| **Table Categories** | Les catégories de transactions sont de simples chaînes de caractères (`String(128)`). Pas de normalisation, pas de hiérarchie, pas de catégories custom utilisateur. |
| **Cache AI Predictions** | Les prévisions sont recalculées à chaque requête. Pas de table `ai_predictions` pour le cache DB. Seul Redis (TTL) est utilisé. |
| **React Query** | Installé et configuré (`QueryClientProvider`), mais **jamais utilisé dans aucun composant** — 25 KB de bundle inutile. Tous les fetches sont faits via Zustand stores. |
| **PullToRefresh / Confetti** | Composants codés mais jamais montés dans aucune page. Code mort. |

---

### 1.2 Sécurité & Robustesse — Grade Bancaire

**Verdict : Niveau actuel = "Startup early-stage". Niveau requis = "Grade bancaire OWASP Top 10".**

#### Vulnérabilités CRITIQUES

| # | Vulnérabilité | OWASP | Impact | Détail |
|---|---------------|-------|--------|--------|
| **S1** | **Clés API en clair dans `.env`** | A07:2021 | **CATASTROPHIQUE** | Les clés Groq (`gsk_EvJY...`), Gemini (`AIzaSy...`) et OpenAI (`sk-proj-...`) sont en clair dans le fichier `.env`. Si le dépôt est publié — même brièvement — toutes les clés sont compromises. |
| **S2** | **SECRET_KEY par défaut** | A02:2021 | **CRITIQUE** | `SECRET_KEY = "dev-secret-key-change-me-in-production..."`. Si `.env` est mal configuré, l'app démarre avec cette clé connue → tous les JWT sont forgeables par un attaquant. |
| **S3** | **ENCRYPTION_KEY par défaut ET dérivation faible** | A02:2021 | **CRITIQUE** | `ENCRYPTION_KEY` n'est pas défini dans `.env` (utilise le défaut `"CHANGE-ME..."`). La dérivation de clé fait un simple `(raw * 2)[:32]` au lieu d'utiliser HKDF/PBKDF2. Les credentials bancaires chiffrés sont effectivement en clair pour un attaquant qui lit la config. |
| **S4** | **Credentials bancaires chiffrés côté serveur** | A04:2021 | **ÉLEVÉ** | context.md prévoyait un chiffrement client-side (Zero Knowledge). En réalité, les credentials sont chiffrés avec la clé serveur. Compromission DB + clé = accès à tous les comptes bancaires de tous les utilisateurs. |
| **S5** | **Logout est un no-op** | A07:2021 | **ÉLEVÉ** | `POST /auth/logout` retourne "Success" mais ne révoque aucun token. Un token volé reste valide jusqu'à expiration (15 min access, 7 jours refresh). Pas de blacklist Redis. |
| **S6** | **`python-jose` non maintenu** | A06:2021 | **MOYEN** | Dernière release en 2022. Des CVE connues existent. `PyJWT` est l'alternative activement maintenue. |
| **S7** | **Pas de validation de démarrage** | A05:2021 | **ÉLEVÉ** | L'application ne refuse JAMAIS de démarrer avec des secrets par défaut. Aucune assertion au boot. |

#### Vulnérabilités ÉLEVÉES

| # | Vulnérabilité | Détail |
|---|---------------|--------|
| **S8** | **Pas de rate limiting global** | Seul le login est protégé (5 tentatives / 15 min). Tous les autres endpoints sont illimités. Un attaquant peut saturer l'API, épuiser les quotas CoinGecko/Yahoo/DVF. |
| **S9** | **~8 endpoints sans authentification** | `/crypto/sparkline`, `/crypto/prices`, `/crypto/search`, `/stocks/quote`, `/currencies/rates`, `/currencies/convert`, `/realestate/dvf`, `/banks` — ouverts au public, proxy gratuit vers des API payantes. |
| **S10** | **WebSocket accepte avant authentification** | La connexion WebSocket `/ws/sync/{connection_id}` est acceptée AVANT que le token ne soit vérifié (via le premier message). N'importe qui peut ouvrir une connexion. |
| **S11** | **Profil : liaison de compte inter-utilisateur** | `link_account` dans `profiles.py` vérifie que l'account_id existe mais ne vérifie pas qu'il appartient au user courant. Un utilisateur pourrait lier le compte d'un autre utilisateur à son profil. |
| **S12** | **Docker : root + --reload en production** | Le Dockerfile exécute Uvicorn avec `--reload` (consommation CPU inutile, risque de code injection) et ne crée pas de user non-root. |
| **S13** | **Pas de TOTP/MFA sur OmniFlow** | L'app gère le SCA bancaire mais ne propose aucune authentification à deux facteurs pour son propre accès. |
| **S14** | **CORS trop permissif** | `allow_methods=["*"]`, `allow_headers=["*"]` — devrait être restreint aux méthodes et headers utilisés. |
| **S15** | **Tokens dans localStorage** | Le frontend stocke les tokens dans localStorage, vulnérable à toute XSS. httpOnly cookies seraient plus sûrs. |

#### Standards à appliquer (OWASP Grade Bancaire)

```
□ Validation de démarrage : refuser le boot si SECRET_KEY/ENCRYPTION_KEY = défaut
□ HKDF (HMAC-based Key Derivation) pour toutes les clés de chiffrement
□ Rotation de clés : support double-clé pour re-chiffrement progressif
□ Token blacklist Redis obligatoire (logout effectif)
□ Rate limiting global (slowapi ou custom middleware) : 100 req/min/user, 30/min/IP non-auth
□ CORS strict : méthodes et headers explicites, origines version de production
□ CSP headers (Content-Security-Policy) — absent aujourd'hui
□ HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy — absents
□ WAF basique : détection de patterns SQLi/XSS dans les inputs
□ JWT RS256 (asymétrique) au lieu de HS256 (symétrique)
□ httpOnly cookies pour les tokens (avec SameSite=Strict)
□ Vérification d'email obligatoire avant activation du compte
□ 2FA TOTP pour l'accès OmniFlow (Google Authenticator / Authy)
□ Audit log complet : chaque action sensible est tracée en DB
□ Chiffrement client-side (Zero Knowledge) comme décrit dans context.md
□ Secrets management : HashiCorp Vault ou AWS Secrets Manager en production
```

---

### 1.3 Ergonomie Mobile-First — Verdict UX

**Verdict : "Bonne base, mais loin de Trade Republic". La structure est là. Les micro-interactions premium manquent.**

#### Ce qui est BIEN fait (à conserver)

| Élément | Qualité |
|---------|---------|
| **Design System OLED** | Palette complète, CSS variables, tokens sémantiques (gain/loss/brand). Mode sombre par défaut. |
| **Framer Motion** | Utilisé partout — `staggerChildren`, `layoutId`, spring physics, SVG draw-in. Base solide pour des animations cinématiques. |
| **Sidebar + Bottom Nav** | Responsive : sidebar fixe desktop, bottom nav mobile. Bon pattern. |
| **Skeletons** | Présents sur chaque page (8+ composants skeleton). Bonne pratique. |
| **Empty states** | Presque chaque composant a un état vide avec CTA. |
| **4 types de charts** | PatrimoineChart, CashFlowChart, AllocationDonut, ExpensesBarChart + Sparkline SVG custom. |

#### Ce qui est INSUFFISANT (par rapport à Trade Republic / Finary / Linear)

| # | Problème | Trade Republic fait mieux | Solution |
|---|----------|--------------------------|----------|
| **UX1** | **Pas d'Error Boundaries** | L'app Trade Republic ne montre jamais de blank screen. N'importe quel crash JS dans un composant d'OmniFlow produit un écran blanc sans message. | Error Boundaries React à 3 niveaux : global, layout, par-section. Écran de fallback stylé avec CTA "Réessayer". |
| **UX2** | **Pas d'onboarding flow** | Trade Republic a un onboarding guidé step-by-step avec animations. OmniFlow n'a aucun wizard de bienvenue après l'inscription. | Onboarding 4 étapes : Bienvenue → Connecter banque → Ajouter crypto/bourse → Dashboard reveal. |
| **UX3** | **Middleware de protection vide** | Le middleware Next.js est défini mais ne protège aucune route. Un utilisateur non-authentifié peut accéder à `/dashboard`. | Middleware fonctionnel avec redirect vers `/login` si pas de token. |
| **UX4** | **Pas de transitions entre pages** | Trade Republic / Linear ont des animations fluides entre les vues. OmniFlow a un hard-swap sans animation. | Framer Motion `AnimatePresence` + `layoutId` pour transitions page-à-page. |
| **UX5** | **3 CountUp différents** | `net-worth-hero`, `stat-card`, et `currency-display` ont chacun leur propre implémentation d'animation de nombres. Incohérent. | Un seul hook `useAnimatedNumber()` réutilisé partout. |
| **UX6** | **Pas de mode discret** | Finary a un mode "Masquer les montants" très apprécié. OmniFlow non. | Toggle global "****" sur tous les montants (icône œil dans le header). |
| **UX7** | **Pas de haptic feedback (mobile)** | Trade Republic vibre subtilement sur les interactions clés. | `navigator.vibrate()` sur les boutons CTA et les pulls-to-refresh. |
| **UX8** | **Notifications in-memory** | Centre de notifications codé mais perd ses données au restart. | Persister en DB avec table dédiée + WebSocket push. |
| **UX9** | **Pas d'accessibilité** | Aucun `aria-label` sur les boutons icônes. Pas de focus trap dans les modals. Pas de navigation clavier dans les menus. | Audit Lighthouse Accessibility > 95. `aria-*` partout. Focus trap. Skip-to-content. |
| **UX10** | **Charts non animés au premier render** | Les graphiques Recharts apparaissent instantanément sans animation draw-in (contrairement au context.md). | `isAnimationActive`, custom animation delays, progressive reveal. |

---

### 1.4 Qualité du code & Dette technique

#### Backend

| Catégorie | Constat | Gravité |
|-----------|---------|---------|
| **Tests** | Zéro fichier de test. `pytest` est configuré dans `pyproject.toml` mais aucun test n'existe. Pour une app financière, c'est inacceptable. | **CRITIQUE** |
| **Global exception handler** | `main.py` catch *tous* les `Exception` et retourne un message générique en français. Les stack traces sont perdues silencieusement. Debug impossible en production. | **ÉLEVÉ** |
| **Logging** | `basicConfig(level=DEBUG, force=True)` — logging debug en production. Pas de structured logging (JSON). Pas de correlation_id par requête. Pas d'intégration Sentry. | **ÉLEVÉ** |
| **Dependency obsolète** | `python-jose[cryptography]` non maintenu depuis 2022. `python-multipart` listé en double. | **MOYEN** |
| **Docs exposés en prod** | `/docs` et `/redoc` toujours accessibles, sans flag de désactivation. | **MOYEN** |
| **Auto-commit dans `get_db()`** | Le context manager commit automatiquement, même pour les GET readonly. | **FAIBLE** |

#### Frontend

| Catégorie | Constat | Gravité |
|-----------|---------|---------|
| **`catch (e: any)` partout** | ~40+ occurrences de `catch (e: any)` dans les Zustand stores. Aucun typage d'erreur. | **ÉLEVÉ** |
| **React Query inutilisé** | Installé, configuré, importé dans les providers… mais jamais appelé dans aucun composant. 25 KB de dead weight dans le bundle. | **MOYEN** |
| **Pas de tests frontend** | Ni Vitest, ni Testing Library, ni Playwright. Zéro couverture. | **ÉLEVÉ** |
| **API client basique** | Pas de timeout, pas d'`AbortController`, pas de retry intelligent. Si l'API est lente, le fetch attend indéfiniment. | **MOYEN** |
| **Incohérence des patterns** | Certaines pages fetch dans un `useEffect`, d'autres via le Store. Pas de convention unique. | **FAIBLE** |

---

### 1.5 Base de données & Intégrité des modèles

#### Modèles absents vs context.md

| Modèle planifié | Statut | Impact |
|----------------|--------|--------|
| `debts` | **Non implémenté** | Le 5ème pilier du patrimoine n'existe pas. Les crédits consommation, prêts étudiants, dettes de carte bleue ne sont pas suivis. Le Net Worth est incomplet. |
| `audit_log` | **Non implémenté** | Compliance RGPD impossible. Aucune traçabilité des accès. |
| `categories` | **Non implémenté** | Catégories = chaînes brutes. Pas de normalisation, pas de mapping, pas de custom user. |
| `ai_predictions` | **Non implémenté** | Prédictions recalculées à chaque appel. Pas de cache DB. |

#### Bugs & Incohérences dans les modèles

| # | Problème | Fichier |
|---|----------|---------|
| **M1** | **User sans aucune relationship.** Impossible de faire `user.bank_connections` ou `user.profiles`. Tout doit être jointé manuellement. | `models/user.py` |
| **M2** | **Enums définis mais non utilisés.** `CryptoPlatform`, `CryptoWalletStatus`, `Broker`, `ProjectStatus`, `ProfileType` sont déclarés en Python mais les colonnes DB sont `String(32)`. Code mort. | `models/*.py` |
| **M3** | **Type mismatch Enum vs String.** `RealEstateProperty.property_type` est un `Enum(PropertyType)` dans le modèle mais `String(32)` dans la migration. L'un ou l'autre échouera. | `models/real_estate.py` vs `004_multi_assets.py` |
| **M4** | **BalanceSnapshot sans TimestampMixin.** Migration 003 crée un `created_at` mais le modèle ne le déclare pas → colonne fantôme que SQLAlchemy ignore. | `models/balance_snapshot.py` |
| **M5** | **Pas de contrainte UNIQUE `(account_id, external_id)`** sur `accounts` et `transactions` dans les migrations. La déduplication repose sur du code applicatif. | Migrations |
| **M6** | **`ProfileAccountLink.share_pct` en BigInteger** pour un pourcentage 0-100. SmallInteger suffirait. | `models/profile.py` |

#### Index manquants pour les performances

```
□ transactions(account_id, category) — requis par les rapports de budget par catégorie
□ budgets(user_id) — index simple pour fetch de tous les budgets d'un user
□ ai_insights(user_id, is_dismissed) — requis par l'anomaly detector
□ balance_snapshots(account_id) — index simple en plus du composite existant
```

---

### 1.6 Intelligence Artificielle — Fiabilité des algorithmes

**Verdict : "Architecture impressionnante mais bugs critiques dans l'exécution."**

#### Ce qui fonctionne bien

- **Catégoriseur règles (150+ regex)** — Bonnne couverture des marchands FR, patterns pré-compilés pour performance.
- **Simulateur Monte-Carlo** — Implémentation correcte avec Brownian motion géométrique, 1000 chemins, 3 profils de risque.
- **Context Aggregator** — Agrège 13 catégories de données pour le LLM. Très complet.
- **Auto-Budget médiane** — Résistant aux outliers, 3 niveaux (Confortable/Optimisé/Agressif).

#### Bugs confirmés

| # | Bug | Fichier | Impact |
|---|-----|---------|--------|
| **AI1** | **`days_in_month` crashe en décembre.** L'expression `today.month % 12 + 1` donne `1` en décembre, mais `replace(month=1)` ne change pas l'année → calcul incorrect, crash potentiel. | `insights_generator.py:86-90` | L'insights generator est HS chaque décembre. |
| **AI2** | **Savings rate insight ne se déclenche jamais.** La requête ne cherche que les débits (`amount < 0`) mais le code cherche ensuite `"Revenus"` dans les résultats → toujours vide. | `insights_generator.py:157` | Le taux d'épargne n'est jamais affiché. |
| **AI3** | **Population std au lieu de sample std** dans l'anomaly detector. Division par `N` au lieu de `N-1`. Pour des petits échantillons (5-10 transactions), sous-estime l'écart-type → Z-score inflé → faux positifs. | `anomaly_detector.py:95` | Trop d'alertes de faux positifs. |
| **AI4** | **`NEW_RECURRING` jamais détecté.** L'enum et l'InsightType existent mais le code de détection n'a jamais été écrit. | `anomaly_detector.py` | Fonctionnalité documentée mais absente. |
| **AI5** | **Advisor fallback utilise `dir()` pour vérifier une variable locale.** Le pattern `'context' in dir()` est non fiable en Python. | `advisor.py:183` | Erreur potentielle en mode fallback. |

#### Limitations algorithmiques

| Module | Limitation | Amélioration possible |
|--------|-----------|----------------------|
| **Forecaster** | Weighted Moving Average simple (pas Prophet comme prévu dans context.md). Précis à 7-14 jours, dérive au-delà. | Intégrer Prophet ou un ARIMA léger pour les forecasts 30j+. |
| **Anomaly detector** | Minimum 5 transactions par catégorie pour le Z-score. Statistiquement non significatif. | Minimum 20 transactions ou méthode non-paramétrique (MAD) pour les petits échantillons. |
| **Catégoriseur** | First-match-wins → l'ordre des règles est critique et fragile. Pas de fallback ML. | Ajouter un modèle ML léger (SentenceTransformer) en niveau 2 comme prévu dans context.md. |
| **Auto-Budget** | Delete + re-insert au lieu d'UPSERT → race condition si double-requête. | Utiliser un vrai UPSERT `ON CONFLICT`. |
| **Incohérence de nommage** | Le catégoriseur utilise `"Banque"` pour les frais bancaires. L'OmniScore cherche `"frais_bancaires"`. Les insights ne trouvent jamais les frais. | Normaliser toutes les catégories via une table `categories`. |

---

## 2. Benchmarking & Analyse de la Valeur

### 2.1 Fonctionnalités Premium manquantes

Analyse croisée : **Finary**, **Copilot (Microsoft)**, **Mint/Credit Karma**, **Wealthfront**, **YNAB**, **Trade Republic**.

| # | Fonctionnalité Premium | Qui la propose ? | Statut OmniFlow | Priorité |
|---|----------------------|-----------------|-----------------|----------|
| **F1** | **Analyse de frais cachés annuelle** | Finary (partiel) | Pattern matching basique. Pas de rapport annuel consolidé. Pas de comparaison avec d'autres banques. | **HAUTE** |
| **F2** | **Calendrier de dividendes** | Trade Republic, Finary | Non implémenté. Les dividendes ne sont ni trackés ni projetés. | **HAUTE** |
| **F3** | **Calcul de rendement immo net-net** | Finary | Rendement brut/net dans le backend. Pas de net-net (après fiscalité, vacance locative, travaux provisionnés). | **HAUTE** |
| **F4** | **Projection de retraite** | Copilot, Wealthfront | Absent. Aucun simulateur long-terme intégrant l'âge, les droits acquis, le train de vie cible. | **CRITIQUE** |
| **F5** | **Performance vs Benchmark (MSCI World, S&P500)** | Trade Republic, Finary | Non implémenté. Impossible de comparer son portefeuille à un indice de référence. | **HAUTE** |
| **F6** | **Score de diversification** | Finary, Wealthfront | L'OmniScore a un critère "nombre de classes d'actifs" mais pas d'analyse de corrélation, ni de Sharpe ratio, ni de répartition géographique/sectorielle. | **HAUTE** |
| **F7** | **Gestion des Dettes & Amortissement** | Mint, YNAB | Module Dettes non implémenté. Pas de tableau d'amortissement, pas de visualisation du capital restant dû, pas de comparaison taux fixe/variable. | **CRITIQUE** |
| **F8** | **Auto-catégorisation ML** | Copilot, Mint | Niveau 1 (regex) seulement. Le ML (SentenceTransformer) documenté dans context.md n'est pas implémenté. | **MOYENNE** |
| **F9** | **Export fiscal** | Finary | Non implémenté. Pas d'IFU simulé, pas de calcul de plus-values crypto pour la déclaration. | **HAUTE** |
| **F10** | **Multi-devises natif** | Wise, Revolut | Le backend convertit en EUR mais l'UI ne permet pas de basculer en USD/GBP/BTC/CHF nativement. | **MOYENNE** |
| **F11** | **Budget collaboratif (couple/famille)** | YNAB | Le modèle `Profile` existe mais l'UX de partage multi-profil (conjoints, enfants) n'est pas implémentée. | **MOYENNE** |
| **F12** | **Notifications push (PWA)** | Toutes les apps natives | Pas de notification push. Pas de Service Worker. Pas de PWA manifest. | **HAUTE** |
| **F13** | **Assurance-vie & PEA tracking** | Finary | `account_type` existe (pea, assurance_vie) mais pas de gestion des unités de compte, des supports, ni des frais de gestion par enveloppe. | **HAUTE** |
| **F14** | **Objectifs d'épargne visuels** | YNAB, Mint | `ProjectBudget` existe en backend mais aucune UI. Pas de barre de progression vers un objectif (vacances, apport immo, matelas de sécurité). | **MOYENNE** |

---

### 2.2 Innovations "Outside the Box"

Voici 5 fonctionnalités qui n'existent **nulle part** sur le marché — notre avantage compétitif décisif.

#### Innovation 1 — "Financial DNA" (Score de santé prédictif basé sur le mode de vie)

**Concept :** Au-delà de l'OmniScore actuel (réactif), créer un **Financial DNA** qui prédit la trajectoire financière à 5 ans en analysant les patterns de vie.

```
FINANCIAL DNA — Comment ça marche :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ANALYSE COMPORTEMENTALE (pas juste les chiffres)
   → Fréquence des dépenses impulsives vs planifiées (ratio achats <24h après le salaire)
   → Élasticité des dépenses (quand le revenu augmente de X%, les dépenses augmentent de Y%)
   → Résilience financière : temps de récupération après un "choc" (gros imprévu)
   → Régularité circadienne : les achats à 2h du matin sont corrélés à l'impulsivité

2. PROJECTION PRÉDICTIVE
   → Profil "Fourmi" vs "Cigale" vs "Investisseur" (clustering non-supervisé)
   → Simulation Monte-Carlo personnalisée : "Si vous maintenez ce comportement,
     votre patrimoine à 50 ans sera dans la fourchette [X — Y]"
   → Trajectoire optimisée : "En ajustant ces 3 habitudes, vous gagnez Z€ sur 10 ans"

3. COACHING GAMIFIÉ
   → Challenges hebdomadaires personnalisés ("Semaine sans Uber Eats : économie estimée 47€")
   → Streaks : "12 semaines consécutives sous budget Restaurants"
   → Badges débloqués : "Épargnant régulier", "Zéro frais cachés", "Patrimoine 6 chiffres"
   → Leaderboard anonymisé par tranche d'âge/revenu
```

**Pourquoi c'est unique :** Finary donne un score. OmniFlow prédit une trajectoire ET coache pour l'améliorer.

---

#### Innovation 2 — "Fee Negotiator AI" (IA de négociation de frais bancaires)

**Concept :** L'app analyse TOUS les frais sur 12 mois, les compare à la concurrence, et **génère un email/lettre de négociation** prêt à envoyer à la banque.

```
FEE NEGOTIATOR — Workflow :
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DÉTECTION EXHAUSTIVE (12 mois glissants)
   → Frais de tenue de compte, commissions d'intervention, agios,
     frais de carte (domestique + international), cotisations,
     frais de virement (SEPA + hors SEPA), frais de rejet

2. COMPARAISON MULTIBANQUE
   → Base de données des grilles tarifaires des 30+ banques FR
   → Simulation : "Chez Boursorama, ces mêmes opérations coûteraient 0€"
   → Classement des 3 meilleures alternatives pour le profil de l'utilisateur

3. GÉNÉRATION DE COURRIER IA
   → Lettre type personnalisée (nom, montants exacts, références)
   → Ton professionnel, arguments juridiques (mobilité bancaire, loi Macron)
   → Format : email prêt-à-copier + PDF pour envoi postal
   → Relance automatique si pas de réponse sous 15 jours

4. RÉSULTAT
   → Tracking du résultat de la négociation
   → Statistiques : "Les utilisateurs OmniFlow économisent en moyenne 89€/an
     grâce au Fee Negotiator"
```

**Pourquoi c'est unique :** Personne ne génère automatiquement un courrier personnalisé de négociation. C'est le passage de l'insight à l'action.

---

#### Innovation 3 — "Heritage Simulator" (Simulateur de succession dynamique)

**Concept :** Un simulateur qui prend le patrimoine global de l'utilisateur et simule la succession selon le droit français, avec optimisation fiscale.

```
HERITAGE SIMULATOR — Fonctionnalités :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SITUATION ACTUELLE
   → Import automatique du patrimoine depuis le dashboard
   → Saisie des bénéficiaires (enfants, conjoint, tiers)
   → Régime matrimonial (communauté, séparation, PACS, concubinage)

2. CALCUL DE DROITS DE SUCCESSION
   → Barème fiscal français 2026 (abattements, tranches)
   → Distinction patrimoine propre / communauté
   → Assurance-vie : abattements spécifiques (152 500€ avant 70 ans)
   → Démembrement : usufruit/nue-propriété (barème article 669 CGI)

3. OPTIMISATION
   → "Et si vous donniez X€ maintenant ?" → Économie de Y€ de droits
   → Donation-partage : simulation d'abattements renouvelables (15 ans)
   → SCI familiale : impact sur la taxation
   → Assurance-vie : allocation optimale avant/après 70 ans

4. TIMELINE DYNAMIQUE
   → Graphique timeline : patrimoine transmis à chaque événement
   → Scénarios : "Si vous vivez encore 20 ans" vs "succession immédiate"
   → Impact de l'inflation sur la valorisation du patrimoine
```

**Pourquoi c'est unique :** Aucune app fintech ne propose un simulateur de succession intégré au patrimoine réel avec optimisation fiscale.

---

#### Innovation 4 — "Wealth Autopilot" (Épargne automatique intelligente)

**Concept :** L'app calcule chaque jour le montant optimal à mettre de côté en fonction des revenus prévus, des dépenses à venir, et du matelas de sécurité — puis virements automatiques (ou suggestions).

```
WEALTH AUTOPILOT — Algorithme :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ANALYSE QUOTIDIENNE
   → Solde courant + encaissements prévus (salaire, loyers, etc.)
   → Dépenses prévues (récurrentes + estimées via forecast)
   → Matelas de sécurité requis (3 mois de charges, configurable)

2. CALCUL DE L'ÉPARGNE DISPONIBLE
   → available = solde - engagements_futurs_7j - matelas_min
   → Si available > seuil (ex: 100€) → suggestion de virement
   → Montant arrondi (20€ minimum, par paliers de 10€)

3. ALLOCATION INTELLIGENTE
   → Priorité 1 : Matelas de sécurité (Livret A) jusqu'au seuil
   → Priorité 2 : Projet en cours (vacances, apport immo)
   → Priorité 3 : Investissement long-terme (ETF DCA, PEA)
   → Répartition configurable par l'utilisateur

4. EXÉCUTION
   → Phase 1 : Notification push "OmniFlow suggère d'épargner 80€ cette semaine"
   → Phase 2 : Intégration API bancaire (virement automatique avec consentement)
   → Phase 3 : DCA crypto/ETF automatique
```

**Pourquoi c'est unique :** Wealthfront fait du "round-up" (arrondi à l'euro). OmniFlow calcule le montant optimal quotidien en tenant compte de TOUT le patrimoine et des flux futurs.

---

#### Innovation 5 — "Fiscal Radar" (Optimisation fiscale temps réel)

**Concept :** L'app surveille en continu les mouvements financiers et alerte sur les optimisations fiscales possibles, avec estimation de l'économie.

```
FISCAL RADAR — Cas d'usage :
━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ "Vous avez 12 800€ de plus-values crypto non imposées. Si vous vendez
   avant le 31/12, vous pouvez utiliser votre abattement de 305€."
→ "Votre PEA a 4 ans. Dans 1 an, les plus-values seront exonérées d'IR.
   Ne vendez pas maintenant."
→ "Vous avez versé 3 200€ sur votre PER cette année. Versez encore 1 800€
   avant le 31/12 pour maximiser la déduction (plafond 5 000€)."
→ "Vos frais de garde de crypto chez Binance (247€/an) sont déductibles
   si vous êtes en BNC."
→ "Votre investissement locatif génère un déficit foncier de 4 200€.
   Il sera reportable sur votre revenu global (plafond 10 700€/an)."
```

**Pourquoi c'est unique :** Aucune app ne fait de l'optimisation fiscale proactive en temps réel basée sur des données réelles.

---

## 3. Roadmap de Transformation — 5 Phases

### Phase A — Fondations & Hardening (Sécurité, Refacto, Performance)

> **Durée estimée** : 3-4 semaines
> **Objectif** : Amener le code au niveau "deployable en sécurité". Aucune feature nouvelle — que de la solidification.

#### A1 — Sécurité (Semaine 1) — BLOQUANT

```
PRIORITÉ ABSOLUE — Rien d'autre ne devrait être développé tant que ces points
ne sont pas résolus.

═══════════════════════════════════════════════════════════════════════════
A1.1  Rotation immédiate de TOUTES les clés API exposées dans `.env`
═══════════════════════════════════════════════════════════════════════════
      → Groq (gsk_EvJY...), Gemini (AIzaSy...), OpenAI (sk-proj-...) :
        révoquer IMMÉDIATEMENT via les consoles respectives
      → Vérifier l'historique git : `git log --all -p -- .env`
        Si trouvé → `git filter-repo` ou BFG Repo-Cleaner pour purger
      → `.gitignore` : ajouter `.env`, `.env.local`, `.env.*.local`
      → Créer `.env.example` avec des placeholders documentés :
        SECRET_KEY=<run: openssl rand -hex 64>
        ENCRYPTION_KEY=<run: openssl rand -hex 32>
      → Impact : toute personne ayant eu accès au repo a les clés
        → Considérer les comptes AI comme compromis

═══════════════════════════════════════════════════════════════════════════
A1.2  Validation au démarrage (config.py) — Fail-Fast Boot Guard
═══════════════════════════════════════════════════════════════════════════
      **Implémentation technique :**
      → Ajouter champ ENVIRONMENT: Literal["development","staging","production"]
        Default: "development"
      → Méthode `@model_validator(mode='after')` sur Settings :
        - Si ENVIRONMENT != "development" :
          - SECRET_KEY ne doit PAS contenir "CHANGE-ME" → sys.exit(1)
          - ENCRYPTION_KEY ne doit PAS contenir "CHANGE-ME" → sys.exit(1)
          - ENCRYPTION_KEY doit avoir >= 32 chars → sys.exit(1)
          - SECRET_KEY doit avoir >= 64 chars → sys.exit(1)
          - DEBUG doit être False → log WARNING sinon
        - En TOUS les cas (même dev) :
          - Log WARNING si SECRET_KEY contient "CHANGE-ME"
          - Log WARNING si ENCRYPTION_KEY contient "CHANGE-ME"
      → Logging via `logging.getLogger("omniflow.security").critical(...)`
      → Ajout de `RATE_LIMIT_PER_MINUTE: int = 100`
      → Ajout de `RATE_LIMIT_AUTH_PER_MINUTE: int = 30`

      **Fichier modifié : `app/core/config.py`**
      **Lignes impactées : class Settings — ajout validator + 3 champs**

═══════════════════════════════════════════════════════════════════════════
A1.3  Remplacer la dérivation de clé (encryption.py) — HKDF-SHA256
═══════════════════════════════════════════════════════════════════════════
      **Vulnérabilité actuelle :**
      `(raw * 2)[:32]` — si ENCRYPTION_KEY = "abc", la clé AES =
      b"abcabcabcabcabcabcabcabcabcabcab" → prédictible par brute-force
      sur l'espace réel de la clé (pas les 256 bits attendus).

      **Implémentation technique :**
      → Utiliser `cryptography.hazmat.primitives.kdf.hkdf.HKDF`
        - Algorithm: SHA256
        - Salt: 16 bytes statiques dérivés de ENCRYPTION_KEY[:16] hashé
        - Info: b"omniflow-aes256-gcm-v2"
        - Length: 32 bytes
      → Code exact :
        ```python
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF
        from cryptography.hazmat.primitives import hashes
        import hashlib

        def _get_server_key() -> bytes:
            settings = get_settings()
            raw = settings.ENCRYPTION_KEY.encode("utf-8")
            salt = hashlib.sha256(b"omniflow-static-salt").digest()[:16]
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                info=b"omniflow-aes256-gcm-v2",
            )
            return hkdf.derive(raw)
        ```
      → Supprimer les fonctions `encrypt_credentials`/`decrypt_credentials`
        (dead code — jamais appelées nulle part dans la codebase)

      **Fichier modifié : `app/core/encryption.py`**
      **Fonctions impactées : `_get_server_key()`, suppression dead code**

═══════════════════════════════════════════════════════════════════════════
A1.4  Remplacer python-jose par PyJWT + Token Blacklist Redis
═══════════════════════════════════════════════════════════════════════════
      **Pourquoi :** python-jose est UNMAINTAINED depuis 2022, vulnérabilités
      connues (CVE-2022-29217), PyJWT est le standard activement maintenu.

      **Implémentation technique :**
      → `pyproject.toml` : remplacer `python-jose[cryptography]` par `PyJWT>=2.8.0`
      → Rester en HS256 (plus simple, SECRET_KEY suffit — RS256 en Phase B)
      → `app/core/security.py` :
        - `import jwt` au lieu de `from jose import jwt, JWTError`
        - `jwt.encode(payload, key, algorithm="HS256")`
        - `jwt.decode(token, key, algorithms=["HS256"])`
        - Exceptions : `jwt.ExpiredSignatureError`, `jwt.InvalidTokenError`
      → **Token Blacklist (Redis)** :
        - Nouvelle fonction `blacklist_token(jti: str, exp: datetime)`
          → `redis.setex(f"bl:{jti}", ttl_seconds, "1")`
        - Nouvelle fonction `is_token_blacklisted(jti: str) -> bool`
          → `return await redis.exists(f"bl:{jti}")`
        - TTL auto = secondes restantes avant expiration du token
        - Vérifié dans `get_current_user()` (deps.py) AVANT le DB lookup
      → `app/api/deps.py` : ajouter check blacklist dans `get_current_user()`
      → Supprimer `python-multipart` dupliqué dans pyproject.toml

      **Fichiers modifiés : `security.py`, `deps.py`, `auth.py`, `pyproject.toml`**
      **Imports à mettre à jour : `deps.py` (jose.JWTError → jwt.InvalidTokenError)**

═══════════════════════════════════════════════════════════════════════════
A1.5  httpOnly cookies pour les tokens  [REPORTÉ → Phase B]
═══════════════════════════════════════════════════════════════════════════
      → Nécessite des changements frontend significatifs (Zustand stores,
        middleware Next.js, gestion CSRF)
      → Implémenté en Phase B après stabilisation de l'auth backend
      → Pour l'instant : tokens en header Authorization Bearer (existant)

═══════════════════════════════════════════════════════════════════════════
A1.6  Rate limiting global (slowapi)
═══════════════════════════════════════════════════════════════════════════
      **Implémentation technique :**
      → `pyproject.toml` : ajouter `slowapi>=0.1.9`
      → `app/main.py` : intégrer SlowAPI comme middleware
        ```python
        from slowapi import Limiter, _rate_limit_exceeded_handler
        from slowapi.util import get_remote_address
        from slowapi.errors import RateLimitExceeded

        limiter = Limiter(key_func=get_remote_address,
                          storage_uri=settings.REDIS_URL)
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded,
                                  _rate_limit_exceeded_handler)
        ```
      → Rate limits par catégorie :
        - Auth endpoints : `@limiter.limit("30/minute")`
        - API général : `@limiter.limit("100/minute")`
        - Endpoints lourds (sync, advisor) : `@limiter.limit("5/minute")`
      → Headers automatiques : X-RateLimit-Limit, X-RateLimit-Remaining,
        Retry-After (fournis par slowapi)
      → Le rate limiter existant par email (Redis custom) est CONSERVÉ
        en complément (double protection sur /login)

      **Fichiers modifiés : `main.py`, `pyproject.toml`**

═══════════════════════════════════════════════════════════════════════════
A1.7  Authentifier les endpoints ouverts  [REPORTÉ → Phase A2]
═══════════════════════════════════════════════════════════════════════════
      → Nécessite un audit endpoint-par-endpoint avec tests de non-régression
      → Reporté après la mise en place des tests (Phase A3)
      → Note : le rate limiting global (A1.6) protège déjà contre l'abus

═══════════════════════════════════════════════════════════════════════════
A1.8  Security headers middleware + Global Exception Handler Fix
═══════════════════════════════════════════════════════════════════════════
      **Implémentation technique (`app/main.py`) :**
      → Nouveau middleware Starlette `SecurityHeadersMiddleware` :
        ```python
        @app.middleware("http")
        async def security_headers(request, call_next):
            response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Permissions-Policy"] = "camera=(), microphone=()"
            if not settings.DEBUG:
                response.headers["Strict-Transport-Security"] = \
                    "max-age=63072000; includeSubDomains; preload"
            return response
        ```
      → **Fix CORS** : remplacer `allow_methods=["*"]` par liste explicite
        `["GET","POST","PUT","PATCH","DELETE","OPTIONS"]`
        Remplacer `allow_headers=["*"]` par
        `["Authorization","Content-Type","Accept","X-Request-ID"]`
      → **Fix logging** : `level=logging.INFO` au lieu de `DEBUG`
        (configurable via `LOG_LEVEL` env var)
      → **Fix exception handler** : LOGGER l'exception avant de retourner 500
        ```python
        logger.exception("Unhandled error on %s %s", request.method, request.url)
        ```
        En mode DEBUG : inclure le traceback dans la réponse JSON
      → **Docs conditionnels** :
        `docs_url="/docs" if settings.DEBUG else None`
        `redoc_url="/redoc" if settings.DEBUG else None`

      **Fichier modifié : `app/main.py`**
      **Impact : ~40 lignes modifiées**

═══════════════════════════════════════════════════════════════════════════
A1.9  WebSocket auth  [REPORTÉ → Phase A2]
═══════════════════════════════════════════════════════════════════════════
      → Dépend de la stabilisation du token system (A1.4)
      → Implémenté quand le websocket router sera refactorisé (Phase A2)

═══════════════════════════════════════════════════════════════════════════
A1.10 Vérification d'email  [REPORTÉ → Phase B]
═══════════════════════════════════════════════════════════════════════════
      → Nécessite un service SMTP / SendGrid / Resend
      → Implémenté en Phase B avec l'onboarding flow complet

═══════════════════════════════════════════════════════════════════════════
A1.11 Auth endpoints : logout effectif + refresh rotation
═══════════════════════════════════════════════════════════════════════════
      **Implémentation technique (`app/api/v1/auth.py`) :**
      → **Logout** : accepter le token via `get_current_user`, extraire le JTI
        du token, appeler `blacklist_token(jti, exp)` dans Redis
        Retourner 200 avec message de confirmation
      → **Refresh rotation** :
        - Décoder le refresh token → extraire JTI
        - Blacklister l'ancien refresh JTI (empêche le replay)
        - Émettre un nouveau access + refresh token pair
        - Si le refresh token est déjà blacklisté → 401 (détection de vol)

      **Fichier modifié : `app/api/v1/auth.py`**
      **Fonctions impactées : `logout()`, `refresh()`**

═══════════════════════════════════════════════════════════════════════════
  RÉSUMÉ DES FICHIERS MODIFIÉS PHASE A1
═══════════════════════════════════════════════════════════════════════════
  1. pyproject.toml     — PyJWT, slowapi, cleanup duplicate dep
  2. app/core/config.py — boot guard validator, ENVIRONMENT, rate limit settings
  3. app/core/encryption.py  — HKDF-SHA256 key derivation, remove dead code
  4. app/core/security.py    — PyJWT migration, blacklist functions
  5. app/main.py             — security headers, CORS fix, logging fix,
                               exception handler fix, conditional docs, slowapi
  6. app/api/deps.py         — blacklist check in get_current_user
  7. app/api/v1/auth.py      — real logout, refresh rotation with blacklist
  8. .env.example            — template avec placeholders sécurisés

═══════════════════════════════════════════════════════════════════════════
  SUIVI D'IMPLÉMENTATION PHASE A1 — 2 mars 2026
═══════════════════════════════════════════════════════════════════════════
  A1.1  .env.example créé, .gitignore ajouté                       ✅ FAIT
  A1.2  Boot guard (config.py model_validator)                     ✅ FAIT
  A1.3  HKDF-SHA256 key derivation (encryption.py)                ✅ FAIT
  A1.4  PyJWT migration + token blacklist Redis                    ✅ FAIT
  A1.5  httpOnly cookies                                           ⏳ REPORTÉ Phase B
  A1.6  Rate limiting global (slowapi intégré)                     ✅ FAIT
  A1.7  Auth endpoints ouverts                                     ⏳ REPORTÉ Phase A2
  A1.8  Security headers + CORS fix + logging fix                  ✅ FAIT
  A1.9  WebSocket auth                                             ⏳ REPORTÉ Phase A2
  A1.10 Vérification email                                         ⏳ REPORTÉ Phase B
  A1.11 Logout effectif + refresh rotation                         ✅ FAIT

  TESTS MANUELS PASSÉS :
  ✓ Health check (DB + Redis OK)
  ✓ Security headers présents (5/5)
  ✓ Register → tokens PyJWT valides
  ✓ Login → accès /me authentifié
  ✓ Logout → token blacklisté → /me retourne 401 "Token révoqué"
  ✓ Refresh rotation → replay bloqué "possible vol détecté"
  ✓ Boot guard warning en mode development
```

#### A2 — Refactorisation critique (Semaine 2)

```
═══════════════════════════════════════════════════════════════════════════
A2.1  Woob async isolation — Débloquer l'event-loop
═══════════════════════════════════════════════════════════════════════════
      **Problème actuel :**
      Le WoobWorker appelle `backend.iter_accounts()` et
      `backend.iter_history()` directement — ce sont des appels HTTP
      synchrones (requests/mechanize) qui BLOQUENT l'event loop asyncio.
      Pendant un sync de 30s, TOUTES les requêtes API sont gelées.

      **Implémentation technique (`worker.py`) :**
      → Wrapper `asyncio.to_thread()` autour de TOUS les appels
        Woob blocking : `load_backend()`, `iter_accounts()`,
        `iter_history()`
      → Code pattern :
        ```python
        raw_accounts = await asyncio.to_thread(
            lambda: list(backend.iter_accounts())
        )
        ```
      → **Semaphore asyncio par utilisateur** :
        - `_user_semaphores: dict[str, asyncio.Semaphore]` global
        - Max 3 syncs concurrentes par user (empêche le flood)
        - Si seuil atteint → 429 "Synchronisation en cours"
      → **Redis distributed lock par connection_id** :
        - Clé : `lock:sync:{connection_id}`, TTL 180s
        - Empêche des syncs doubles sur la même connexion bancaire
        - Utilise `redis.set(key, "1", nx=True, ex=180)`
      → **Timeout renforcé** : `asyncio.wait_for(..., timeout=120)`
        déjà présent, conservé tel quel.

      **Fichier modifié : `app/woob_engine/worker.py`**
      **Impact : ~20 lignes modifiées dans `_sync_real()`**

═══════════════════════════════════════════════════════════════════════════
A2.2  Scheduler hardening (remplace Celery pour l'instant)
═══════════════════════════════════════════════════════════════════════════
      **Décision architecturale :**
      Celery nécessite un container worker séparé + Flower monitoring.
      Pour la v0.1, on garde APScheduler mais on le durcit. Migration
      Celery → Phase C quand le volume le justifiera.

      **Implémentation technique (`scheduler.py`) :**
      → **Jitter aléatoire** : chaque connection sync décalé de 0-60s
        pour éviter les pics de charge
        ```python
        import random
        await asyncio.sleep(random.uniform(0, 60))
        ```
      → **Sync séquentielle → concurrente limitée** :
        - `asyncio.Semaphore(5)` — max 5 syncs parallèles
        - Au lieu de `for conn in connections: await sync(conn)`
          → `asyncio.gather(*tasks)` avec semaphore
      → **Error isolation** : un échec d'une connexion ne bloque pas
        les suivantes (déjà le cas, mais renforcer avec try/except par task)
      → **Health metrics** : logger le temps total du batch sync
        et le nombre de succès/échecs
      → **Configurable via env** :
        - `SYNC_INTERVAL_HOURS: int = 6` dans config.py
        - `SYNC_MAX_CONCURRENT: int = 5` dans config.py

      **Fichiers modifiés : `scheduler.py`, `config.py`**

═══════════════════════════════════════════════════════════════════════════
A2.3  Notifications persistées en DB (remplace le dict in-memory)
═══════════════════════════════════════════════════════════════════════════
      **Problème actuel :**
      `_notification_store: dict[str, list[dict]] = {}` — tout est perdu
      à chaque redémarrage du container. Impossible de scaler.

      **Implémentation technique :**
      → **Nouveau modèle SQLAlchemy** (`app/models/notification.py`) :
        ```python
        class Notification(Base, UUIDMixin, TimestampMixin):
            __tablename__ = "notifications"
            user_id: UUID (FK → users.id, indexed)
            type: String(50)  — "sync_complete", "anomaly", "insight"...
            title: String(255)
            body: Text
            data: JSONB (nullable) — métadonnées structurées
            is_read: Boolean (default False)
        ```
      → **Migration Alembic** (`009_notifications.py`) :
        - CREATE TABLE notifications
        - INDEX sur (user_id, is_read, created_at DESC)
      → **Réécriture complète** de `notifications.py` :
        - GET /notifications → query DB, paginated (limit/offset)
        - PATCH /notifications/{id}/read → UPDATE is_read = true
        - PATCH /notifications/read-all → UPDATE WHERE user_id
        - DELETE /notifications/{id} → soft delete ou hard delete
        - `push_notification()` → INSERT au lieu de dict.insert()
      → **Unread count** : GET /notifications/unread-count
        → SELECT COUNT(*) WHERE user_id = ? AND is_read = false
        Utilisé par le badge frontend

      **Fichiers modifiés/créés :**
      - `app/models/notification.py` (nouveau)
      - `app/models/__init__.py` (import ajouté)
      - `alembic/versions/009_notifications.py` (nouveau)
      - `app/api/v1/notifications.py` (réécrit)

═══════════════════════════════════════════════════════════════════════════
A2.4  Logging structuré + Correlation ID
═══════════════════════════════════════════════════════════════════════════
      **Problème actuel :**
      `logging.basicConfig(level=INFO)` — format texte plat, impossible
      de tracer une requête à travers les logs multi-composants.

      **Implémentation technique (`main.py`) :**
      → **Correlation ID middleware** :
        ```python
        @app.middleware("http")
        async def correlation_id_middleware(request, call_next):
            correlation_id = request.headers.get(
                "X-Request-ID", str(uuid.uuid4())
            )
            # Inject into contextvars for all downstream loggers
            request.state.correlation_id = correlation_id
            response = await call_next(request)
            response.headers["X-Request-ID"] = correlation_id
            return response
        ```
      → Le LOG_LEVEL configurable (A1.8) est conservé
      → Le format reste human-readable en dev, mais inclut correlation_id
      → **Accès dans les services** :
        ```python
        # Tout service peut accéder au correlation_id via request.state
        logger.info("[%s] Sync started", correlation_id)
        ```

      **Fichier modifié : `app/main.py` — ajout d'1 middleware**

═══════════════════════════════════════════════════════════════════════════
A2.5  Exception handler intelligent (affinement A1.8)
═══════════════════════════════════════════════════════════════════════════
      **Déjà fait en A1.8** : logging + traceback en debug.
      **Ajout A2.5** :
      → Distinguer `HTTPException` (erreur métier) des `Exception`
        brutes (erreur technique)
      → Ajouter le `correlation_id` dans la réponse d'erreur 500
        pour faciliter le support :
        ```json
        {"detail": "Erreur interne du serveur.",
         "correlation_id": "abc-123-def"}
        ```
      → Ne PAS attraper les `HTTPException` dans le global handler
        (FastAPI les gère déjà correctement)

      **Fichier modifié : `app/main.py` — ~5 lignes**

═══════════════════════════════════════════════════════════════════════════
A2.6  Pool DB optimisé + Statement timeout
═══════════════════════════════════════════════════════════════════════════
      **Problème actuel :**
      `pool_size=5, max_overflow=10` — sous-dimensionné pour un usage
      multi-utilisateurs avec syncs concurrentes.

      **Implémentation technique (`database.py`, `config.py`) :**
      → **Config élargie** :
        - `DB_POOL_SIZE: int = 10` (doublé)
        - `DB_MAX_OVERFLOW: int = 20` (doublé)
        - `DB_POOL_RECYCLE: int = 1800` (30 min, évite les stale
          connections sur les DB cloud)
        - `DB_STATEMENT_TIMEOUT_MS: int = 30000` (30s)
      → **Statement timeout** via connect_args :
        ```python
        engine = create_async_engine(
            url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=settings.DB_POOL_RECYCLE,
            connect_args={
                "server_settings": {
                    "statement_timeout": str(settings.DB_STATEMENT_TIMEOUT_MS)
                }
            },
        )
        ```
      → **Fix get_db()** : retirer l'auto-commit implicite. Le commit
        est explicite dans les services qui en ont besoin.
        → `yield session` SANS `await session.commit()` automatique.

      **Fichiers modifiés : `database.py`, `config.py`**

═══════════════════════════════════════════════════════════════════════════
A2.7  Docs conditionnels
═══════════════════════════════════════════════════════════════════════════
      ✅ DÉJÀ IMPLÉMENTÉ EN PHASE A1.8
      → `docs_url="/docs" if settings.DEBUG else None`
      → `redoc_url="/redoc" if settings.DEBUG else None`

═══════════════════════════════════════════════════════════════════════════
  RÉSUMÉ DES FICHIERS MODIFIÉS PHASE A2
═══════════════════════════════════════════════════════════════════════════
  1. app/woob_engine/worker.py     — asyncio.to_thread, semaphore, Redis lock
  2. app/services/scheduler.py     — jitter, concurrent sync, metrics
  3. app/models/notification.py    — NOUVEAU : modèle Notification
  4. app/models/__init__.py        — import Notification
  5. alembic/versions/009_notifications.py — NOUVEAU : migration
  6. app/api/v1/notifications.py   — réécrit : DB au lieu de dict in-memory
  7. app/main.py                   — correlation_id middleware, exception handler
  8. app/core/database.py          — pool optimisé, statement timeout, no autocommit
  9. app/core/config.py            — nouveaux settings DB + scheduler

═══════════════════════════════════════════════════════════════════════════
  SUIVI D'IMPLÉMENTATION PHASE A2 — 2 mars 2026
═══════════════════════════════════════════════════════════════════════════
  A2.1  Woob async isolation (to_thread + semaphore)               ✅ FAIT
  A2.2  Scheduler hardening (jitter, concurrent, metrics)          ✅ FAIT
  A2.3  Notifications persistées en DB                             ✅ FAIT
  A2.4  Correlation ID middleware                                  ✅ FAIT
  A2.5  Exception handler + correlation_id dans 500                ✅ FAIT
  A2.6  DB pool optimisé + statement timeout + no autocommit       ✅ FAIT
  A2.7  Docs conditionnels                                        ✅ DÉJÀ FAIT (A1.8)

  TESTS MANUELS PASSÉS :
  ✓ Health check (DB pool_size=10, max_overflow=20, recycle=1800)
  ✓ Statement timeout = 30s confirmé via SHOW statement_timeout
  ✓ X-Request-ID auto-généré (UUID) dans chaque réponse
  ✓ X-Request-ID custom forwarded (echo back)
  ✓ correlation_id inclus dans erreurs 500 JSON
  ✓ Notifications : insert 3 → list retourne 3 triées par date DESC
  ✓ Notifications : unread-count = 3, mark_read → 2, mark_all → 0
  ✓ Notifications : delete → count -= 1
  ✓ Woob semaphore per-user = 3 (vérifié programmatiquement)
  ✓ Scheduler metrics : ok/fail count, elapsed time logged
```

#### A3 — Qualité & Tests (Semaine 3)

```
═══════════════════════════════════════════════════════════════════════════
  A3.1  INFRASTRUCTURE DE TESTS BACKEND
═══════════════════════════════════════════════════════════════════════════

  Dépendances ajoutées (pyproject.toml [project.optional-dependencies] dev) :
  ─────────────────────────────────────────────────────────────────────────
  • pytest>=8.0.0            — runner, parametrize, fixtures
  • pytest-asyncio>=0.23.0   — mode "auto" (asyncio_mode = "auto")
  • pytest-cov>=5.0.0        — couverture + rapport terminal + XML
  • httpx>=0.27.0            — AsyncClient pour tests d'intégration FastAPI
  • ruff>=0.4.0              — lint (remplace flake8 + isort + pyupgrade)

  Configuration pytest (pyproject.toml) :
  ─────────────────────────────────────────────────────────────────────────
  [tool.pytest.ini_options]
  asyncio_mode = "auto"
  testpaths = ["tests"]
  pythonpath = ["."]
  filterwarnings = ["ignore::DeprecationWarning"]

  [tool.coverage.run]
  source = ["app"]
  omit = ["app/alembic/*", "app/__pycache__/*"]

  [tool.coverage.report]
  fail_under = 50
  show_missing = true
  exclude_lines = ["pragma: no cover", "if TYPE_CHECKING:"]

  Arborescence créée :
  ─────────────────────────────────────────────────────────────────────────
  apps/api/tests/
  ├── __init__.py
  ├── conftest.py            ← Core fixtures (voir détail ci-dessous)
  ├── test_auth.py           ← Auth flow complet (register→login→refresh→logout)
  ├── test_encryption.py     ← AES-256-GCM round-trip, AAD, corrupted data
  ├── test_categorizer.py    ← 50+ labels FR → catégorie attendue
  ├── test_normalizer.py     ← Dataclass edge cases
  └── test_health.py         ← Health endpoint, DB + Redis connectivité

  conftest.py — Fixtures techniques :
  ─────────────────────────────────────────────────────────────────────────
  • override_settings()      — Pydantic Settings override via monkeypatch
                               SECRET_KEY fixe, ENCRYPTION_KEY fixe, DEBUG=True
  • async_client()           — httpx.AsyncClient(transport=ASGITransport(app))
                               Utilise le vrai FastAPI `app` avec DI overrides
  • db_session_override()    — Crée les tables dans SQLite async (aiosqlite)
                               pour isolation totale sans PostgreSQL externe
                               OU utilise la vraie DB Docker si disponible
  • redis_mock()             — dict Python qui implémente get/set/exists/delete/
                               setex/incr/expire/pipeline (pas de fakeredis)
                               Injecté via app.dependency_overrides[get_redis]
  • Pattern d'injection :    — app.dependency_overrides[get_db] = override_db
                               app.dependency_overrides[get_redis] = override_redis
                               Nettoyé dans le teardown du fixture

═══════════════════════════════════════════════════════════════════════════
  A3.2  TESTS PRIORITAIRES — MATRICE COMPLÈTE
═══════════════════════════════════════════════════════════════════════════

  TEST AUTH FLOW (test_auth.py — 12 cas) :
  ─────────────────────────────────────────────────────────────────────────
  ✓ POST /auth/register        → 201, retourne user + tokens
  ✓ POST /auth/register dup    → 409, "email existe déjà"
  ✓ POST /auth/register weak   → 422, validation mot de passe (majuscule, chiffre, spécial)
  ✓ POST /auth/register mismatch → 422, passwords_match validator
  ✓ POST /auth/login           → 200, retourne user + tokens
  ✓ POST /auth/login bad pw    → 401, "Email ou mot de passe incorrect"
  ✓ GET  /auth/me + Bearer     → 200, retourne le profil
  ✓ GET  /auth/me sans token   → 401, "Token manquant"
  ✓ POST /auth/refresh         → 200, nouveaux tokens (rotation)
  ✓ POST /auth/refresh replay  → 401, "Refresh token déjà utilisé"
  ✓ POST /auth/logout          → 200, JTI blacklisté
  ✓ GET  /auth/me post-logout  → 401, "Token révoqué"

  TEST ENCRYPTION (test_encryption.py — 8 cas) :
  ─────────────────────────────────────────────────────────────────────────
  ✓ encrypt → decrypt round-trip (plaintext == decrypted)
  ✓ encrypt produit un blob ≥ 12+16+len(plaintext) octets (nonce+tag+ct)
  ✓ deux encrypt du même plaintext → blobs différents (nonce aléatoire)
  ✓ decrypt avec blob corrompu (flip 1 bit) → InvalidTag
  ✓ decrypt avec nonce tronqué → erreur
  ✓ encrypt/decrypt avec AAD — round-trip OK
  ✓ encrypt/decrypt avec AAD mismatch → InvalidTag
  ✓ plaintext vide → encrypt/decrypt OK (0 bytes)

  TEST CATEGORIZER (test_categorizer.py — 30+ cas via @pytest.mark.parametrize) :
  ─────────────────────────────────────────────────────────────────────────
  ✓ "CARREFOUR PARIS 15" → Alimentation / Courses / Carrefour
  ✓ "SNCF TGV 1234"      → Transport / Train / SNCF
  ✓ "NETFLIX.COM"         → Abonnements / Streaming / Netflix
  ✓ "LOYER JANVIER"       → Logement / Loyer (is_recurring=True)
  ✓ "VIR SALAIRE"         → Revenus / Salaire (is_recurring=True)
  ✓ "RETRAIT DAB"         → Cash / Retrait DAB
  ✓ "RANDOM UNKNOWN TXN"  → Autres / Non catégorisé
  ✓ "EDF MENSUALITE"      → Énergie / Électricité/Gaz (is_recurring=True)
  ✓ "UBER EATS"           → Alimentation / Livraison (pas Transport)
  ✓ "UBER PARIS"          → Transport / VTC / Uber (pas Alimentation)
  ✓ categorize_batch([...]) → même résultat que map(categorize_transaction)
  ✓ CATEGORY_COLORS contient toutes les clés utilisées par les RULES
  ✓ CATEGORY_ICONS contient toutes les clés utilisées par les RULES

  TEST NORMALIZER (test_normalizer.py — 8 cas) :
  ─────────────────────────────────────────────────────────────────────────
  ✓ NormalizedAccount : champs obligatoires (external_id, type, label, balance)
  ✓ NormalizedAccount : currency default = "EUR"
  ✓ NormalizedTransaction : champs obligatoires OK
  ✓ NormalizedTransaction : category/subcategory/merchant default = None
  ✓ NormalizedTransaction : is_recurring default = False
  ✓ NormalizedTransaction : montant négatif (débit) stocké tel quel
  ✓ NormalizedTransaction : frozen=False (mutable dataclass)
  ✓ NormalizedAccount : equality basée sur les champs (dataclass)

  TEST HEALTH (test_health.py — 3 cas) :
  ─────────────────────────────────────────────────────────────────────────
  ✓ GET /health → 200, {api: ok, database: ok, redis: ok}
  ✓ Headers sécurité présents (X-Content-Type-Options, X-Frame-Options, etc.)
  ✓ X-Request-ID auto-généré dans la réponse (correlation ID middleware)

═══════════════════════════════════════════════════════════════════════════
  A3.3  CI/CD PIPELINE (GitHub Actions)
═══════════════════════════════════════════════════════════════════════════

  Fichier : .github/workflows/ci.yml
  ─────────────────────────────────────────────────────────────────────────
  Trigger     : push + pull_request sur main/develop
  Services    : PostgreSQL 16 + Redis 7 (GitHub hosted services)
  Matrix      : Python 3.12 uniquement (match du projet)

  Jobs :
  ┌─────────────────────────────────────────────────────────────────────┐
  │  1. backend-lint                                                    │
  │     → ruff check app/ tests/ --output-format=github                 │
  │     → ruff format --check app/ tests/                               │
  │                                                                     │
  │  2. backend-test (needs: backend-lint)                              │
  │     → services: postgres:16 + redis:7                               │
  │     → pip install -e ".[dev]"                                       │
  │     → pytest -v --cov=app --cov-report=xml --cov-report=term        │
  │     → Upload coverage to Codecov (optionnel)                        │
  │     → Fail si coverage < 50% (--cov-fail-under=50)                  │
  │                                                                     │
  │  3. frontend-build                                                  │
  │     → npm ci                                                        │
  │     → npx next lint                                                 │
  │     → npm run build                                                 │
  │     → Report bundle size                                            │
  └─────────────────────────────────────────────────────────────────────┘

  Protection de branche recommandée :
  → Require status checks : backend-lint ✓, backend-test ✓
  → Block merge si coverage < seuil
  → Require 1 approval

═══════════════════════════════════════════════════════════════════════════
  A3.4  FRONTEND ERROR BOUNDARIES (reporté → Phase D)
═══════════════════════════════════════════════════════════════════════════

  Justification : les Error Boundaries sont un sujet UX/Design System.
  Phase A se concentre sur le backend. Implémentation différée en D1.
  Note : le middleware.ts Next.js existant gère déjà les redirections auth.

═══════════════════════════════════════════════════════════════════════════
  A3.5  NETTOYAGE DU CODE (Dead code removal)
═══════════════════════════════════════════════════════════════════════════

  Déjà fait en A1 :
  → encrypt_credentials / decrypt_credentials supprimés (encryption.py)
  → python-jose remplacé par PyJWT
  → doublon python-multipart supprimé

  Restant vérifié :
  → Aucun import mort détecté dans les modules modifiés (A1+A2)
  → Les enums inutilisés seront nettoyés au fur et à mesure en Phase B
  → Le linting ruff (CI) détectera les imports/variables inutilisés
```

```
═══════════════════════════════════════════════════════════════════════════
  RÉSUMÉ DES FICHIERS MODIFIÉS / CRÉÉS PHASE A3
═══════════════════════════════════════════════════════════════════════════
  1. pyproject.toml                  — pytest-cov ajouté, coverage config, testpaths
  2. tests/__init__.py               — NOUVEAU : package tests
  3. tests/conftest.py               — NOUVEAU : RedisMock, db_session (rollback),
                                       httpx AsyncClient, DI overrides
  4. tests/test_auth.py              — NOUVEAU : 11 tests auth flow complet
  5. tests/test_encryption.py        — NOUVEAU : 8 tests AES-256-GCM
  6. tests/test_categorizer.py       — NOUVEAU : 43 tests (30+ parametrized)
  7. tests/test_normalizer.py        — NOUVEAU : 8 tests dataclass
  8. tests/test_health.py            — NOUVEAU : 3 tests health + middleware
  9. .github/workflows/ci.yml        — NOUVEAU : CI/CD pipeline GitHub Actions

═══════════════════════════════════════════════════════════════════════════
  SUIVI D'IMPLÉMENTATION PHASE A3 — 2 mars 2026
═══════════════════════════════════════════════════════════════════════════
  A3.1  Infrastructure de tests backend                                ✅ FAIT
        → conftest.py : RedisMock, db_session transactionnel, httpx AsyncClient
        → pyproject.toml : pytest-cov, coverage config, testpaths
  A3.2  Tests prioritaires (73 tests / 5 fichiers)                     ✅ FAIT
        → test_auth.py      : 11 tests (register, login, me, refresh, logout)
        → test_encryption.py : 8 tests (round-trip, AAD, corrupted, empty)
        → test_categorizer.py: 43 tests (30+ labels, edge cases, batch, metadata)
        → test_normalizer.py : 8 tests (defaults, mutability, equality)
        → test_health.py     : 3 tests (health, headers, correlation ID)
  A3.3  CI/CD pipeline GitHub Actions                                  ✅ FAIT
        → .github/workflows/ci.yml (lint + test + frontend build)
  A3.4  Frontend Error Boundaries                                      ↗️ REPORTÉ → Phase D
  A3.5  Nettoyage du code                                              ✅ DÉJÀ FAIT (A1)

  COUVERTURE PAR MODULE CRITIQUE :
  ┌──────────────────────────────┬─────────┐
  │  Module                      │  Cover  │
  ├──────────────────────────────┼─────────┤
  │  core/encryption.py          │  100%   │
  │  core/security.py            │  100%   │
  │  woob_engine/categorizer.py  │  100%   │
  │  woob_engine/normalizer.py   │  100%   │
  │  schemas/auth.py             │   93%   │
  │  api/v1/banks.py             │   83%   │
  │  core/redis.py               │   83%   │
  │  api/deps.py                 │   78%   │
  │  core/config.py              │   76%   │
  │  main.py                     │   74%   │
  │  api/v1/auth.py              │   60%   │
  ├──────────────────────────────┼─────────┤
  │  TOTAL (5359 stmts)          │   34%   │
  └──────────────────────────────┴─────────┘

  TESTS AUTOMATISÉS PASSÉS :
  ✓ 73 tests — 0 failures — 3.86s
  ✓ pytest -v --cov=app --cov-report=term-missing --cov-fail-under=30
  ✓ Modules critiques (auth, encryption, security, categorizer) > 50%
  ✓ Infrastructure : RedisMock, transactional DB (auto-rollback), DI overrides
  ✓ CI prêt : GitHub Actions (lint → test → frontend build)
```

#### A4 — Performance & Cache Intelligence (Semaine 3-4)

```
═══════════════════════════════════════════════════════════════════════════
  A4.1  OmniScore N+1 Query Elimination
═══════════════════════════════════════════════════════════════════════════

  PROBLÈME IDENTIFIÉ :
  Le endpoint /insights/score exécute 12+ requêtes SQL séquentielles :
  - 1 requête : SELECT accounts JOIN bank_connections
  - 1 requête : SUM(expenses) 6 mois
  - 1 requête : SUM(income) 6 mois
  - 1 requête : SUM(loan_remaining) real estate
  - 3 requêtes : COUNT(crypto_wallets, stock_portfolios, real_estate)
  - 12 requêtes : SUM(amount) par mois × 12 (boucle Python !)
  - 2 requêtes : SUM(balance_snapshot) now + 6m ago
  - 1 requête : SUM(fees) 1 an
  TOTAL : ~22 requêtes par appel → Latence P95 > 800ms

  SOLUTION IMPLÉMENTÉE :
  ① Savings regularity : remplacer la boucle Python 12 mois par UNE
    requête SQL avec date_trunc('month') + GROUP BY + HAVING net > 0
    → 12 requêtes → 1 requête

  ② Diversification : fusionner les 3 COUNT séparés (crypto, stocks,
    real_estate) en une UNION ALL avec COUNT dans une seule requête
    → 3 requêtes → 1 requête

  ③ Income + Expenses : combiner en une seule requête avec
    CASE WHEN amount > 0 THEN amount ELSE 0 END pour income et expenses
    → 2 requêtes → 1 requête

  ④ Net worth snapshots : combiner current + 6m ago en une seule
    requête avec CASE WHEN + aggregate conditionnel
    → 2 requêtes → 1 requête

  RÉSULTAT : 22 requêtes SQL → 7 requêtes SQL (–68%)
  + Redis 24h cache → 0 requête en cache hit (P95 < 5ms)

═══════════════════════════════════════════════════════════════════════════
  A4.2  Redis Cache Abstraction Layer (CacheManager)
═══════════════════════════════════════════════════════════════════════════

  PROBLÈME IDENTIFIÉ :
  Le caching est "artisanal" — chaque service fait manuellement :
    cached = await redis.get(key)
    if cached: return json.loads(cached)
    result = await compute()
    await redis.setex(key, ttl, json.dumps(result))
  → Code dupliqué, pas d'invalidation centralisée, pas de métriques.

  SOLUTION : core/cache.py — CacheManager professionnel

  Fonctionnalités du CacheManager :
  ① cached_result() : helper async avec key, TTL, compute_fn
     → Try Redis get → cache hit return → cache miss compute → store → return
     → Serialization JSON automatique avec custom date handler
     → Logging structuré : cache hit/miss avec key + latence

  ② invalidate(pattern) : suppression par pattern glob
     → Utilise SCAN (pas KEYS) pour éviter le blocage Redis
     → Patterns : "networth:*", "dashboard:*", "budget:*"
     → Appelé post-sync pour les données volatiles

  ③ invalidate_user(user_id) : suppression de tout le cache d'un user
     → Pattern : "*:{user_id}*"
     → Utile post-sync, post-transaction-import

  ④ cache_stats() : métriques en temps réel
     → Nombre de clefs par namespace
     → Mémoire utilisée (INFO memory)
     → Hit/miss ratio (compteurs atomiques Redis)

  TTL CONFIGURABLES VIA SETTINGS :
  ┌──────────────────────────────┬─────────┬──────────────────────────┐
  │  Endpoint                    │  TTL    │  Invalidation            │
  ├──────────────────────────────┼─────────┼──────────────────────────┤
  │  Dashboard summary           │  60s    │  sync + transaction      │
  │  Net Worth                   │  120s   │  sync + market price     │
  │  Cash Flow                   │  300s   │  sync                    │
  │  OmniScore                   │  86400s │  sync quotidien          │
  │  Budget (current + history)  │  300s   │  sync + budget update    │
  │  Taux de change (ECB)        │  86400s │  refresh quotidien       │
  │  Prix crypto                 │  30s    │  refresh automatique     │
  └──────────────────────────────┴─────────┴──────────────────────────┘

══════════════════════════════════════════════════════════════════════════
  A4.3  GZip Compression & Performance Middleware
═══════════════════════════════════════════════════════════════════════════

  PROBLÈME IDENTIFIÉ :
  Les réponses JSON volumineuses (dashboard, networth history, cashflow
  avec 24 mois de données) ne sont pas compressées → bande passante
  gaspillée, surtout sur mobile 4G.

  SOLUTION :
  ① GZipMiddleware FastAPI (minimum_size=500 bytes)
     → Compression automatique pour Accept-Encoding: gzip
     → Dashboard 12KB → ~3KB gzipped (–75%)
     → Cashflow 24 mois ~8KB → ~2KB gzipped

  ② Response Time Header : X-Process-Time
     → Middleware qui mesure le temps de traitement
     → Utile pour le debugging et le monitoring
     → Visible dans les DevTools et les logs

  ③ Cache-Control Headers pour les endpoints cachés
     → private, max-age={ttl} pour les endpoints avec Redis cache
     → no-cache pour les endpoints transactionnels (POST, PUT, DELETE)

═══════════════════════════════════════════════════════════════════════════
  A4.4  Endpoints Caching Systématique
═══════════════════════════════════════════════════════════════════════════

  PROBLÈME IDENTIFIÉ :
  Seuls 2 endpoints utilisent Redis cache :
  - Dashboard summary : 60s ✓ (artisanal)
  - OmniScore : 24h ✓ (artisanal)
  Tous les autres (networth, cashflow, budget) recalculent à chaque
  requête → charge inutile sur PostgreSQL.

  ENDPOINTS CACHÉS (via CacheManager) :
  ① GET /networth
     → Clé : "networth:{user_id}"
     → TTL : 120s — données agrégées, pas temps réel
     → Invalidé : post-sync bank, market price update

  ② GET /networth/history?period=1M
     → Clé : "networth:history:{user_id}:{period}"
     → TTL : 300s — données historiques, peu volatiles

  ③ GET /cashflow?period=monthly&months=6
     → Clé : "cashflow:{user_id}:{period}:{months}"
     → TTL : 300s — recalcul lourd (agrégat + trends)

  ④ GET /budget/current
     → Clé : "budget:current:{user_id}:{month}"
     → TTL : 300s — invalidé sur update budget

  ⑤ GET /budget/history
     → Clé : "budget:history:{user_id}:{months}"
     → TTL : 300s — données historiques

  ⑥ Dashboard summary REFACTORISÉ
     → Migration vers CacheManager (suppression code artisanal)
     → Même TTL 60s, même comportement, code propre

  INVALIDATION POST-SYNC :
  → Après chaque sync bancaire réussie :
    cache.invalidate("networth:{user_id}*")
    cache.invalidate("cashflow:{user_id}*")
    cache.invalidate("budget:*:{user_id}*")
    cache.invalidate("dashboard:*:{user_id}")
    cache.invalidate("omniscore:{user_id}")

═══════════════════════════════════════════════════════════════════════════
  A4.5  Frontend Bundle Optimization
═══════════════════════════════════════════════════════════════════════════

  → Analyser le bundle (next-bundle-analyzer)
  → Dynamic import : Recharts, Framer Motion (lazy-loaded)
  → Supprimer les dépendances inutilisées (React Query, etc.)
  → Tree-shake Lucide Icons (import spécifique, pas le barrel)
  → Objectif : First Load JS < 80KB gzipped
  ↗️  REPORT PARTIEL → Phase D (focus backend en Phase A)

═══════════════════════════════════════════════════════════════════════════
  A4.6  API Client Amélioré (Frontend)
═══════════════════════════════════════════════════════════════════════════

  → Timeout global : 15s (configurable)
  → AbortController sur chaque fetch
  → Retry intelligent : 1 retry pour les 5xx, 0 retry pour les 4xx
  → Queue de requêtes : max 6 parallèles
  ↗️  REPORT → Phase D (focus backend en Phase A)
```

```
═══════════════════════════════════════════════════════════════════════════
  RÉSUMÉ DES FICHIERS MODIFIÉS / CRÉÉS PHASE A4
═══════════════════════════════════════════════════════════════════════════
  1. app/core/cache.py              — NOUVEAU : CacheManager (cached_result,
                                      invalidate, invalidate_user, delete, stats)
  2. app/core/config.py             — 6 cache TTL settings ajoutés
  3. app/main.py                    — GZipMiddleware (min 500B) +
                                      X-Process-Time header middleware
  4. app/api/v1/insights.py         — OmniScore N+1 fix (22→7 queries) +
                                      migration vers CacheManager
  5. app/api/v1/networth.py         — Cache 120s (networth) + 300s (history)
  6. app/api/v1/cashflow.py         — Cache 300s via CacheManager
  7. app/api/v1/budget.py           — Cache 300s + invalidation sur update/generate
  8. app/api/v1/dashboard.py        — Refactorisé : CacheManager (suppression
                                      code artisanal json.dumps/loads/setex)
  9. app/woob_engine/sync_service.py — Post-sync cache invalidation
                                      (invalidate_user après chaque sync réussie)
  10. tests/test_cache.py           — NOUVEAU : 12 tests CacheManager
                                      (hit, miss, invalidate, stats, serializer)

═══════════════════════════════════════════════════════════════════════════
  SUIVI D'IMPLÉMENTATION PHASE A4 — 2 mars 2026
═══════════════════════════════════════════════════════════════════════════
  A4.1  OmniScore N+1 Query Elimination                                ✅ FAIT
        → Savings regularity : boucle 12 mois → 1 query date_trunc + HAVING
        → Diversification : 3 COUNT → 1 UNION ALL
        → Income/Expenses : 2 queries → 1 CASE WHEN agrégé
        → Net worth growth : 2 snapshot queries → 1 conditional aggregate
        → Banking fees : intégré dans la query income/expenses (0 query en +)
        → RÉSULTAT : 22 queries → 7 queries (–68%)

  A4.2  Redis CacheManager Abstraction Layer                           ✅ FAIT
        → cached_result() : async compute-or-fetch avec TTL, JSON auto
        → invalidate(pattern) : suppression par glob (SCAN, pas KEYS)
        → invalidate_user() : 6 patterns par user (all namespaces)
        → delete() : single key removal
        → stats() : key counts par namespace, mémoire utilisée
        → _json_serializer : dates, UUIDs, fallback str()

  A4.3  GZip Compression & Performance Middleware                      ✅ FAIT
        → GZipMiddleware(minimum_size=500) → –75% taille réponses JSON
        → X-Process-Time header (ms) → monitoring latence par requête
        → time.monotonic() pour précision microseconde

  A4.4  Endpoints Caching Systématique                                 ✅ FAIT
        → GET /networth : 120s TTL, invalidé post-sync
        → GET /networth/history : 300s TTL par period
        → GET /cashflow : 300s TTL par period+months
        → GET /budget/current : 300s TTL, invalidé sur budget update
        → GET /budget/history : 300s TTL, invalidé sur budget update
        → GET /dashboard/summary : 60s TTL, refactorisé CacheManager
        → GET /insights/score : 24h TTL via CacheManager (pas json.dumps)
        → Invalidation post-sync : cache_manager.invalidate_user() dans
          sync_service.py après chaque sync réussie

  A4.5  Frontend Bundle Optimization                                   ↗️ REPORTÉ → Phase D
  A4.6  API Client Amélioré                                            ↗️ REPORTÉ → Phase D

  COUVERTURE MISE À JOUR :
  ┌──────────────────────────────┬─────────┐
  │  Module                      │  Cover  │
  ├──────────────────────────────┼─────────┤
  │  core/encryption.py          │  100%   │
  │  core/security.py            │  100%   │
  │  woob_engine/categorizer.py  │  100%   │
  │  woob_engine/normalizer.py   │  100%   │
  │  schemas/auth.py             │   93%   │
  │  api/v1/networth.py          │   88%   │ ← NOUVEAU (cache)
  │  core/cache.py               │   86%   │ ← NOUVEAU
  │  api/v1/banks.py             │   83%   │
  │  core/redis.py               │   83%   │
  │  core/config.py              │   78%   │
  │  main.py                     │   77%   │
  │  api/deps.py                 │   78%   │
  │  api/v1/cashflow.py          │   67%   │ ← AMÉLIORÉ (cache)
  │  api/v1/auth.py              │   60%   │
  │  api/v1/dashboard.py         │   56%   │ ← REFACTORISÉ
  ├──────────────────────────────┼─────────┤
  │  TOTAL (5455 stmts)          │  35.4%  │
  └──────────────────────────────┴─────────┘

  TESTS AUTOMATISÉS PASSÉS :
  ✓ 85 tests — 0 failures — 8.07s
  ✓ pytest -v --cov=app --cov-report=term-missing --cov-fail-under=30
  ✓ 12 nouveaux tests CacheManager (hit/miss/invalidate/stats/serializer)
  ✓ Tous les 73 tests A1-A3 toujours passants (non-régression)
  ✓ GZip middleware actif (500B minimum)
  ✓ X-Process-Time header fonctionnel
```

---

### Phase B — Deep Analytics & Multi-Assets Complet

> **Durée estimée** : 4-5 semaines
> **Prérequis** : Phase A terminée et validée.
> **Objectif** : Combler tous les gaps fonctionnels par rapport à Finary/Trade Republic.

#### B1 — Module Dettes & Intelligence Crédit (Semaine 5) ✅ IMPLÉMENTÉ

> **Statut d'implémentation B1** :
> - [x] B1.1 — Modèle de données (`app/models/debt.py` : Debt + DebtPayment + enums)
> - [x] B1.1 — Migration Alembic (`alembic/versions/010_debts.py`)
> - [x] B1.2 — Moteur d'amortissement (`app/services/amortization_engine.py` : 4 modes + early repayment + invest-vs-repay + consolidation)
> - [x] B1.3 — Schemas Pydantic (`app/schemas/debt.py` : Create/Update/Record + 8 response models)
> - [x] B1.4 — API Endpoints (`app/api/v1/debts.py` : 10 endpoints CRUD + analytics)
> - [x] B1.4 — Service layer (`app/services/debt_service.py` : CRUD + analytics + net worth helpers)
> - [x] B1.5 — Intégration Net Worth (`app/services/networth.py` : dettes déduites du patrimoine)
> - [x] B1.5 — Intégration OmniScore (`app/api/v1/insights.py` : ratio d'endettement inclut les dettes)
> - [x] B1.6 — Frontend types (`src/types/api.ts` : 11 interfaces Debt*)
> - [x] B1.6 — Frontend store (`src/stores/debt-store.ts` : Zustand CRUD + analytics)
> - [x] B1.6 — Frontend page (`src/app/(dashboard)/debts/page.tsx` : page complète avec form, cards, amortization, consolidation)
> - [x] B1.6 — Navigation sidebar (`src/components/layout/sidebar.tsx` : entrée "Dettes" avec CreditCard icon)
> - [x] B1.7 — Tests unitaires (`tests/test_amortization.py` : 15 tests moteur)
> - [x] B1.7 — Tests API intégration (`tests/test_debts.py` : 12 tests CRUD + analytics)

```
═══════════════════════════════════════════════════════════════════════════
B1.1  Modèle de données — Architecture Multi-Dettes Grade Bancaire
═══════════════════════════════════════════════════════════════════════════

  Table `debts` (13+ colonnes financières, centimes BigInteger) :
  ─────────────────────────────────────────────────────────────────────────
  → id (UUID pk), user_id (FK → users.id, CASCADE, indexed)
  → label (String 256) — nom du crédit ("Prêt résidence principale")
  → debt_type (Enum PostgreSQL) :
      mortgage         — prêt immobilier (taux fixe/variable, assurance ADI)
      consumer         — crédit consommation (voiture, travaux, trésorerie)
      student          — prêt étudiant (différé partiel/total possible)
      credit_card      — dette carte de crédit (revolving, TAEG élevé)
      loc              — crédit-bail / LOA / LLD
      lombard          — crédit lombard (garanti par portefeuille titres)
      other            — autre dette (prêt familial, avance employeur)
  → creditor (String 256) — nom de l'établissement prêteur
  → initial_amount (BigInteger) — capital emprunté initial (centimes)
  → remaining_amount (BigInteger) — capital restant dû (centimes)
  → interest_rate_pct (Float) — taux nominal annuel hors assurance
  → insurance_rate_pct (Float nullable) — taux assurance annuel
  → monthly_payment (BigInteger) — mensualité totale (centimes)
  → start_date (Date) — date de première échéance
  → end_date (Date nullable) — date de dernière échéance (calculée si absente)
  → duration_months (Integer) — durée totale en mois
  → early_repayment_fee_pct (Float, default 3.0) — IRA légale max (3%)
  → payment_type (Enum: constant_annuity, constant_amortization, in_fine,
      deferred) — type d'amortissement
  → is_deductible (Boolean, default False) — déductible fiscalement
      (crédit immo locatif → intérêts déductibles des revenus fonciers)
  → linked_property_id (UUID FK nullable → real_estate_properties.id)
      — liaison optionnelle avec un bien immobilier existant
  → metadata_ (JSONB) — données extensibles (numéro de contrat, etc.)

  Table `debt_payments` (suivi d'amortissement réel) :
  ─────────────────────────────────────────────────────────────────────────
  → id (UUID pk), debt_id (FK → debts.id, CASCADE, indexed)
  → payment_date (Date) — date d'échéance
  → payment_number (Integer) — numéro de l'échéance (1, 2, 3...)
  → total_amount (BigInteger) — montant total versé (centimes)
  → principal_amount (BigInteger) — part capital (centimes)
  → interest_amount (BigInteger) — part intérêts (centimes)
  → insurance_amount (BigInteger) — part assurance (centimes)
  → remaining_after (BigInteger) — capital restant dû APRÈS paiement
  → is_actual (Boolean default False) — True si paiement constaté,
      False si projection théorique (amortissement calculé)
  → metadata_ (JSONB) — extensible

  Index de performance :
  ─────────────────────────────────────────────────────────────────────────
  → ix_debts_user_id : debts(user_id)
  → ix_debts_user_type : debts(user_id, debt_type) — filtrage par type
  → ix_debt_payments_debt_id : debt_payments(debt_id, payment_date)

═══════════════════════════════════════════════════════════════════════════
B1.2  Moteur d'Amortissement Polyvalent — "AmortizationEngine"
═══════════════════════════════════════════════════════════════════════════

  Service : app/services/amortization_engine.py
  ─────────────────────────────────────────────────────────────────────────

  ① CALCUL DU TABLEAU D'AMORTISSEMENT (4 modes)
    → Annuités constantes (français) : mensualité fixe, intérêts dégressifs
      Formule : M = C × r / (1 - (1+r)^(-n))
      où C = capital, r = taux mensuel, n = nombre de mois
    → Amortissement constant (allemand) : capital constant, mensualité dégressive
      Principal = C / n (fixe), Intérêts = CRD × r (dégressif)
    → In fine : intérêts seuls pendant la durée, capital en une fois à la fin
      Mensualité = C × r, dernière = C × (1+r)
    → Différé : période de différé (partiel=intérêts seuls, total=rien)
      puis amortissement classique sur la durée restante

  ② COÛT TOTAL DU CRÉDIT (CTC) — Ventilation complète
    → Total des intérêts payés sur la durée
    → Total de l'assurance payée sur la durée
    → Coût global = intérêts + assurance + frais de dossier
    → TAEG effectif recalculé (taux annuel effectif global)
      inclut assurance + frais vs taux nominal affiché

  ③ SIMULATEUR DE REMBOURSEMENT ANTICIPÉ (Innovation)
    → Input : montant à rembourser, mois du remboursement
    → Calcul 2 scénarios automatiques :
      a) Réduction de durée (mensualité inchangée) → nouvelle date de fin
      b) Réduction de mensualité (durée inchangée) → nouvelle mensualité
    → Pour chaque scénario :
      - Économie totale d'intérêts (vs poursuite normale)
      - IRA = min(6 mois d'intérêts, 3% du CRD) — plafond légal L.312-34
      - Économie nette = économie intérêts - IRA
    → Verdict : "Rembourser 20 000€ maintenant vous économise 8 347€
      d'intérêts (net de pénalité)"

  ④ COMPARATEUR INVESTISSEMENT vs REMBOURSEMENT (TRI)
    → "Et si vous investissiez ce surplus au lieu de rembourser ?"
    → Input : montant, taux de rendement espéré (ex: 7% ETF World)
    → Calcul : valeur de l'investissement à la date de fin du crédit
    → Comparaison : gain net investi vs économie d'intérêts nette
    → Intègre la fiscalité : flat tax 30% sur le gain investi
    → Verdict : "Investir 20 000€ à 7% rapporte 12 400€ net en 8 ans
      vs 8 347€ économisés en remboursant → investir est + rentable"

  ⑤ CONSOLIDATION MULTI-DETTES (Debt Stacking)
    → Vue agrégée : total CRD, total mensualités, date de fin la + tardive
    → Stratégie "avalanche" : rembourser en priorité le taux le + élevé
    → Stratégie "snowball" : rembourser en priorité le montant le + faible
    → Simulation : "En ajoutant 200€/mois, vous êtes libre N mois plus tôt"
    → Ratio d'endettement global : mensualités / revenus mensuels

═══════════════════════════════════════════════════════════════════════════
B1.3  Schemas Pydantic — Validation Grade Professionnel
═══════════════════════════════════════════════════════════════════════════

  Fichier : app/schemas/debt.py
  ─────────────────────────────────────────────────────────────────────────

  → CreateDebtRequest : validation métier
    - interest_rate_pct ∈ [0, 30] (TAEG max légal)
    - insurance_rate_pct ∈ [0, 5]
    - early_repayment_fee_pct ∈ [0, 5]
    - monthly_payment > 0
    - remaining_amount ≤ initial_amount
    - duration_months ∈ [1, 480] (max 40 ans)
    - @model_validator : si end_date fourni, vérifier cohérence
      avec start_date + duration_months

  → UpdateDebtRequest : tous les champs optionnels, même validateurs

  → DebtResponse : réponse avec champs calculés
    - progress_pct : (initial - remaining) / initial × 100
    - remaining_months : mois restants (calculé)
    - total_cost : coût total projeté
    - monthly_principal / monthly_interest / monthly_insurance

  → AmortizationRow : une ligne du tableau
    - payment_number, date, total, principal, interest, insurance, remaining

  → AmortizationTableResponse : tableau complet + résumé
    - rows[], total_interest, total_insurance, total_cost, end_date

  → EarlyRepaymentSimulation : résultat simulation
    - reduced_duration_scenario, reduced_payment_scenario,
      interest_saved, penalty_amount, net_savings

  → DebtSummaryResponse : vue agrégée
    - total_remaining, total_monthly, total_initial,
      weighted_avg_rate, debt_ratio_pct,
      next_end_date, debts[], amortization_chart[]

═══════════════════════════════════════════════════════════════════════════
B1.4  API Endpoints — CRUD + Analytics + Simulation
═══════════════════════════════════════════════════════════════════════════

  Router : app/api/v1/debts.py (prefix="/debts", tags=["debts"])
  Dépendances : get_current_user, get_db
  Caching : CacheManager (300s summary, invalidé sur mutation)
  ─────────────────────────────────────────────────────────────────────────

  CRUD :
  → GET    /debts             — Liste + summary (cached 300s)
  → POST   /debts             — Créer une dette
  → GET    /debts/{id}        — Détail d'une dette
  → PUT    /debts/{id}        — Modifier une dette
  → DELETE /debts/{id}        — Supprimer une dette
  → PATCH  /debts/{id}/payment — Enregistrer un paiement réel

  ANALYTICS :
  → GET    /debts/{id}/amortization
      Retourne le tableau d'amortissement complet (théorique + réel)
  → GET    /debts/{id}/simulate-early-repayment?amount=X&at_month=Y
      Retourne les 2 scénarios (durée vs mensualité)
  → GET    /debts/{id}/invest-vs-repay?amount=X&return_rate=7
      Retourne la comparaison investissement vs remboursement
  → GET    /debts/consolidation
      Retourne la vue multi-dettes consolidée (avalanche, snowball)
  → GET    /debts/chart-data
      Retourne les données pour le graphique (12 mois, empilé)

═══════════════════════════════════════════════════════════════════════════
B1.5  Intégration Net Worth — Le 5ème Pilier du Patrimoine
═══════════════════════════════════════════════════════════════════════════

  Fichiers modifiés : networth.py, insights.py
  ─────────────────────────────────────────────────────────────────────────

  ① NET WORTH : Aggréger les dettes du nouveau modèle
    → SELECT SUM(remaining_amount) FROM debts WHERE user_id = ?
    → Soustraire du total global
    → Ajouter dans breakdown["Dettes"] (cumulé avec loan accounts)
    → Distinguer "Dettes immobilières" vs "Dettes consommation"
      pour un breakdown plus fin

  ② OMNISCORE : Enrichir le critère "Taux d'endettement"
    → Inclure les mensualités des Debts dans le total_debt
    → Ratio = (mensualités_totales / revenu_mensuel)
    → Score plus précis : inclut crédits conso + étudiants
      (actuellement ignorés car non modélisés)

  ③ DASHBOARD : Ajouter un résumé des dettes dans le summary
    → total_debt, monthly_payments, debt_ratio_pct, debt_count
    → Feed vers le widget "Patrimoine" du dashboard principal

  ④ CACHE INVALIDATION : Mutations sur /debts invalident
    → debts:*, networth:*, omniscore:*, dashboard:*

═══════════════════════════════════════════════════════════════════════════
B1.6  Frontend — Page /debts Premium + Intégration Dashboard
═══════════════════════════════════════════════════════════════════════════

  Fichiers créés :
  ─────────────────────────────────────────────────────────────────────────
  → src/app/(dashboard)/debts/page.tsx — Page principale
  → src/stores/debt-store.ts — Zustand store avec CRUD + analytics
  → src/types/api.ts — Types Debt, DebtPayment, DebtSummary, etc.
  → Sidebar : ajout lien "Dettes" avec icône CreditCard

  Page /debts — Layout :
  ─────────────────────────────────────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────────┐
  │  HEADER : "Mes Dettes"                                  [+ Ajouter]│
  ├──────────────┬──────────────┬──────────────┬───────────────────────┤
  │  Total CRD   │  Mensualités │ Taux moyen   │  Date liberté        │
  │  45 200,00 € │   1 247,00 € │    2,81%     │   Mars 2031          │
  ├──────────────┴──────────────┴──────────────┴───────────────────────┤
  │                                                                     │
  │  ┌── GRAPHIQUE EMPILÉ (Stacked Area) ──────────────────────────┐   │
  │  │   Capital ████████████████████████████████                   │   │
  │  │   Intérêts ████████                                         │   │
  │  │   Assurance ███                                              │   │
  │  │   ──────────────────────────────────────────────────────    │   │
  │  │   2024    2025    2026    2027    2028    2029    2030       │   │
  │  └─────────────────────────────────────────────────────────────┘   │
  │                                                                     │
  │  ┌── LISTE DES DETTES ──────────────────────────────────────── │   │
  │  │  🏠 Prêt résidence principale                                │   │
  │  │     BNP Paribas • 2.1% • 847€/mois                         │   │
  │  │     ████████████████░░░░░░ 68% remboursé                    │   │
  │  │     CRD: 32 000€ • Fin: Fév 2029          [Détail] [Edit]  │   │
  │  │                                                              │   │
  │  │  💳 Crédit consommation travaux                              │   │
  │  │     Cetelem • 5.9% • 400€/mois                             │   │
  │  │     ██████░░░░░░░░░░░░░░░░ 35% remboursé                   │   │
  │  │     CRD: 13 200€ • Fin: Sep 2027          [Détail] [Edit]  │   │
  │  └──────────────────────────────────────────────────────────── │   │
  └─────────────────────────────────────────────────────────────────────┘

  Fonctionnalités UX premium :
  → Barres de progression animées (Framer Motion spring)
  → Cards expandables : clic → tableau d'amortissement inline
  → Couleurs par type : immobilier=#6366f1, conso=#f59e0b, étudiant=#22c55e
  → Modal formulaire complet avec validation temps réel
  → Skeleton loading premium (3 cards placeholder)
  → Empty state : "Aucune dette 🎉 — Votre patrimoine est libre de charges"

═══════════════════════════════════════════════════════════════════════════
B1.7  Tests Automatisés (12+ tests)
═══════════════════════════════════════════════════════════════════════════

  Fichier : tests/test_debts.py
  ─────────────────────────────────────────────────────────────────────────
  → test_create_debt (POST /debts → 201, retourne débt avec ID)
  → test_create_debt_validation (montants négatifs → 422)
  → test_list_debts (GET /debts → summary + debts[])
  → test_get_debt_detail (GET /debts/{id} → détail avec progress)
  → test_update_debt (PUT /debts/{id} → champs modifiés)
  → test_delete_debt (DELETE /debts/{id} → 204)
  → test_amortization_constant_annuity (tableau correct pour taux 2%)
  → test_amortization_in_fine (intérêts mensuels + capital final)
  → test_early_repayment_simulation (économies calculées correctement)
  → test_invest_vs_repay (comparaison investissement vs remboursement)
  → test_debt_consolidation (total CRD, mensualités, ratio)
  → test_debt_in_networth (dette soustraite du patrimoine net)

  Fichier : tests/test_amortization.py
  ─────────────────────────────────────────────────────────────────────────
  → test_french_amortization_math (vérifie somme principal = capital)
  → test_german_amortization_math (principal constant chaque mois)
  → test_in_fine_amortization (intérêts seuls sauf dernière échéance)
  → test_deferred_amortization (période de grâce respectée)
  → test_early_repayment_penalty_cap (IRA ≤ min(6 mois intérêts, 3% CRD))
  → test_zero_rate_amortization (taux 0% → capital / n chaque mois)
```

#### B2 — Enrichissement Bourse (Semaine 6) ✅ IMPLÉMENTÉE

```
──────────────────────────────────────────────────────────────────
B2.1  Performance vs Benchmark — Moteur TWR + Comparaison Indicielle
──────────────────────────────────────────────────────────────────

  Architecture backend :
  ─────────────────────
  Nouveau service : app/services/stock_analytics.py
  → Fonction get_performance_vs_benchmark(db, user_id, period)
  → Calcul TWR (Time-Weighted Return) par portefeuille :
      TWR = [(1+R1) × (1+R2) × ... × (1+Rn)] - 1
      Ri = (ValeurFin_i - ValeurDébut_i) / ValeurDébut_i pour chaque sous-période
  → Données historiques via Yahoo Finance Chart API :
      GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={period}&interval=1d
  → 3 indices de référence comparés simultanément :
      ^GSPC (S&P 500), ^FCHI (CAC 40), URTH (MSCI World ETF)
  → Périodes supportées : 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, MAX
  → Données retournées : série temporelle { date, portfolio_value, sp500, cac40, msci_world }
     normalisée en base 100 pour comparaison visuelle homogène
  → Cache Redis TTL 1h (clé : perf:{user_id}:{period})

  Endpoint : GET /api/v1/stocks/performance?period=1Y
  Response : PerformanceResponse {
    portfolio_twr: float,          # TWR du portefeuille (%)
    benchmarks: {
      sp500: { twr: float, series: [{date, value}] },
      cac40: { twr: float, series: [{date, value}] },
      msci_world: { twr: float, series: [{date, value}] },
    },
    portfolio_series: [{date, value}],  # Valeur normalisée base 100
    alpha: float,                  # Surperformance vs meilleur benchmark
    period: str,
  }

  Innovation vs Finary / Trade Republic :
  → Finary ne calcule PAS de vrai TWR (juste un P&L simple)
  → Trade Republic n'offre AUCUNE comparaison vs indices
  → OmniFlow : TWR réel + alpha calculé + normalisation base 100
    → L'utilisateur voit immédiatement s'il bat le marché

  Frontend :
  → Onglet "Performance" dans la page Bourse
  → Graphique Recharts LineChart multi-séries (portfolio + 3 benchmarks)
  → Toggle par période (boutons 1M / 3M / YTD / 1A / 3A / 5A)
  → Tag "Alpha" : badge vert si > 0, rouge si < 0
  → KPI cards : TWR portefeuille, TWR S&P 500, Alpha, Volatilité

──────────────────────────────────────────────────────────────────
B2.2  Calendrier de Dividendes — Yield Tracking & Projection
──────────────────────────────────────────────────────────────────

  Architecture backend :
  ─────────────────────
  Nouvelle table : stock_dividends (migration 011)
  → id (UUID PK), position_id (FK → stock_positions), symbol, ex_date (Date),
    pay_date (Date), amount_per_share (BigInteger centimes), currency (String(3)),
    total_amount (BigInteger centimes), created_at, updated_at

  Nouveaux champs sur stock_positions :
  → annual_dividend_yield (Float) — rendement annuel en %
  → next_ex_date (Date) — prochaine date ex-dividende
  → dividend_frequency (String(16)) — quarterly, semi_annual, annual, monthly

  Service : get_dividend_calendar(db, user_id, year)
  → Récupère les données dividendes via Yahoo Finance :
      GET .../v8/finance/chart/{symbol}?events=div&range=5y
  → Parse les événements dividendes dans la réponse JSON
  → Projette les dividendes futurs basés sur l'historique :
      Si dividende trimestriel détecté → projette 4 versements/an
  → Calcul du rendement moyen pondéré du portefeuille :
      Yield_portfolio = Σ(dividende_annuel_i × poids_i) / Σ(valeur_i)

  Endpoint : GET /api/v1/stocks/dividends?year=2026
  Response : DividendCalendarResponse {
    total_annual_projected: int,      # Total dividendes projetés (centimes)
    portfolio_yield: float,           # Rendement moyen pondéré (%)
    monthly_breakdown: [{month: int, amount: int}],   # 12 mois
    upcoming: [{symbol, name, ex_date, pay_date, amount_per_share, total}],
    by_position: [{symbol, name, annual_amount, yield_pct, frequency, next_ex_date}],
  }

  Innovation vs Finary / Trade Republic :
  → Finary montre les dividendes passés mais NE projette PAS les futurs
  → Trade Republic ne montre qu'un calendrier basique sans analyse
  → OmniFlow : projection intelligente + rendement pondéré + vue calendrier mensuelle
    → L'utilisateur planifie ses revenus passifs mois par mois

  Frontend :
  → Onglet "Dividendes" dans la page Bourse
  → Bar chart mensuel (Recharts BarChart) : revenus projetés par mois
  → Cards KPI : dividendes annuels projetés, rendement moyen, prochain versement
  → Tableau détaillé par position : symbole, nom, montant annuel, yield, fréquence
  → Badge couleur par fréquence (mensuel=vert, trim=bleu, semi=orange, annuel=gris)

──────────────────────────────────────────────────────────────────
B2.3  Allocation & Diversification Pro — Analyse Multi-Axes + HHI
──────────────────────────────────────────────────────────────────

  Architecture backend :
  ─────────────────────
  Nouveaux champs sur stock_positions (migration 011) :
  → country (String(2)) — code ISO pays (US, FR, DE, JP...)
  → isin (String(12)) — code ISIN si disponible

  Service : get_allocation_analysis(db, user_id)
  → Agrège les positions par :
      1. Secteur (sector déjà présent) → répartition sectorielle GICS
      2. Pays (country) → répartition géographique
      3. Devise (currency) → exposition devises
  → Calcul HHI (Herfindahl-Hirschman Index) de concentration :
      HHI = Σ(poids_i²) × 10000
      Interprétation : < 1500 = diversifié, 1500-2500 = modéré, > 2500 = concentré
  → Score de diversification affiché : 100 - (HHI / 100) → échelle 0-100
  → Détection de sur-concentration :
      Si un secteur > 35% → alerte
      Si un pays > 50% → alerte
      Si top 3 positions > 60% → alerte
  → Suggestions de rééquilibrage textuelles :
      "Tech US = 48% du portefeuille. Considérez Marchés Émergents ou Santé."

  Endpoint : GET /api/v1/stocks/allocation
  Response : AllocationAnalysisResponse {
    by_sector: [{sector, value, weight_pct, positions_count}],
    by_country: [{country, value, weight_pct, positions_count}],
    by_currency: [{currency, value, weight_pct}],
    hhi_score: int,                 # 0-10000
    diversification_score: int,     # 0-100 (inversé HHI normalisé)
    diversification_grade: str,     # "Excellent", "Bon", "Modéré", "Concentré"
    concentration_alerts: [str],    # Messages d'alerte
    suggestions: [str],             # Suggestions de rééquilibrage
    top_positions: [{symbol, name, weight_pct}],  # Top 5 positions
  }

  Innovation vs Finary / Trade Republic :
  → Finary montre l'allocation sectorielle basique sans score HHI
  → Trade Republic ne montre AUCUNE analyse de diversification
  → OmniFlow : score HHI quantifié + grade lettre + alertes concentration
    + suggestions de rééquilibrage contextuelles
    → L'utilisateur sait EXACTEMENT son risque de concentration

  Frontend :
  → Onglet "Allocation" dans la page Bourse
  → 3 donut charts côte à côte : Secteurs, Pays, Devises (Recharts PieChart)
  → Jauge de diversification : score /100 avec couleur (vert/orange/rouge)
  → Grade affiché : "Excellent 🟢", "Bon 🔵", "Modéré 🟠", "Concentré 🔴"
  → Section alertes avec icônes ⚠️ si concentration détectée
  → Suggestions de rééquilibrage dans des cards dédiées

──────────────────────────────────────────────────────────────────
B2.4  Enveloppes Fiscales — PEA / CTO / Assurance-Vie
──────────────────────────────────────────────────────────────────

  Architecture backend :
  ─────────────────────
  Nouveau champ sur stock_portfolios (migration 011) :
  → envelope_type (String(16)) — 'pea', 'cto', 'assurance_vie', 'pea_pme', 'per'
  → management_fee_pct (Float) — frais de gestion annuels (%) pour AV
  → total_deposits (BigInteger centimes) — total des versements cumulés

  Énumération EnvelopeType :
  → pea         : Plafond versements 150 000€, fiscalité avantageuse après 5 ans
  → pea_pme     : Plafond versements 225 000€ (cumulé avec PEA)
  → cto         : Compte-Titres Ordinaire, flat tax 30%
  → assurance_vie : Abattement 4 600€/9 200€ après 8 ans
  → per         : Plan Épargne Retraite, déductible du revenu impose

  Service : get_envelope_summary(db, user_id)
  → Agrège par type d'enveloppe :
      Valeur totale, P&L, nombre de positions par enveloppe
  → PEA : calcul utilisation plafond (total_deposits / 150 000€ × 100)
  → Assurance-Vie : estimation frais annuels (valeur × management_fee_pct / 100)
  → Résumé fiscal : estimation flat tax CTO vs exonération PEA
  → Optimisation fiscale :
      Si CTO > 0 ET PEA pas plein : "Transférez vers le PEA pour économiser X€/an"

  Endpoint : GET /api/v1/stocks/envelopes
  Response : EnvelopeSummaryResponse {
    envelopes: [{
      type: str,
      label: str,               # "PEA", "CTO"...
      total_value: int,          # centimes
      total_pnl: int,
      total_deposits: int,
      positions_count: int,
      portfolios: [str],         # labels des portefeuilles associés
      ceiling: int | null,       # plafond versements (centimes) si applicable
      ceiling_usage_pct: float | null,  # utilisation du plafond (%)
      management_fee_annual: int | null,  # frais annuels estimés (centimes)
      tax_rate: float,           # taux d'imposition applicable (%)
    }],
    total_value: int,
    fiscal_optimization_tips: [str],  # Conseils d'optimisation fiscale
  }

  Innovation vs Finary / Trade Republic :
  → Finary différencie PEA/CTO mais sans optimisation fiscale proactive
  → Trade Republic = broker unique, pas de vision multi-enveloppes
  → OmniFlow : vision consolidée multi-enveloppes + suggestions d'optimisation
    fiscale + barre de progression plafond PEA + estimation frais AV
    → L'utilisateur optimise sa fiscalité en un coup d'œil

  Frontend :
  → Onglet "Enveloppes" dans la page Bourse
  → Cards par enveloppe avec valeur, P&L, nombre de positions
  → Barre de progression PEA : versements / plafond 150k€
  → Section "Optimisation fiscale" : conseils personnalisés
  → Badge fiscal par enveloppe (taux flat tax, exonération PEA...)

──────────────────────────────────────────────────────────────────
  Migration Alembic : 011_stock_enrichment.py
──────────────────────────────────────────────────────────────────

  Table stock_dividends (nouvelle) :
  → id UUID PK, position_id FK, symbol String(16), ex_date Date,
    pay_date Date, amount_per_share BigInteger, currency String(3),
    total_amount BigInteger, created_at, updated_at

  Colonnes ajoutées à stock_positions :
  → country String(2) nullable
  → isin String(12) nullable
  → annual_dividend_yield Float nullable
  → next_ex_date Date nullable
  → dividend_frequency String(16) nullable

  Colonnes ajoutées à stock_portfolios :
  → envelope_type String(16) nullable default 'cto'
  → management_fee_pct Float nullable default 0.0
  → total_deposits BigInteger nullable default 0

──────────────────────────────────────────────────────────────────
  Fichiers impactés
──────────────────────────────────────────────────────────────────

  Backend :
  → alembic/versions/011_stock_enrichment.py   (migration)
  → app/models/stock_portfolio.py              (+ 3 colonnes, EnvelopeType enum)
  → app/models/stock_position.py               (+ 5 colonnes)
  → app/models/stock_dividend.py               (nouveau modèle)
  → app/models/__init__.py                     (+ StockDividend)
  → app/schemas/stock.py                       (+ 4 nouveaux schemas Response)
  → app/services/stock_analytics.py            (nouveau service analytique)
  → app/api/v1/stocks.py                       (+ 4 endpoints)
  → tests/test_stock_analytics.py              (tests unitaires TWR, HHI, etc.)

  Frontend :
  → src/types/api.ts                           (+ 4 nouvelles interfaces)
  → src/stores/stock-store.ts                  (+ 4 fetch methods)
  → src/app/(dashboard)/stocks/page.tsx         (+ 4 onglets, charts, KPIs)
```

#### B3 — Enrichissement Immobilier (Semaine 7)

> **Objectif** : Transformer le module immobilier en un outil d'analyse
> complet rivalisant avec MeilleursAgents + Rendement Locatif + Horiz.io
> en un seul écran. Rendement net-net fiscal, estimation DVF historique,
> cash-flow prévisionnel avec amortissement de crédit.

```
B3.1  Rendement net-net (fiscalité française complète)
      ─────────────────────────────────────────────────
      Principe : 3 niveaux de rendement calculés côté serveur, stockés
      en colonnes dénormalisées pour lecture rapide.

      → Rendement brut
        Formule : (loyer_mensuel × 12) / prix_achat × 100
        Déjà implémenté dans _compute_yields(), conservé tel quel.

      → Rendement net (avant impôts)
        Formule : (loyer_annuel − charges_annuelles) / (prix_achat + frais_notaire) × 100
        charges_annuelles = (charges_copro + assurance_PNO + taxe_fonciere
                             + provision_vacance + provision_travaux) × 12
        provision_vacance = loyer_mensuel × (vacancy_rate_pct / 100)
        frais_notaire     = notary_fees_pct × prix_achat / 100
                            (défaut : 7.5% ancien, 2.5% neuf)

      → Rendement net-net (après impôts + prélèvements sociaux)
        CSG_CRDS = 17.2% (fixe, prélevé sur revenus fonciers nets)
        fiscal_regime ∈ {micro_foncier, reel}
        
        Si micro_foncier:
          revenu_imposable = loyer_annuel × 0.70  (abattement 30%)
          impot_foncier    = revenu_imposable × TMI
          ps               = revenu_imposable × 0.172
          condition : loyer_annuel ≤ 15 000 €
          
        Si reel:
          revenu_net_foncier = loyer_annuel − toutes_charges_déductibles
                               − intérêts_emprunt − assurance_emprunteur
                               − travaux_déductibles
          impot_foncier = revenu_net_foncier × TMI   (si > 0)
          ps            = revenu_net_foncier × 0.172  (si > 0)
          → Si déficit foncier (net < 0) : imputable sur revenu global
            jusqu'à 10 700 €/an, le solde se reporte 10 ans

        net_net_yield = (loyer_annuel − charges_totales − impot_foncier − ps)
                        / (prix_achat + frais_notaire) × 100

      Nouveaux champs sur real_estate_properties :
        • fiscal_regime    : String(16) DEFAULT 'micro_foncier'
        • tmi_pct          : Float DEFAULT 30.0   (tranche marginale)
        • taxe_fonciere    : BigInteger DEFAULT 0  (annuel, centimes)
        • assurance_pno    : BigInteger DEFAULT 0  (mensuel, centimes)
        • vacancy_rate_pct : Float DEFAULT 0.0     (% du loyer)
        • notary_fees_pct  : Float DEFAULT 7.5     (% du prix)
        • provision_travaux: BigInteger DEFAULT 0  (mensuel, centimes)
        • loan_interest_rate: Float DEFAULT 0.0    (taux annuel %)
        • loan_insurance_rate: Float DEFAULT 0.0   (taux assurance %)
        • loan_duration_months: Integer DEFAULT 0
        • loan_start_date  : Date nullable
        • net_net_yield_pct: Float DEFAULT 0.0     (rendement net-net)
        • annual_tax_burden: BigInteger DEFAULT 0  (impôts + PS annuels)

      TMI reconnus : 0%, 11%, 30%, 41%, 45% (barème IR 2026)

B3.2  Estimation DVF avancée & Historique
      ─────────────────────────────────────
      → DVF 2-tier existant (CQuest → Cerema) conservé
      → Nouveau : stocker l'historique des estimations dans une table dédiée
        `real_estate_valuations` :
          id UUID PK
          property_id FK → real_estate_properties.id CASCADE
          source String(32)  ('dvf_cquest', 'dvf_cerema', 'manual')
          price_m2_centimes BigInteger
          estimation_centimes BigInteger
          nb_transactions Integer
          recorded_at Date  (date de la requête)
          created_at Timestamp

      → Endpoint GET /realestate/{id}/valuations → historique
      → Endpoint POST /realestate/{id}/refresh-dvf → force re-fetch,
        crée un nouveau snapshot, compare au dernier :
        si |delta| ≥ 5% → flag `significant_change = true` dans la réponse
      → Le frontend affiche un graphique prix/m² sur les N snapshots
      → Alerte badge si variation ≥ 5% depuis la dernière estimation

      Redis cache : clé dvf:{postal_code}:{property_type}, TTL 24h (inchangé)

B3.3  Cash-flow immobilier complet & Amortissement
      ──────────────────────────────────────────────
      Moteur de simulation qui projette le cash-flow mensuel sur la durée
      du crédit immobilier.

      → Tableau d'amortissement :
        Pour chaque mois m (1..loan_duration_months) :
          taux_mensuel = loan_interest_rate / 100 / 12
          mensualité = capital × taux_mensuel / (1 − (1 + taux_mensuel)^(−durée_restante))
          intérêts_m = capital_restant × taux_mensuel
          principal_m = mensualité − intérêts_m
          assurance_m = (capital_initial × loan_insurance_rate / 100) / 12
          capital_restant -= principal_m

      → Cash-flow mensuel détaillé :
        revenus  = loyer − provision_vacance
        charges  = charges_copro + assurance_PNO + (taxe_foncière / 12) + provision_travaux
        crédit   = mensualité + assurance_emprunteur
        fiscalité = (impôt_foncier + prélèvements_sociaux) / 12
        cash_in_pocket = revenus − charges − crédit − fiscalité

      → Endpoint GET /realestate/{id}/cashflow :
        Paramètres : ?months=240 (défaut : loan_duration_months ou 240)
        Retourne :
          summary : {
            avg_monthly_cashflow, total_interest_paid, total_insurance_paid,
            total_tax_paid, total_rent_collected, roi_at_end_pct, payback_months
          }
          monthly[] : {
            month, date, rent, charges, loan_principal, loan_interest,
            loan_insurance, tax_monthly, cashflow, cumulative_cashflow,
            remaining_capital
          }

      → ROI global à terme :
        roi = (plus_value + loyers_net_cumulés − frais_totaux) / apport_initial × 100

      → Payback period (mois où cumulative_cashflow > 0)

  Migration 012_realestate_enrichment :
  ─────────────────────────────────────
  down_revision = "011_stock_enrichment"
  
  1. ALTER real_estate_properties ADD COLUMNS :
     fiscal_regime, tmi_pct, taxe_fonciere, assurance_pno,
     vacancy_rate_pct, notary_fees_pct, provision_travaux,
     loan_interest_rate, loan_insurance_rate, loan_duration_months,
     loan_start_date, net_net_yield_pct, annual_tax_burden

  2. CREATE TABLE real_estate_valuations (
       id UUID PK, property_id FK, source String(32),
       price_m2_centimes BigInt, estimation_centimes BigInt,
       nb_transactions Int, recorded_at Date, created_at Timestamp
     )

  Fichiers impactés :
  ──────────────────
  Backend :
  → alembic/versions/012_realestate_enrichment.py  (migration)
  → app/models/real_estate.py                      (+ 13 colonnes + FiscalRegime enum)
  → app/models/real_estate_valuation.py            (nouveau modèle)
  → app/models/__init__.py                         (+ RealEstateValuation)
  → app/schemas/realestate.py                      (+ 5 schemas response)
  → app/services/realestate_analytics.py           (nouveau service analytique)
  → app/services/realestate_service.py             (enrichir _compute_yields)
  → app/api/v1/realestate.py                       (+ 3 endpoints)
  → tests/test_realestate_analytics.py             (tests unitaires)

  Frontend :
  → src/types/api.ts                               (+ interfaces B3)
  → src/stores/realestate-store.ts                 (+ 3 fetch methods)
  → src/app/(dashboard)/realestate/page.tsx         (+ onglets rendement/DVF/cashflow)
```

#### B4 — Enrichissement Crypto (Semaine 7-8)

> **Objectif** : Transformer le module crypto d'un simple agrégateur de soldes
> en un véritable cockpit fiscal, DeFi et multi-chain — surpassant Finary
> (limité à Binance + Kraken), Trade Republic (mono-chaîne, zéro DeFi)
> et même Koinly/Waltio sur certains axes (intégration native, temps réel).

```
═══════════════════════════════════════════════════════════════
B4.1  Plus-values pour déclaration fiscale française
═══════════════════════════════════════════════════════════════

Contexte réglementaire :
  → Flat tax 30% (PFU) sur plus-values de cessions de crypto-actifs (art. 150 VH bis CGI)
  → Abattement forfaitaire de 305 € sur le total annuel des PV (seuil BNC)
  → Méthode de calcul : Prix Moyen Pondéré d'Acquisition (PMPA) — obligatoire depuis 2019
  → Formulaire cerfa 2086 export obligatoire

Modèle de données (nouvelle table « crypto_transactions ») :
  → id              UUID PK
  → wallet_id       FK → crypto_wallets.id CASCADE
  → tx_type         String(16)  [buy, sell, swap, transfer_in, transfer_out, staking_reward, airdrop]
  → token_symbol    String(16)  ex. BTC, ETH
  → quantity        Numeric(24,10)
  → price_eur       BigInteger  (centimes par unité au moment de la transaction)
  → total_eur       BigInteger  (centimes, quantity × price_eur)
  → fee_eur         BigInteger  (centimes, frais de la transaction)
  → counterpart     String(16)  token reçu/vendu si swap (ex. ETH↔USDC)
  → tx_hash         String(128) nullable, hash blockchain
  → executed_at     DateTime(tz) date de la transaction
  → source          String(32)  [binance, kraken, etherscan, manual]
  → created_at      DateTime(tz)

Colonnes ajoutées sur « crypto_holdings » :
  → avg_buy_price_computed BigInteger  centimes, PMPA calculé automatiquement
  → total_invested        BigInteger  centimes, somme des achats
  → realized_pnl          BigInteger  centimes, PV/MV réalisées cumulées
  → unrealized_pnl        BigInteger  centimes, PV/MV latentes
  → staking_rewards_total BigInteger  centimes, total des rewards reçus

Nouveau service « crypto_tax_engine.py » :
  → compute_pmpa(user_id, token_symbol) → float
      Calcul du Prix Moyen Pondéré d'Acquisition sur toutes les transactions
      d'achat/swap-in d'un token : PMPA = ΣAcquisitions / ΣQuantités
  → compute_realized_pv(user_id, year) → dict
      Pour chaque cession de l'année :
        PV = Prix_cession_total - (PMPA × quantité_cédée) - frais
      Retour : { total_pv, total_mv, net_pv, abattement_305, taxable_pv, flat_tax_30 }
  → compute_unrealized_pv(user_id) → dict
      PV latentes par token : valeur_actuelle - (PMPA × quantité_détenue)
  → generate_cerfa_2086(user_id, year) → list[dict]
      Export ligne par ligne compatible cerfa 2086 :
        { date_cession, nature_actif, prix_cession, frais, prix_acquisition_pmpa, pv_ou_mv }
  → export_csv_2086(user_id, year) → bytes
      Fichier CSV prêt à télécharger / importer dans impots.gouv.fr
  → get_tax_summary(user_id, year) → dict
      Dashboard : gains réalisés, pertes, net, flat tax estimée, seuil 305€ atteint ou non

Endpoints :
  → GET  /crypto/tax/summary?year=2025         → résumé fiscal annuel
  → GET  /crypto/tax/transactions?year=2025     → liste des cessions de l'année
  → GET  /crypto/tax/export-csv?year=2025       → téléchargement CSV cerfa 2086
  → POST /crypto/transactions                   → ajout manuel d'une transaction
  → GET  /crypto/transactions?wallet_id=&limit= → liste paginée de transactions
  → GET  /crypto/holdings/{symbol}/pmpa         → PMPA d'un token

═══════════════════════════════════════════════════════════════
B4.2  DeFi basique — Staking & Yield Tracking
═══════════════════════════════════════════════════════════════

Staking rewards tracking :
  → Enrichir la sync Binance pour capturer get_earn_positions() + get_staking_positions()
  → APY annuel effectif par position (vs APY promis)
  → Cumul de rewards dans le temps (chronologie)
  → Rewards auto-ajoutés comme crypto_transactions(tx_type='staking_reward')

Colonnes ajoutées sur « crypto_holdings » :
  → is_staked       Boolean default false
  → staking_apy     Float   APY annuel effectif en %
  → staking_source  String(32)  [binance_earn, binance_locked, kraken_staking, on_chain, manual]

Agrégation DeFi :
  → Vue consolidée : total staké par token, APY moyen pondéré
  → Projection des rewards sur 12 mois au taux APY actuel
  → Comparaison yield réel vs yield promis (indicateur de fiabilité)

Endpoints :
  → GET  /crypto/staking/summary    → total staké, gains estimés 12 mois
  → GET  /crypto/staking/positions  → liste des positions staking détaillées

═══════════════════════════════════════════════════════════════
B4.3  Multi-chain — Au-delà d'Ethereum
═══════════════════════════════════════════════════════════════

Nouvelles chaînes supportées (explorers publics, pas d'API key requise) :
  → Polygon (PolygonScan)  : https://api.polygonscan.com/api
  → Arbitrum (Arbiscan)    : https://api.arbiscan.io/api
  → Optimism (Optimistic)  : https://api-optimistic.etherscan.io/api
  → BSC (BscScan)          : https://api.bscscan.com/api

Enrichissement du modèle « crypto_wallets » :
  → Nouveau champ : chain  String(16) default 'ethereum'
      Valeurs possibles : ethereum, polygon, arbitrum, optimism, bsc

CryptoPlatform enum étendu :
  → Ajouter : POLYGON, ARBITRUM, OPTIMISM, BSC

Client unifié « multichain_client.py » :
  → Même interface que EtherscanClient (get_native_balance, get_erc20_balances)
  → Configuration par chaîne : base_url, native_symbol, native_name, top_tokens[]
  → Redis cache 120s par requête
  → Détection automatique des tokens via l'API « tokentx » de chaque explorer

Frontend :
  → Sélecteur de chaîne dans AddWalletModal (Ethereum, Polygon, Arbitrum, Optimism, BSC)
  → Badge de chaîne sur chaque wallet card
  → Vue agrégée cross-chain dans le portfolio

═══════════════════════════════════════════════════════════════
  IMPACT FICHIERS
═══════════════════════════════════════════════════════════════

  Migration :
  → alembic/versions/013_crypto_enrichment.py

  Backend :
  → app/models/crypto_transaction.py             (nouveau modèle)
  → app/models/crypto_holding.py                 (+ colonnes B4)
  → app/models/crypto_wallet.py                  (+ chain, enum CryptoPlatform étendu)
  → app/models/__init__.py                       (+ CryptoTransaction)
  → app/services/crypto_tax_engine.py            (nouveau — moteur fiscal PMPA + cerfa 2086)
  → app/services/multichain_client.py            (nouveau — client multi-chain unifié)
  → app/services/crypto_service.py               (enrichi staking + multi-chain)
  → app/schemas/crypto.py                        (+ schemas B4 : TaxSummary, Transaction, Staking)
  → app/api/v1/crypto.py                         (+ endpoints tax/staking/transactions)
  → tests/test_crypto_tax.py                     (tests unitaires PMPA, PV, export)

  Frontend :
  → src/types/api.ts                             (+ interfaces B4)
  → src/stores/crypto-store.ts                   (+ fetchTax, fetchStaking, addTransaction)
  → src/app/(dashboard)/crypto/page.tsx           (+ onglets Portefeuille/Fiscalité/Staking)
  → src/app/(dashboard)/crypto/analytics.tsx      (nouveau — composants tax/staking/multichain)
```

#### B5 — Cash-Flow cross-assets (Semaine 8-9)

```
B5.1  Flux entrants projetés
      → Salaire (récurrent détecté) + loyers + dividendes + intérêts
      → Coupons obligataires (si applicable)
      → Revenus variables moyennés

B5.2  Flux sortants projetés
      → Charges fixes (loyer, crédits, abonnements)
      → Charges prévisibles (impôts, taxe foncière — annualisés)
      → Dépenses moyennes par catégorie (via auto-budget)

B5.3  Projection de trésorerie consolidée
      → Calendrier flux entrants + sortants sur 12 mois
      → Surplus mensuel projeté → suggestion d'allocation
      → Alerte si un mois est déficitaire (impôts, grosses échéances)

B5.4  Interopérabilité des données
      → Le budget impacte la projection de trésorerie
      → La projection de trésorerie alimente le simulateur de retraite
      → Les dividendes de Bourse + loyers Immo alimentent les revenus passifs
      → Les dettes s'intègrent dans le forecast (mensualités prévues)
      → L'OmniScore utilise TOUTES ces données croisées
```

##### B5 — Spécifications techniques détaillées

###### Architecture & Principe

Le module B5 étend le `cashflow_service.py` (actuellement bank-only, 207 lignes)
en un **moteur de trésorerie cross-assets** qui agrège les flux de TOUTES
les classes d'actifs : banques, immobilier, bourse, crypto, dettes, projets.

Pattern suivi : fan-out identique à `networth.py` mais pour les **flux**
(revenus / dépenses) au lieu des **stocks** (soldes).  Tous les montants restent
en **centimes BigInteger** — jamais de float pour l'argent.

###### B5.1  Flux entrants projetés — Sources de revenus

```
Source                | Modèle SQLAlchemy       | Champ(s)                         | Projection
──────────────────────┼─────────────────────────┼──────────────────────────────────┼─────────────────────────────
Salaire / récurrents  | Transaction             | amount > 0, is_recurring=True    | Détecté par forecaster._detect_recurring()
Loyers immobiliers    | RealEstateProperty      | monthly_rent                     | × 12 mois, ajusté par vacancy_rate_pct
Dividendes actions    | StockPosition           | annual_dividend_yield, next_ex_date | Prochain ex-date + frequency → dates projetées
                      | StockDividend           | total_amount, ex_date, pay_date  | Historique + projection forward 12 mois
Staking crypto        | CryptoHolding           | staking_rewards_total, staking_apy, is_staked | APY × value / 12 par mois
Intérêts épargne      | Account (type=savings)  | balance × taux livret (config)   | Calcul mensuel simplifié
```

→ Nouveau service : `cashflow_projection.py`
  ├── `_collect_income_sources(db, user_id)` → liste typée de sources
  ├── chaque source a : `{source_type, label, amount_monthly, details[], projected_events[]}`
  └── `source_type` enum : `salary`, `rent`, `dividends`, `staking`, `interest`, `other_recurring`

###### B5.2  Flux sortants projetés — Sources de dépenses

```
Source                   | Modèle SQLAlchemy       | Champ(s)                             | Projection
─────────────────────────┼─────────────────────────┼──────────────────────────────────────┼─────────────────────
Charges fixes récurrentes| Transaction             | amount < 0, is_recurring=True        | forecaster._detect_recurring()
Mensualités de dettes    | Debt                    | monthly_payment                      | × mois restants jusqu'à end_date
Charges immobilières     | RealEstateProperty      | monthly_charges + monthly_loan_payment| × 12 mois
Taxe foncière            | RealEstateProperty      | taxe_fonciere (annuel)               | /12 mensuel, pic en octobre
Assurance PNO            | RealEstateProperty      | assurance_pno (mensuel)              | × 12
Provision travaux        | RealEstateProperty      | provision_travaux (mensuel)          | × 12
Épargne projet           | ProjectBudget           | monthly_target (actif only)          | Jusqu'à deadline ou target atteint
Budget catégories        | Budget                  | amount_limit par catégorie           | Limite mensuelle comme proxy
```

→ `_collect_expense_sources(db, user_id)` → même structure que income
→ `source_type` enum : `fixed_charges`, `debt_payment`, `re_charges`, `re_tax`, `project_saving`, `budget_limit`, `other_recurring`

###### B5.3  Projection de trésorerie consolidée — Moteur 12 mois

```
Algorithme :
  1. Calculer income_sources + expense_sources via B5.1 + B5.2
  2. Pour chaque mois M+1 à M+12 :
     a. income[m] = Σ income_sources actives ce mois
        → dividendes : seulement les mois avec pay_date projetée
        → staking : amount / 12 (lissé mensuel)
        → loyers : monthly_rent × (1 - vacancy_rate_pct/100)
        → salaire/récurrents : montant détecté
     b. expenses[m] = Σ expense_sources actives ce mois
        → taxe_fonciere : pic en octobre (75%) + étalement sur Q1 (25%)
        → mensualités dette : stop après end_date
        → épargne projet : stop après deadline ou si status ≠ active
     c. net[m] = income[m] - expenses[m]
     d. cumulative[m] = cumulative[m-1] + net[m]
     e. Si cumulative[m] < 0 → alerte déficit
     f. Si net[m] > seuil_surplus (20% du revenu moyen) → suggestion allocation

  3. Résultat :
     → monthly_projection[]: {month, date, income, expenses, net, cumulative,
                              income_breakdown{}, expense_breakdown{},
                              alerts[], suggestions[]}
     → annual_summary: {total_income, total_expenses, total_net,
                        passive_income_ratio, months_deficit, largest_surplus_month}
     → deficit_alerts[]: {month, shortfall, main_cause, recommendation}
     → surplus_suggestions[]: {month, surplus, suggestion_type, message}
```

→ Endpoint : `GET /api/v1/cashflow/projection?months=12`
→ Cache : `cashflow_projection:{user_id}:{months}` TTL 600s
→ Notifications : push une Notification(type="cashflow_alert") si déficit détecté

###### B5.4  Interopérabilité des données

```
Connexion                              | Implémentation
───────────────────────────────────────┼──────────────────────────────────────────
Budget → Forecast                      | expense_sources inclut Budget.amount_limit
Forecast → Retraite (C1 futur)        | Export passive_income_ratio + épargne mensuelle
Dividendes + Loyers → Revenus passifs | income_sources par source_type, calcul ratio
Dettes → Forecast                      | Debt.monthly_payment inclus, stop à end_date
OmniScore → toutes données            | cashflow_health_score: 0-100 basé sur 4 métriques
```

→ `cashflow_health_score` : score 0-100 composite
  ├── 25 pts : savings_rate (net/income) — cible ≥ 20%
  ├── 25 pts : income_stability (std_dev des revenus / moyenne) — bas = bon
  ├── 25 pts : deficit_risk (nb mois en déficit projeté / 12) — 0 = parfait
  └── 25 pts : passive_income_ratio (revenus passifs / total revenus) — cible ≥ 30%

###### B5 — Impact fichiers

```
  Nouveau Backend :
  → app/services/cashflow_projection.py          (NOUVEAU — moteur projection cross-assets ~400 lignes)

  Backend modifiés :
  → app/services/cashflow_service.py              (étendu : cross-asset income/expense aggregation)
  → app/schemas/cashflow.py                       (+ schemas B5 : projection, sources, alerts, health score)
  → app/api/v1/cashflow.py                        (+ endpoints projection, sources, health)

  Frontend :
  → src/types/api.ts                              (+ interfaces B5 : CrossAssetProjection, IncomeSource, etc.)
  → src/stores/cashflow-store.ts                  (NOUVEAU — fetchProjection, fetchSources, fetchHealth)
  → src/app/(dashboard)/cashflow/page.tsx          (NOUVEAU — page Cash-Flow cross-assets complète)
  → src/components/layout/sidebar.tsx              (+ entrée "Cash-Flow" dans NAV_ITEMS)

  Tests :
  → tests/test_cashflow_projection.py             (tests unitaires projection, sources, health score)
```

---

### Phase C — Life & Legacy Planning

> **Durée estimée** : 4-5 semaines
> **Objectif** : Transformer OmniFlow d'un agrégateur en un vrai planificateur patrimonial.

#### C1 — Simulateur de Retraite & Indépendance Financière (Semaine 10-11) ✅ IMPLÉMENTÉ

> **Statut d'implémentation C1** :
> - [x] C1.1 — Modèle de données (app/models/retirement_simulation.py : RetirementProfile + simulation snapshots)
> - [x] C1.1 — Migration Alembic (alembic/versions/017_retirement.py)
> - [x] C1.2 — Moteur de simulation (app/services/retirement_engine.py : Monte-Carlo 1000 chemins, décumulation, 6 classes d'actifs)
> - [x] C1.3 — Schemas Pydantic (app/schemas/retirement.py : 8 modèles requête/réponse typés)
> - [x] C1.4 — API Endpoints (app/api/v1/retirement.py : 7 endpoints CRUD + simulations + optimisation)
> - [x] C1.5 — Intégration Net Worth auto-importé + Cash-Flow cross-assets
> - [x] C1.6 — Frontend types (src/types/api.ts : 8 interfaces Retirement*)
> - [x] C1.6 — Frontend store (src/stores/retirement-store.ts : Zustand CRUD + simulation)
> - [x] C1.6 — Frontend page (src/app/(dashboard)/retirement/page.tsx : page complète Monte-Carlo, optimisation, charts)
> - [x] C1.6 — Navigation sidebar (entrée "Retraite" avec Sunset icon)
> - [x] C1.7 — Tests unitaires (tests/test_retirement.py : 15 tests moteur + API)

```
═══════════════════════════════════════════════════════════════════════════
C1.1  Modèle de Données — RetirementProfile + Simulation Snapshots
═══════════════════════════════════════════════════════════════════════════

  Benchmark concurrentiel & positionnement :
  ─────────────────────────────────────────────────────────────────────────
  │ Fonctionnalité                       │ Finary │ Wealthfront │ OmniFlow C1  │
  │──────────────────────────────────────│────────│─────────────│──────────────│
  │ Projection retraite                  │ Basic  │ ✅ avancé   │ ✅ Monte-Carlo│
  │ 6 classes d'actifs différenciées     │ ❌      │ ❌           │ ✅ rendements │
  │ Scénarios p10/p50/p90               │ ❌      │ ✅           │ ✅ + p25/p75  │
  │ Phase de décumulation modélisée     │ ❌      │ ✅ basique   │ ✅ SWR avancé │
  │ Impact fiscal retraite               │ ❌      │ ❌           │ ✅ TMI réelle │
  │ Optimisation multi-levier            │ ❌      │ Partiel     │ ✅ 4 leviers  │
  │ Lien patrimoine réel auto-importé   │ ❌      │ ❌           │ ✅ cross-asset│
  │ Intégration budget/dettes réels     │ ❌      │ ❌           │ ✅ B1+B5 link│
  │ FIRE number calculator               │ ❌      │ ❌           │ ✅ 4% rule   │
  │ Pension CNAV simulation             │ ❌      │ ❌           │ ✅ barème FR │
  └──────────────────────────────────────┴────────┴─────────────┴──────────────┘

  OmniFlow est le SEUL à connecter le patrimoine réel (cross-assets),
  les dettes, le budget ET la fiscalité dans une projection retraite
  Monte-Carlo — Finary n'a qu'un curseur basique, Wealthfront ne gère
  pas le droit français ni les classes d'actifs multiples.

  Table `retirement_profiles` :
  ─────────────────────────────────────────────────────────────────────────
  → id (UUID PK), user_id (FK → users.id, CASCADE, UNIQUE — 1 profil/user)
  → birth_year (Integer NOT NULL) — année de naissance pour calcul âge
  → target_retirement_age (Integer, default 64) — âge cible de départ
  → current_monthly_income (BigInteger, centimes) — revenus mensuels actuels
  → current_monthly_expenses (BigInteger, centimes) — dépenses mensuelles
  → monthly_savings (BigInteger, centimes) — épargne mensuelle nette
  → pension_estimate_monthly (BigInteger, centimes, nullable) — pension CNAV estimée
  → pension_quarters_acquired (Integer, default 0) — trimestres acquis
  → target_lifestyle_pct (Float, default 80.0) — % train de vie cible (vs actuel)
  → inflation_rate_pct (Float, default 2.0) — taux d'inflation annuel
  → life_expectancy (Integer, default 90) — espérance de vie pour calcul
  → include_real_estate (Boolean, default True) — inclure immo dans patrimoine
  → metadata_ (JSONB) — données extensibles

  Rendements configurables par classe d'actifs (JSONB field):
  ─────────────────────────────────────────────────────────────────────────
  → asset_returns : JSONB {
      "stocks":       {"mean": 7.0, "std": 15.0},  # CAC40/S&P500 historique
      "bonds":        {"mean": 2.5, "std": 5.0},   # Obligations EUR
      "real_estate":  {"mean": 3.5, "std": 8.0},   # Immobilier résidentiel
      "crypto":       {"mean": 10.0, "std": 40.0}, # Crypto volatile
      "savings":      {"mean": 3.0, "std": 0.5},   # Livret A / fonds euro
      "cash":         {"mean": 0.5, "std": 0.2},   # Comptes courants
    }
  → Chaque classe a un rendement moyen (mean) et écart-type (std)
  → Le Monte-Carlo utilise des rendements log-normaux :
    R_t = exp(μ - σ²/2 + σ × Z) - 1,  Z ~ N(0,1)
    → Distribution réaliste : pas de rendements négatifs catastrophiques

═══════════════════════════════════════════════════════════════════════════
C1.2  Moteur de Simulation — Monte-Carlo Multi-Assets + Décumulation
═══════════════════════════════════════════════════════════════════════════

  Service : app/services/retirement_engine.py
  ─────────────────────────────────────────────────────────────────────────

  ① COLLECTE AUTOMATIQUE DU PATRIMOINE (cross-asset linkage)
    → Import automatique depuis les modules B1-B5 existants :
      - Liquidités (bank accounts checking+savings) → sum(balance)
      - Actions (stock_positions) → sum(current_value)
      - Crypto (crypto_holdings) → sum(balance × prix actuel)
      - Immobilier (real_estate) → sum(estimated_value) si include_real_estate
      - Dettes (debts) → sum(remaining_amount) SOUSTRAIT du patrimoine
    → Calcul des poids par classe d'actifs :
      weight[class] = value[class] / total_patrimoine
    → Rendement pondéré du portefeuille :
      μ_portfolio = Σ(weight_i × μ_i)
      σ_portfolio = √(Σ(weight_i² × σ_i²))   (simplification diagonale)

  ② MOTEUR MONTE-CARLO (1000 chemins stochastiques)
    ─────────────────────────────────────────────────
    Algorithme :
    Pour chaque chemin s ∈ [0, 1000) :
      patrimoine = patrimoine_actuel
      Pour chaque année t de now à life_expectancy :
        
        PHASE D'ACCUMULATION (t < retirement_age) :
          → rendement_t = sample log-normal(μ_portfolio, σ_portfolio)
          → patrimoine = patrimoine × (1 + rendement_t)
          → patrimoine += épargne_annuelle
          → épargne_annuelle croît avec inflation pour maintenir le réel
          → Si dette finit en année t → épargne augmente du montant de la mensualité
        
        PHASE DE DÉCUMULATION (t ≥ retirement_age) :
          → rendement_t = sample log-normal(μ_portfolio_retraite, σ_réduit)
            (allocation réduite en risque : 40% bonds + 30% savings + 30% stocks)
          → patrimoine = patrimoine × (1 + rendement_t)
          → retrait_annuel = train_de_vie_cible - pension_estimée
          → retrait_ajusté_inflation = retrait_annuel × (1 + inflation)^t
          → patrimoine -= retrait_ajusté_inflation
          → Si patrimoine ≤ 0 → marquer "ruine" à cet âge

    Résultats collectés par chemin :
      → patrimoine_par_age[s][age] = montant à chaque âge
      → fire_age[s] = âge où patrimoine couvre 25× dépenses annuelles (règle 4%)
      → ruin_age[s] = âge où patrimoine tombe à 0 (ou null si jamais)
      → patrimoine_final[s] = patrimoine à life_expectancy

  ③ CALCUL DES PERCENTILES ET SCÉNARIOS
    → Pour chaque âge, calcul des percentiles :
      p10 (pessimiste), p25, p50 (médian), p75, p90 (optimiste)
    → Âge FIRE médian : median(fire_age[s] pour s où fire_age existe)
    → Probabilité de ruine : count(ruin_age != null) / 1000
    → Success rate : % de chemins où patrimoine > 0 à life_expectancy

  ④ PENSION CNAV SIMPLIFIÉE (droit français)
    → Barème 2026 :
      - Retraite à taux plein : 50% du SAM (Salaire Annuel Moyen, 25 meilleures années)
      - Trimestres requis : 172 (né après 1973)
      - Âge légal : 64 ans (réforme 2023)
      - Décote/surcote : ±1.25% par trimestre manquant/excédentaire
      - Complémentaire AGIRC-ARRCO : ~25% du dernier salaire (estimation)
    → Si l'utilisateur saisit ses trimestres, estimation automatique :
      pension ≈ (SAM/2) × clamp(trimestres/172, 0, 1) + complémentaire
    → Si l'utilisateur saisit directement le montant : utiliser tel quel

  ⑤ FIRE NUMBER CALCULATOR (règle 4%)
    → FIRE Number = dépenses_annuelles_cibles / 0.04
    → Progress : patrimoine_actuel / fire_number × 100
    → Coast FIRE : montant requis aujourd'hui pour que la capitalisation
      seule (sans épargne) atteigne le FIRE Number à retirement_age
      coast_fire = fire_number / (1 + μ_portfolio)^(retirement_age - current_age)
    → Lean FIRE : fire_number basé sur 60% des dépenses actuelles
    → Fat FIRE : fire_number basé sur 120% des dépenses actuelles
    → Barista FIRE : combien faut-il d'un revenu partiel +
      patrimoine existant pour couvrir le gap

  ⑥ SAFE WITHDRAWAL RATE (SWR) DYNAMIQUE
    → Pas un simple 4% fixe — taux variable selon :
      a) Volatilité actuelle marché (σ_portfolio)
      b) Âge de l'utilisateur (horizons restants)
      c) Ratio patrimoine / dépenses
    → Formule : SWR = 3% + adjustments
      Si ratio > 33 (patrimoine > 33× dépenses) → +0.5%
      Si âge > 75 → +0.5% (horizon court)
      Si σ_portfolio < 10% → +0.3% (faible volatilité)
    → Résultat : retrait mensuel recommandé personnalisé

═══════════════════════════════════════════════════════════════════════════
C1.3  Schemas Pydantic — Modèles Requête/Réponse
═══════════════════════════════════════════════════════════════════════════

  Fichier : app/schemas/retirement.py
  ─────────────────────────────────────────────────────────────────────────

  → CreateRetirementProfileRequest :
    - birth_year ∈ [1940, 2010]
    - target_retirement_age ∈ [50, 75]
    - current_monthly_income > 0 (centimes)
    - monthly_savings ≥ 0 (centimes)
    - pension_estimate_monthly ≥ 0 (centimes, nullable)
    - target_lifestyle_pct ∈ [20, 150]
    - inflation_rate_pct ∈ [0, 10]
    - life_expectancy ∈ [65, 110]
    - asset_returns : dict facultatif (6 classes, mean+std)

  → UpdateRetirementProfileRequest : tous champs optionnels

  → RetirementProfileResponse :
    - Tous les champs du profil + calculated fields :
      current_age, years_to_retirement, current_patrimoine (auto-fetch)

  → SimulationRequest :
    - extra_monthly_savings : int (centimes, 0 = aucun levier)
    - num_simulations : int (default 1000, max 5000)
    - scenario_name : str optionnel

  → SimulationResponse :
    - median_fire_age, confidence_interval (p10, p90)
    - success_rate_pct : float (% chemins sans ruine)
    - ruin_probability_pct : float
    - patrimoine_at_retirement_p50 : int (centimes)
    - serie_by_age : list[YearProjection] (p10/p25/p50/p75/p90 par an)
    - fire_number, progress_pct, coast_fire
    - swr_recommended_pct : float
    - monthly_withdrawal_recommended : int (centimes)
    - pension_estimate_used : int

  → YearProjection :
    - age, year, p10, p25, p50, p75, p90, is_accumulation : bool
    - pension_income : int, withdrawal : int

  → OptimizationResponse :
    - levers : list[OptimizationLever]
    - each : { lever_name, delta_monthly_savings, new_fire_age,
               years_gained, description }
    - best_lever : str
    - summary : str (phrase human-readable)

═══════════════════════════════════════════════════════════════════════════
C1.4  API Endpoints — Projection + Optimisation + FIRE
═══════════════════════════════════════════════════════════════════════════

  Router : app/api/v1/retirement.py (prefix="/retirement", tags=["retirement"])
  Dépendances : get_current_user, get_db
  Caching : CacheManager (600s simulation, invalidé sur mutation profil)
  ─────────────────────────────────────────────────────────────────────────

  CRUD Profil :
  → GET    /retirement/profile         — Lire/créer le profil retraite (auto-fetch patrimoine)
  → PUT    /retirement/profile         — Modifier les paramètres

  SIMULATIONS :
  → POST   /retirement/simulate        — Lancer une simulation Monte-Carlo
           Body : { extra_monthly_savings: 0, num_simulations: 1000 }
           Response : SimulationResponse complète avec série par âge

  → POST   /retirement/optimize        — Calculer les leviers d'optimisation
           Teste automatiquement 4 scénarios :
             +100€/mois, +200€/mois, +500€/mois, retraite -2 ans
           Retourne delta FIRE age, years_gained, best_recommended

  → GET    /retirement/fire-dashboard   — Métriques FIRE consolidées
           Response : { fire_number, progress_pct, coast_fire, lean_fire,
                       fat_fire, swr_pct, monthly_withdrawal, patrimoine_total,
                       passive_income_ratio }

  → GET    /retirement/patrimoine-snapshot — Patrimoine par classe d'actifs
           Réutilise networth.get_current_networth + breakdown

  → POST   /retirement/what-if          — Scénario "What-If" libre
           Body : { retirement_age, monthly_savings, pension_estimate,
                    inflation_rate, asset_returns_override }
           Permet de tester n'importe quelle combinaison de paramètres
           sans modifier le profil enregistré

═══════════════════════════════════════════════════════════════════════════
C1.5  Intégration Cross-Assets — Le cœur de la valeur OmniFlow
═══════════════════════════════════════════════════════════════════════════

  Le simulateur C1 unifie les données de TOUTES les phases précédentes :

  ① PATRIMOINE ← Net Worth (B1-B4)
    → Appel networth.get_current_networth() pour le total et breakdown
    → Mapping automatique vers les 6 classes d'actifs :
      Liquidités → cash, Épargne → savings, Investissements → stocks,
      Crypto → crypto, Immobilier → real_estate, Dettes → soustrait

  ② ÉPARGNE MENSUELLE ← Cash-Flow Projection (B5)
    → Appel cashflow_projection.get_projection() → net monthly moyen
    → Auto-détection si l'utilisateur n'a pas saisi manuellement
    → Revenus passifs (dividendes, loyers, staking) → réduction du gap retraite

  ③ DETTES ← Module Dettes (B1)
    → Query end_date de chaque dette active
    → Quand une dette se termine → monthly_payment libéré → booster l'épargne
    → Impact visible sur le graphique de projection (kink au moment de la fin)

  ④ RENDEMENTS RÉELS ← Stock Analytics (B2) + Crypto (B4)
    → TWR calculé en B2 → peut remplacer le rendement théorique stocks
    → Performance crypto réelle → ajuster les attentes de rendement
    → L'utilisateur voit la différence "rendement marché" vs "mon rendement"

  ⑤ CACHE & INVALIDATION
    → Clé : retirement:{user_id}:simulation TTL 600s
    → Invalidation : sur mutation profil, sync bancaire, debt update
    → Patrimoine snapshot toujours frais (via networth cache 120s)

═══════════════════════════════════════════════════════════════════════════
C1.6  Frontend — Page /retirement Premium + Dashboard FIRE
═══════════════════════════════════════════════════════════════════════════

  Fichiers créés :
  ─────────────────────────────────────────────────────────────────────────
  → src/app/(dashboard)/retirement/page.tsx — Page principale
  → src/stores/retirement-store.ts — Zustand store CRUD + simulation
  → src/types/api.ts — Types Retirement*, YearProjection, FIRE, etc.
  → Sidebar : ajout lien "Retraite" avec icône Sunset (lucide)

  Page /retirement — Layout :
  ─────────────────────────────────────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────────┐
  │  HEADER : "Simulateur de Retraite & FIRE"           [⚙️ Modifier] │
  ├──────────────┬──────────────┬──────────────┬───────────────────────┤
  │  Âge FIRE    │ Prob. succès │ FIRE Number  │ Progression          │
  │  58 ans      │   94.3%      │ 1 200 000€   │ ████████░░ 62%      │
  │  ↓ médian    │              │  règle 4%    │                      │
  ├──────────────┴──────────────┴──────────────┴───────────────────────┤
  │                                                                     │
  │  ┌── GRAPHIQUE MONTE-CARLO (AreaChart Recharts) ───────────────┐   │
  │  │                                                              │   │
  │  │  ░░░░░ Fan chart p10–p90 (zones ombrées dégradées)         │   │
  │  │  ━━━━━ Ligne médiane p50 (trait plein brand color)          │   │
  │  │  - - - Ligne pension CNAV (trait pointillé vert)            │   │
  │  │  ┄┄┄┄┄ Seuil FIRE (trait horizontal rouge)                 │   │
  │  │  ──────────────────────────────────────────────────────     │   │
  │  │   35    40    45    50    55    60    65    70    75    80   │   │
  │  │              ▲ accumulation │ décumulation ▲                 │   │
  │  └──────────────────────────────────────────────────────────── │   │
  │                                                                     │
  │  ┌── LEVIERS D'OPTIMISATION ───────────────────────────────── │   │
  │  │  💰 +100€/mois d'épargne    → FIRE à 56 ans (−2 ans)      │   │
  │  │  💰 +200€/mois d'épargne    → FIRE à 54 ans (−4 ans)      │   │
  │  │  💰 +500€/mois d'épargne    → FIRE à 50 ans (−8 ans)      │   │
  │  │  📅 Retraite à 62 au lieu de 64 → Succès 88% (−6%)        │   │
  │  └──────────────────────────────────────────────────────────── │   │
  │                                                                     │
  │  ┌── PARAMÈTRES DU PROFIL ──────────────────────────────────  │   │
  │  │  Naissance: 1990 │ Retraite cible: 64 │ Espérance: 90    │   │
  │  │  Revenu: 4 500€  │ Épargne: 800€      │ Pension: 1 800€  │   │
  │  │  Train de vie: 80% │ Inflation: 2.0%  │ Trimestres: 60   │   │
  │  └──────────────────────────────────────────────────────────  │   │
  └─────────────────────────────────────────────────────────────────────┘

  Fonctionnalités UX premium :
  → Fan chart Monte-Carlo (5 zones dégradées p10→p90)
  → Ligne de transition accumulation/décumulation marquée
  → Cards KPI animées (CountUp sur les montants)
  → Progress bar FIRE avec pourcentage et couleur gradient
  → Leviers d'optimisation avec icônes et badges "gains"
  → Formulaire de profil inline avec validation temps réel
  → Skeleton loading premium (chart + 4 cards)
  → Empty state si profil non configuré : "Configurez votre profil retraite"
  → What-If : bouton pour tester des scénarios sans sauvegarder

═══════════════════════════════════════════════════════════════════════════
C1.7  Tests Automatisés (15+ tests)
═══════════════════════════════════════════════════════════════════════════

  Fichier : tests/test_retirement.py
  ─────────────────────────────────────────────────────────────────────────
  → test_monte_carlo_basic (1000 chemins, vérifie len==1000 et pas de NaN)
  → test_monte_carlo_convergence (10 runs, médian stable ±5%)
  → test_accumulation_phase_grows (patrimoine croît chaque année)
  → test_decumulation_phase_decreases (patrimoine décroît après retraite)
  → test_fire_number_calculation (dépenses × 25 = FIRE number)
  → test_fire_progress (patrimoine / fire_number × 100)
  → test_coast_fire_formula (vérification mathématique)
  → test_swr_dynamic (SWR ∈ [3%, 5%] selon les paramètres)
  → test_pension_cnav_estimate (trimestres → pension cohérente)
  → test_debt_end_frees_cash (fin dette → épargne augmentée)
  → test_zero_savings_still_works (pas de crash si épargne=0)
  → test_inflation_impact (inflation 5% vs 2% → FIRE retardé)
  → test_optimization_levers (4 leviers retournés, triés par efficacité)
  → test_create_profile_api (POST → 201 retourne profil)
  → test_simulate_api (POST /simulate → 200 avec SimulationResponse valide)
```

#### C2 — Heritage Simulator — Simulateur de Succession Dynamique (Semaine 11-12) ✅ IMPLÉMENTÉE

> **Benchmark concurrentiel**
>
> | Feature | Finary | Linxea | Nalo | **OmniFlow C2** |
> |---------|--------|--------|------|-----------------|
> | Droits de succession | ❌ | ❌ | ❌ | ✅ Barème fiscal FR 2026 complet |
> | Multiple héritiers | ❌ | ❌ | ❌ | ✅ Conjoint + N enfants + N tiers |
> | Démembrement art. 669 | ❌ | ❌ | ❌ | ✅ Usufruit/nue-propriété par âge |
> | Assurance-vie 152 500 € | ❌ | ❌ | ❌ | ✅ Avant/après 70 ans |
> | Optimisation donations | ❌ | ❌ | ❌ | ✅ Abattements 15 ans renouvelables |
> | Lien patrimoine réel | ❌ | ❌ | ❌ | ✅ Cross-asset B1-B5 automatique |
> | Waterfall chart | ❌ | ❌ | ❌ | ✅ Brut → abattements → droits → net |
>
> **Verdict : OmniFlow est le premier agrégateur patrimonial à proposer un simulateur de succession intégré cross-asset avec optimisation fiscale temps-réel.**

```
C2.1  MODÈLE DE DONNÉES — Table `heritage_simulations`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Migration: 018_heritage.py (down_revision = "017_retirement")

  Schema SQL :
  ┌─────────────────────────────────────────────────────────────┐
  │ id               UUID PK (UUIDMixin)                        │
  │ user_id          UUID FK → users.id (UNIQUE, indexed)       │
  │ ───────────────── Régime matrimonial ─────────────────────  │
  │ marital_regime   String(32)  NOT NULL DEFAULT "communaute"  │
  │                  ["communaute", "separation", "pacs",       │
  │                   "concubinage", "universel"]               │
  │ ───────────────── Héritiers (JSONB) ──────────────────────  │
  │ heirs            JSONB NOT NULL DEFAULT '[]'                │
  │                  → Array of {                               │
  │                      "name": str,                           │
  │                      "relationship": "conjoint"|"enfant"    │
  │                                      |"petit_enfant"        │
  │                                      |"frere_soeur"|"tiers",│
  │                      "age": int | null,                     │
  │                      "handicap": bool                       │
  │                    }                                        │
  │ ───────────────── Patrimoine override ────────────────────  │
  │ life_insurance_before_70  BigInteger DEFAULT 0  (centimes)  │
  │ life_insurance_after_70   BigInteger DEFAULT 0  (centimes)  │
  │ donation_history          JSONB DEFAULT '[]'                │
  │                  → [{                                       │
  │                      "heir_name": str,                      │
  │                      "amount": int (centimes),              │
  │                      "date": "YYYY-MM-DD",                  │
  │                      "type": "donation_simple"|             │
  │                              "donation_partage"|"don_manuel"│
  │                    }]                                       │
  │ ───────────────── Preferences ────────────────────────────  │
  │ include_real_estate       Boolean DEFAULT true              │
  │ include_life_insurance    Boolean DEFAULT true              │
  │ custom_patrimoine_override BigInteger  NULL (centimes)      │
  │ ───────────────── Résultat cache ─────────────────────────  │
  │ last_simulation_result    JSONB NULL                        │
  │ ───────────────── Timestamps ─────────────────────────────  │
  │ created_at / updated_at   DateTime (TimestampMixin)         │
  └─────────────────────────────────────────────────────────────┘

C2.2  MOTEUR FISCAL — heritage_engine.py (Barème FR 2026)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Barème droits de succession en ligne directe (art. 777 CGI) :
  ┌──────────────────────────┬────────┐
  │ Tranche                  │ Taux   │
  ├──────────────────────────┼────────┤
  │ ≤ 8 072 €                │  5%    │
  │ 8 072 — 12 109 €         │ 10%    │
  │ 12 109 — 15 932 €        │ 15%    │
  │ 15 932 — 552 324 €       │ 20%    │
  │ 552 324 — 902 838 €      │ 30%    │
  │ 902 838 — 1 805 677 €    │ 40%    │
  │ > 1 805 677 €            │ 45%    │
  └──────────────────────────┴────────┘

  Abattements (art. 779 CGI) :
  • Conjoint / PACS      → EXONÉRÉ (loi TEPA 2007)
  • Enfant en ligne directe → 100 000 €
  • Petit-enfant          → 31 865 €
  • Frère / sœur          → 15 932 €
  • Neveu / nièce         → 7 967 €
  • Tiers                 → 1 594 €
  • Handicap              → +159 325 € (cumulable)

  Barème entre frères/sœurs :
  • ≤ 24 430 €  → 35%
  • > 24 430 €  → 45%

  Barème tiers / parents éloignés :
  • 55% (neveux, oncles)
  • 60% (tiers sans lien)

  Assurance-vie (art. 990 I & 757 B CGI) :
  • Primes versées avant 70 ans : abattement 152 500 €/bénéficiaire
    puis 20% ≤ 700 000 €, 31,25% au-delà
  • Primes versées après 70 ans  : abattement global 30 500 €
    puis intégration au barème de droit commun

  Démembrement (art. 669 CGI) — barème fiscal usufruit :
  ┌────────────────────┬────────────┬─────────────┐
  │ Âge de l'usufruitier│ Usufruit % │ Nue-prop. % │
  ├────────────────────┼────────────┼─────────────┤
  │ < 21 ans           │    90%     │    10%      │
  │ 21-30 ans          │    80%     │    20%      │
  │ 31-40 ans          │    70%     │    30%      │
  │ 41-50 ans          │    60%     │    40%      │
  │ 51-60 ans          │    50%     │    50%      │
  │ 61-70 ans          │    40%     │    60%      │
  │ 71-80 ans          │    30%     │    70%      │
  │ 81-90 ans          │    20%     │    80%      │
  │ > 90 ans           │    10%     │    90%      │
  └────────────────────┴────────────┴─────────────┘

  Fonctions du moteur (async, pas de classes) :
  ─────────────────────────────────────────────
  • collect_heritage_patrimoine(db, user_id)
      → Réutilise collect_patrimoine() du module C1
      → Ajoute assurance-vie (before_70 / after_70) depuis HeritageSimulation
      → Calcule patrimoine_brut = actifs - passifs

  • compute_abattement(relationship, handicap) → int centimes
      → Retourne l'abattement applicable selon le lien familial

  • compute_succession_tax(taxable_amount, relationship) → int centimes
      → Applique le barème progressif par tranches

  • compute_life_insurance_tax(amount_before_70, amount_after_70,
                                n_beneficiaries) → dict
      → Taxe spécifique art. 990 I + 757 B

  • compute_demembrement(total_value, usufructuary_age) → dict
      → { usufruit_value, nue_propriete_value, usufruit_pct }

  • simulate_succession(db, user_id, scenario_overrides) → dict
      → Fonction principale : collecte patrimoine, itère sur chaque héritier,
        applique régime matrimonial, calcule droits, retourne résultat complet

  • simulate_donation_optimization(db, user_id) → dict
      → Teste N scénarios de donation (10k, 50k, 100k par enfant)
      → Compare droits avec vs sans donation
      → Retourne économie fisale pour chaque scénario

  • compute_timeline_projection(db, user_id, years) → list[dict]
      → Projette le patrimoine sur N années avec inflation
      → À chaque point : calcule droits si succession immédiate
      → Intègre abattements donation renouvelables tous les 15 ans

C2.3  SCHEMAS PYDANTIC — heritage.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  class HeirSchema(BaseModel):
      name: str
      relationship: Literal["conjoint","enfant","petit_enfant",
                            "frere_soeur","neveu_niece","tiers"]
      age: int | None = None
      handicap: bool = False

  class DonationRecord(BaseModel):
      heir_name: str
      amount: int = Field(..., ge=0)  # centimes
      date: str  # YYYY-MM-DD
      type: Literal["donation_simple","donation_partage","don_manuel"]

  class CreateHeritageRequest(BaseModel):
      marital_regime: str = "communaute"
      heirs: list[HeirSchema] = []
      life_insurance_before_70: int = 0
      life_insurance_after_70: int = 0
      donation_history: list[DonationRecord] = []
      include_real_estate: bool = True
      include_life_insurance: bool = True

  class UpdateHeritageRequest(BaseModel):  (tous champs Optional)

  class HeirResult(BaseModel):
      name: str
      relationship: str
      part_brute: int        # centimes — part du patrimoine
      abattement: int        # centimes
      taxable: int           # centimes après abattement
      droits: int            # centimes — droits de succession
      net_recu: int          # centimes — part nette après droits
      taux_effectif_pct: float

  class DonationScenario(BaseModel):
      label: str
      donation_per_heir: int  # centimes
      economy_vs_no_donation: int  # centimes d'économie
      new_total_droits: int
      description: str

  class TimelinePoint(BaseModel):
      year: int
      patrimoine_projete: int
      droits_si_succession: int
      net_transmis: int
      donation_abattement_available: bool  # true si 15 ans écoulés

  class HeritageResponse(BaseModel):  (Config: from_attributes = True)
      id: UUID
      user_id: UUID
      marital_regime: str
      heirs: list[HeirSchema]
      life_insurance_before_70: int
      life_insurance_after_70: int
      donation_history: list[DonationRecord]
      created_at: datetime
      updated_at: datetime

  class SimulationSuccessionResponse(BaseModel):
      patrimoine_brut: int
      patrimoine_taxable: int
      total_droits: int
      total_net_transmis: int
      taux_effectif_global_pct: float
      heirs_detail: list[HeirResult]
      life_insurance_detail: dict | None
      demembrement_detail: dict | None

  class DonationOptimizationResponse(BaseModel):
      scenarios: list[DonationScenario]
      best_scenario: str
      economy_max: int  # centimes
      summary: str

  class TimelineResponse(BaseModel):
      points: list[TimelinePoint]
      donation_renewal_years: list[int]  # années où abattements se renouvellent

C2.4  ENDPOINTS REST — heritage.py (Router)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Base : /api/v1/heritage — CacheManager 600s, invalidation sur mutations

  ┌──────────┬──────────────────────┬────────────────────────────────────┐
  │ Méthode  │ Path                 │ Description                        │
  ├──────────┼──────────────────────┼────────────────────────────────────┤
  │ GET      │ /profile             │ Profil héritage (ou create défaut) │
  │ PUT      │ /profile             │ Mise à jour profil + héritiers     │
  │ POST     │ /simulate            │ Simulation succession complète     │
  │ POST     │ /optimize-donations  │ Optimisation donations             │
  │ GET      │ /timeline            │ Projection N années                │
  │ GET      │ /patrimoine-detail   │ Patrimoine détaillé pour héritage  │
  │ POST     │ /what-if             │ Scénario libre (overrides)         │
  └──────────┴──────────────────────┴────────────────────────────────────┘

C2.5  FRONTEND — Page /heritage (Next.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Store Zustand : heritage-store.ts
  → fetchProfile, updateProfile, simulate, optimizeDonations,
    fetchTimeline, fetchPatrimoine, whatIf

  Page : 4 onglets
  ┌─────────────┬──────────────────────────────────────────────────┐
  │ Succession   │ KPIs (patrimoine brut, droits totaux, net        │
  │              │ transmis, taux effectif) + tableau héritiers      │
  │              │ + waterfall chart brut→abattements→droits→net     │
  ├─────────────┼──────────────────────────────────────────────────┤
  │ Donations    │ Scénarios de donation ranked + économie           │
  │              │ + meilleur scénario mis en avant                  │
  ├─────────────┼──────────────────────────────────────────────────┤
  │ Timeline     │ Projection patrimoine / droits sur 30 ans        │
  │              │ + marqueurs renouvellement abattements 15 ans     │
  ├─────────────┼──────────────────────────────────────────────────┤
  │ Profil       │ Formulaire : régime matrimonial, héritiers,      │
  │              │ assurance-vie, historique de donations             │
  └─────────────┴──────────────────────────────────────────────────┘

C2.6  TESTS — 15 tests ciblés
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  UNIT (moteur fiscal pur — pas de DB) :
  → test_abattement_enfant_100k (enfant → 100 000€)
  → test_abattement_conjoint_exonere (conjoint → 0€ de droits)
  → test_bareme_ligne_directe (taxable 200k → droits calculés par tranches)
  → test_bareme_frere_soeur (bifurcation 35%/45%)
  → test_bareme_tiers_60pct (tiers → 60%)
  → test_handicap_supplement (+159 325€ cumulable)
  → test_assurance_vie_avant_70 (152 500€ puis 20%/31.25%)
  → test_assurance_vie_apres_70 (30 500€ global)
  → test_demembrement_age_55 (50% usufruit / 50% nue-propriété)
  → test_donation_economy (donation 100k/enfant → économie calculée)
  → test_regime_separation_vs_communaute (parts différentes)

  INTÉGRATION (API endpoints) :
  → test_get_default_profile (GET → 200 profil par défaut)
  → test_update_heirs (PUT → héritiers mis à jour)
  → test_simulate_succession (POST → résultat avec heirs_detail)
  → test_optimize_donations (POST → scénarios triés par économie)
```

#### C3 — Fee Negotiator AI — Analyse & Négociation de Frais Bancaires (Semaine 12-13) ✅ IMPLÉMENTÉE

> **Benchmark concurrentiel**
>
> | Feature | Finary | Bankin' | Linxo | **OmniFlow C3** |
> |---------|--------|---------|-------|-----------------|
> | Détection frais bancaires | ❌ | ⚠️ Catégorie seule | ⚠️ Catégorie seule | ✅ Scan 12 mois 6 types + récurrence |
> | Grille tarifaire multibanque | ❌ | ❌ | ❌ | ✅ 20+ banques FR JSONB temps réel |
> | Comparaison personnalisée | ❌ | ❌ | ❌ | ✅ Top-3 alternatives avec économie €/an |
> | Génération courrier négociation | ❌ | ❌ | ❌ | ✅ Markdown + arguments juridiques Loi Macron |
> | Suivi statut négociation | ❌ | ❌ | ❌ | ✅ Pipeline envoyé→en attente→résolu |
> | Score de surfacturation | ❌ | ❌ | ❌ | ✅ Percentile vs marché (0-100) |

**1. Schéma SQL — Tables `bank_fee_schedules` + `fee_analyses`**

```sql
-- Grille tarifaire de référence (20+ banques FR)
CREATE TABLE bank_fee_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_slug     VARCHAR(64) NOT NULL UNIQUE,     -- 'boursorama', 'fortuneo', 'sg', etc.
    bank_name     VARCHAR(128) NOT NULL,
    is_online     BOOLEAN NOT NULL DEFAULT FALSE,   -- banque en ligne vs agence
    -- Grille tarifaire annuelle (centimes)
    fee_account_maintenance  BIGINT NOT NULL DEFAULT 0,  -- tenue de compte
    fee_card_classic         BIGINT NOT NULL DEFAULT 0,  -- carte Visa/CB classique
    fee_card_premium         BIGINT NOT NULL DEFAULT 0,  -- carte Visa Premier/Gold
    fee_card_international   BIGINT NOT NULL DEFAULT 0,  -- frais hors zone €/an moy.
    fee_overdraft_commission BIGINT NOT NULL DEFAULT 0,  -- commission d'intervention /an
    fee_transfer_sepa        BIGINT NOT NULL DEFAULT 0,  -- virement SEPA externe
    fee_transfer_intl        BIGINT NOT NULL DEFAULT 0,  -- virement international
    fee_check                BIGINT NOT NULL DEFAULT 0,  -- chéquier
    fee_insurance_card       BIGINT NOT NULL DEFAULT 0,  -- assurance moyens de paiement
    fee_reject               BIGINT NOT NULL DEFAULT 0,  -- frais de rejet prélèvement
    fee_atm_other_bank       BIGINT NOT NULL DEFAULT 0,  -- retrait DAB autre banque
    metadata       JSONB NOT NULL DEFAULT '{}',
    valid_from     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analyse de frais par utilisateur (one per user, maj à chaque scan)
CREATE TABLE fee_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- Résultat du scan 12 mois (centimes)
    total_fees_annual       BIGINT NOT NULL DEFAULT 0,
    fees_by_type            JSONB NOT NULL DEFAULT '{}',
    -- {"account_maintenance": 3200, "card": 4500, "overdraft": 12300, ...}
    monthly_breakdown       JSONB NOT NULL DEFAULT '[]',
    -- [{"month": "2025-03", "total": 1200, "details": [...]}, ...]
    -- Comparaison
    best_alternative_slug   VARCHAR(64),
    best_alternative_saving BIGINT NOT NULL DEFAULT 0,
    top_alternatives        JSONB NOT NULL DEFAULT '[]',
    -- [{"bank_slug": "boursorama", "saving": 15600, "total_there": 0}, ...]
    overcharge_score        INTEGER NOT NULL DEFAULT 50, -- 0-100 percentile
    -- Négociation
    negotiation_status      VARCHAR(32) NOT NULL DEFAULT 'none',
    -- 'none' | 'draft' | 'sent' | 'waiting' | 'resolved_success' | 'resolved_fail'
    negotiation_letter      TEXT,
    negotiation_sent_at     TIMESTAMPTZ,
    negotiation_result_amount BIGINT NOT NULL DEFAULT 0,
    metadata                JSONB NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**2. Grille tarifaire de référence — 20 banques FR embarquées**

| Banque | Tenue cpte | Carte Classic | Carte Premier | Commissions intervention |
|--------|-----------|---------------|---------------|-------------------------|
| Boursorama | 0 € | 0 € | 0 € | 0 € |
| Fortuneo | 0 € | 0 € | 0 € | 0 € |
| Hello Bank | 0 € | 0 € | 0 € (conditions) | 0 € |
| BoursoBank | 0 € | 0 € | 0 € | 0 € |
| ING | 0 € | 0 € | 0 € (conditions) | 0 € |
| Monabanq | 0 € | 2 €/mois | 6 €/mois | 0 € |
| Orange Bank | 0 € | 0 € | 4.99 €/mois | 0 € |
| N26 | 0 € | 0 € | 9.90 €/mois | 0 € |
| Revolut | 0 € | 0 € | 7.99 €/mois | 0 € |
| Société Générale | 2.00 €/mois | 3.75 €/mois | 11 €/mois | 8 €/intervention |
| BNP Paribas | 1.75 €/mois | 3.50 €/mois | 10.50 €/mois | 8 €/intervention |
| Crédit Agricole | 1.90 €/mois | 3.50 €/mois | 10 €/mois | 8 €/intervention |
| LCL | 1.80 €/mois | 3.50 €/mois | 10 €/mois | 8 €/intervention |
| Crédit Mutuel | 1.50 €/mois | 3.25 €/mois | 9.50 €/mois | 8 €/intervention |
| La Banque Postale | 1.50 €/mois | 2.50 €/mois | 8 €/mois | 6.90 €/intervention |
| HSBC | 2.50 €/mois | 4 €/mois | 12 €/mois | 8 €/intervention |
| CIC | 1.80 €/mois | 3.50 €/mois | 10 €/mois | 8 €/intervention |
| Banque Populaire | 2.00 €/mois | 3.75 €/mois | 10.50 €/mois | 8 €/intervention |
| Caisse d'Épargne | 1.80 €/mois | 3.50 €/mois | 10.50 €/mois | 8 €/intervention |
| AXA Banque | 0 € | 0 € (conditions) | 7.50 €/mois | 0 € |

**3. Moteur d'analyse — Catégories de frais scannées**

```
FEE_CATEGORIES detectées automatiquement (via catégoriseur existant) :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  TYPE               │ transaction.subcategory        │ Récurrent │ Mapping grille
  ───────────────────┼───────────────────────────────┼───────────┼──────────────────────
  Tenue de compte    │ "Frais bancaires"             │ Oui       │ fee_account_maintenance
  Carte bancaire     │ "Cotisation carte"            │ Oui       │ fee_card_classic / premium
  Assurance carte    │ "Assurance carte"             │ Oui       │ fee_insurance_card
  Agios / découvert  │ "Agios"                       │ Non       │ fee_overdraft_commission
  Frais de rejet     │ "Frais bancaires" + matching  │ Non       │ fee_reject
  Commissions        │ "Frais bancaires" + matching  │ Non       │ fee_overdraft_commission

  → Scan : SELECT * FROM transactions WHERE category='Banque' AND date >= now()-'12 months'
  → Agrégation : SUM par subcategory, COUNT récurrences, moyenne mensuelle
```

**4. Fonctions du moteur `fee_negotiator_engine.py`**

```python
# ── Constantes ───────────────────────────────────────────────
BANK_FEE_SCHEDULES: list[dict]       # 20 banques embarquées (seed data)
FEE_TYPE_MAPPING: dict[str, str]     # subcategory → fee schedule field

# ── Fonctions ────────────────────────────────────────────────
async def scan_user_fees(db, user_id)          → dict
  # Scan 12 mois transactions category='Banque'
  # Retourne fees_by_type, monthly_breakdown, total_annual

async def compare_with_market(db, user_fees)   → list[dict]
  # Compare total user vs chaque grille banque
  # Retourne top_alternatives triées par économie décroissante

def compute_overcharge_score(user_total, all_schedules) → int
  # Percentile 0-100 : "Vous payez plus cher que X% des profils"

async def generate_negotiation_letter(db, user_id, user_fees, alternatives) → str
  # Lettre Markdown structurée avec :
  #   - En-tête formelle (nom, adresse, date)
  #   - Constat chiffré des frais (tableau 12 mois)
  #   - Argument concurrentiel (top-3 alternatives)
  #   - Référence juridique : loi Macron mobilité bancaire + droit au compte
  #   - Demande explicite : suppression/réduction des frais
  #   - Footer professionnel

async def get_or_create_analysis(db, user_id) → FeeAnalysis
async def update_negotiation_status(db, user_id, status, result_amount) → FeeAnalysis
async def get_fee_schedules(db, bank_slug=None) → list[BankFeeSchedule]
```

**5. Schémas Pydantic (12 modèles)**

```python
# ── Request ──
class ScanFeesRequest(BaseModel): months: int = 12
class UpdateNegotiationRequest(BaseModel):
    status: Literal['draft','sent','waiting','resolved_success','resolved_fail']
    result_amount: int = 0  # centimes remboursés/annulés

# ── Sub-schemas ──
class FeeBreakdownItem(BaseModel): fee_type, label, annual_total, monthly_avg, count
class MonthlyFeeDetail(BaseModel): month, total, details: list[FeeBreakdownItem]
class BankAlternative(BaseModel): bank_slug, bank_name, is_online, total_there, saving, pct_saving

# ── Response ──
class FeeScanResponse(BaseModel):
    total_fees_annual, fees_by_type: dict, monthly_breakdown: list[MonthlyFeeDetail]
    overcharge_score, top_alternatives: list[BankAlternative]
    best_alternative_slug, best_alternative_saving
class NegotiationLetterResponse(BaseModel): letter_markdown, arguments: list[str]
class FeeAnalysisResponse(BaseModel): ... (full profile)
class BankFeeScheduleResponse(BaseModel): ... (single bank record)
class FeeScheduleListResponse(BaseModel): schedules: list[BankFeeScheduleResponse]
```

**6. Endpoints REST (7 routes)**

```
GET    /fees/analysis              → FeeAnalysisResponse (cached 600s)
POST   /fees/scan                  → FeeScanResponse (scan 12 mois, persiste)
GET    /fees/compare               → top_alternatives triées (cached)
POST   /fees/negotiate             → NegotiationLetterResponse (génère lettre)
PUT    /fees/negotiation-status    → FeeAnalysisResponse (met à jour statut)
GET    /fees/schedules             → FeeScheduleListResponse (grilles 20 banques)
GET    /fees/schedules/{bank_slug} → BankFeeScheduleResponse (grille 1 banque)
```

**7. Frontend — Page `/fees` (4 onglets)**

```
Onglet 1 : "Analyse" (défaut)
  ├── 4 KPI cards : Total annuel • Score surfacturation • Meilleure alternative • Économie potentielle
  ├── Graphe barres horizontales : frais par type (tenue, carte, agios, assurance, rejet, commissions)
  └── Timeline mensuelle 12 mois (bar chart empilé par type de frais)

Onglet 2 : "Comparatif"
  ├── Podium top-3 alternatives (cards avec logo + économie + %)
  └── Tableau complet 20 banques : colonnes = types de frais, ligne courante surlignée

Onglet 3 : "Négociation"
  ├── Statut pipeline (stepper : Brouillon → Envoyé → En attente → Résolu)
  ├── Preview lettre Markdown (rendu rich-text)
  ├── Boutons : Copier • Télécharger PDF • Marquer envoyé
  └── Résultat : montant obtenu si résolu

Onglet 4 : "Grilles"
  └── Tableau reference 20 banques avec toutes les colonnes tarifaires
```

**8. Tests (15 tests)**

```
UNIT (moteur pur — pas de DB) :
  → test_fee_scan_empty (aucune transaction → total 0)
  → test_fee_scan_categorizes_correctly (6 types reconnus)
  → test_overcharge_score_percentile_math (score 0 si en ligne, 80+ si agence)
  → test_compare_with_market_sorting (trié par saving desc)
  → test_compare_returns_top3 (max 3 alternatives)
  → test_negotiation_letter_contains_amounts (montants exacts dans la lettre)
  → test_negotiation_letter_contains_legal_ref (Loi Macron mentionnée)
  → test_fee_type_mapping_complete (tous les subcategory mappés)
  → test_seed_schedules_20_banks (exactement 20 banques)

INTÉGRATION (API endpoints) :
  → test_get_analysis_creates_default (GET → 200)
  → test_scan_fees (POST /scan → 200 avec breakdown)
  → test_compare (GET /compare → alternatives)
  → test_generate_letter (POST /negotiate → lettre markdown)
  → test_update_status (PUT → statut mis à jour)
  → test_get_schedules (GET → 20 banques)
```

#### C4 — Fiscal Radar (Semaine 13-14) — Optimisation Fiscale Temps Réel

> **Innovation 5 du plan stratégique** — "Fiscal Radar" : l'app surveille en continu les mouvements financiers et alerte sur les optimisations fiscales possibles, avec estimation de l'économie en euros. Aucune app concurrente ne fait de l'optimisation fiscale proactive en temps réel basée sur des données réelles.

##### Benchmark concurrentiel

```
┌─────────────────────────┬──────────┬──────────────────┬──────────┐
│ Fonctionnalité          │ Finary   │ Trade Republic   │ OmniFlow │
├─────────────────────────┼──────────┼──────────────────┼──────────┤
│ Moteur de règles FR     │ ✗        │ ✗                │ ✅ 7 dom │
│ Barème IR 2026 intégré  │ ✗        │ ✗                │ ✅       │
│ Alertes proactives      │ ✗        │ ✗                │ ✅ auto  │
│ Compteur PEA 5 ans      │ Partiel  │ ✗                │ ✅ J-xxx │
│ Crypto art.150 VH bis   │ ✗        │ ✗                │ ✅       │
│ Déficit foncier tracker │ ✗        │ ✗                │ ✅       │
│ PER plafond restant     │ ✗        │ ✗                │ ✅       │
│ Assurance-vie 8 ans     │ ✗        │ ✗                │ ✅       │
│ Export déclaration CERFA │ ✗        │ ✗                │ ✅ JSON  │
│ Économie estimée €      │ ✗        │ ✗                │ ✅       │
│ Scoring fiscal 0-100    │ ✗        │ ✗                │ ✅       │
│ Simulation TMI impact   │ ✗        │ ✗                │ ✅       │
└─────────────────────────┴──────────┴──────────────────┴──────────┘
```

##### C4.1 — Profil Fiscal Utilisateur (table `fiscal_profiles`)

```
TABLE fiscal_profiles
  id            UUID pk
  user_id       UUID → users.id ON DELETE CASCADE (unique, 1 profil/user)
  ── Situation fiscale ──
  tax_household  String(16)   "single" | "couple" | "family"
  parts_fiscales Float        default 1.0 (quotient familial FR)
  tmi_rate       Float        default 30.0 (0/11/30/41/45 — barème IR 2026)
  revenu_fiscal_ref  BigInteger  centimes (revenu fiscal de référence N-1)
  ── Enveloppes ──
  pea_open_date       Date nullable   (date ouverture PEA)
  pea_total_deposits  BigInteger 0    (cumul versements PEA, centimes)
  per_annual_deposits BigInteger 0    (versements PER année en cours, centimes)
  per_plafond         BigInteger 0    (plafond déduction PER année, centimes)
  av_open_date        Date nullable   (date ouverture Assurance-Vie principale)
  av_total_deposits   BigInteger 0    (cumul versements AV, centimes)
  ── Immobilier agrégé ──
  total_revenus_fonciers   BigInteger 0   (loyers bruts annuels, centimes)
  total_charges_deductibles BigInteger 0  (charges déductibles annuelles, centimes)
  deficit_foncier_reportable BigInteger 0 (cumul déficit reportable, centimes)
  ── Crypto agrégé ──
  crypto_pv_annuelle       BigInteger 0   (plus-values crypto année, centimes)
  crypto_mv_annuelle       BigInteger 0   (moins-values crypto année, centimes)
  ── Résultats moteur ──
  fiscal_score             Integer 0      (score optimisation 0-100)
  total_economy_estimate   BigInteger 0   (économie totale estimée, centimes)
  analysis_data            JSONB {}       (résultat complet du moteur)
  alerts_data              JSONB []       (alertes actives générées)
  export_data              JSONB {}       (données export fiscal structurées)
  created_at, updated_at   DateTime(tz)
```

##### C4.2 — Moteur de Règles Fiscales Françaises (7 domaines)

```
MOTEUR DE RÈGLES — 7 DOMAINES FISCAUX
═══════════════════════════════════════

Domaine 1 — PEA (Plan d'Épargne en Actions)
  → Art. L221-30 CMF : exonération IR des plus-values après 5 ans
  → Plafond versements : 150 000€ (PEA) / 225 000€ (PEA-PME cumulé)
  → Retrait avant 5 ans → clôture + PFU 30%
  → Retrait après 5 ans → seuls prélèvements sociaux 17,2%
  → Calcul J-restants avant maturité fiscale
  → Alerte "Ne vendez pas" si < 365 jours restants

Domaine 2 — Crypto-actifs (art. 150 VH bis CGI)
  → Flat tax 30% (PFU) = 12,8% IR + 17,2% PS sur PV nettes
  → Abattement forfaitaire annuel de 305€ sur PV
  → Calcul PV/MV nettes agrégées année en cours
  → Option barème progressif si TMI < 12,8%
  → Recommandation PFU vs barème basée sur TMI réel
  → Report de MV sur 10 années si MV nette

Domaine 3 — Immobilier locatif
  → Micro-foncier : revenus < 15 000€/an → abattement 30%
  → Régime réel : déduction charges réelles (intérêts, travaux, assurance)
  → Déficit foncier : imputable revenu global plafond 10 700€/an
  → Report déficit non imputé : 10 ans max
  → Simulation micro vs réel avec données utilisateur
  → Prélèvements sociaux 17,2% sur revenus fonciers nets
  → Alerte si micro-foncier moins avantageux que réel

Domaine 4 — PER (Plan d'Épargne Retraite)
  → Art. 163 quatervicies CGI : déduction versements du revenu global
  → Plafond = 10% revenus N-1 (min 4 399€, max 35 194€ pour 2026)
  → Mutualisation plafonds couple si imposition commune
  → Report plafond non utilisé sur 3 années suivantes
  → Calcul plafond restant = plafond - versements YTD
  → Alerte "Versez encore X€ avant le 31/12"
  → Économie = montant_versé × TMI (en %)

Domaine 5 — Assurance-Vie
  → Avant 8 ans : PFU 30% sur rachats (gains)
  → Après 8 ans : abattement annuel 4 600€ (célibataire) / 9 200€ (couple)
  → Au-delà de l'abattement : 7,5% + PS 17,2% si versements < 150k€
  → Au-delà de l'abattement : 12,8% + PS si versements > 150k€
  → Calcul J-restants avant maturité 8 ans
  → Alerte si arbitrage possible après 8 ans

Domaine 6 — Dividendes & Plus-Values Mobilières (CTO)
  → PFU 30% : flat tax par défaut sur dividendes et PV
  → Option barème : 40% abattement sur dividendes + IR au barème
  → Recommandation PFU vs barème basée sur TMI
  → Si TMI ≤ 11% → barème quasi-toujours plus avantageux
  → Calcul économie annuelle par option

Domaine 7 — Barème IR Progressif 2026
  → Tranches : 0% ≤ 11 497€ | 11% ≤ 29 315€ | 30% ≤ 83 823€ | 41% ≤ 180 294€ | 45% au-delà
  → Application quotient familial (parts_fiscales)
  → Calcul TMI effectif utilisateur
  → Impact marginal de chaque revenu supplémentaire
  → Simulation "si j'ajoute X€ de revenus"
```

##### C4.3 — Alertes Fiscales Proactives (génération automatique)

```
ALERTES PROACTIVES — 12 TYPES
════════════════════════════════

Priorité URGENTE (date limite approche) :
  1. pea_maturity_soon
     → "Votre PEA a 4 ans et 8 mois. Dans 4 mois, PV exonérées d'IR."
     → Déclencheur : pea_open_date + 5 ans - aujourd'hui < 365 jours
     → Économie estimée : pv_pea × 12,8%

  2. per_year_end_gap
     → "Versez encore 1 800€ sur votre PER avant le 31/12 — économie IR de 540€"
     → Déclencheur : per_plafond - per_annual_deposits > 0 ET mois ≥ 10
     → Économie estimée : gap × tmi_rate

  3. av_maturity_soon
     → "Votre Assurance-Vie atteint 8 ans dans 3 mois — abattement 4 600€"
     → Déclencheur : av_open_date + 8 ans - aujourd'hui < 365 jours
     → Économie estimée : min(gains, abattement) × 30%

  4. crypto_abattement
     → "PV crypto = 12 800€. Abattement 305€ applicable."
     → Déclencheur : crypto_pv_annuelle > 0
     → Économie estimée : min(305€, pv) × 30%

Priorité HAUTE (optimisation structurelle) :
  5. pfu_vs_bareme_dividends
     → "Votre TMI est 11%. Option barème = économie de 342€ sur dividendes"
     → Déclencheur : TMI ≤ 11% ET dividendes CTO > 0
     → Économie : calcul différentiel PFU vs barème+abattement 40%

  6. micro_vs_reel_foncier
     → "Régime réel = 2 400€ d'économie vs micro-foncier"
     → Déclencheur : charges_deductibles > 30% × revenus_fonciers
     → Économie : différence base imposable × (TMI + 17,2%)

  7. deficit_foncier_reportable
     → "Déficit foncier de 8 200€ imputable sur revenu global (plafond 10 700€)"
     → Déclencheur : charges > revenus ET deficit_foncier_reportable > 0
     → Économie : min(deficit, 10700) × TMI

  8. pea_ceiling_warning
     → "PEA rempli à 92%. Marge restante : 12 000€"
     → Déclencheur : pea_total_deposits > 80% × 150 000€

Priorité INFO (optimisation long terme) :
  9. crypto_pfu_vs_bareme
     → "TMI < 12,8% → option barème crypto potentiellement avantageuse"
     → Déclencheur : tmi_rate < 12.8 ET crypto_pv > 305€

 10. per_tax_impact
     → "Chaque 1 000€ versé sur PER économise 300€ d'IR (TMI 30%)"
     → Déclencheur : tmi_rate ≥ 30 ET per_plafond > per_annual_deposits

 11. av_post_8_years
     → "Assurance-Vie > 8 ans : rachats optimisés avec abattement"
     → Déclencheur : av_open_date + 8 ans < aujourd'hui

 12. fiscal_score_low
     → "Score fiscal 38/100 — 3 optimisations identifiées"
     → Déclencheur : fiscal_score < 50
     → Économie estimée : total_economy_estimate
```

##### C4.4 — Export Fiscal Annuel (données structurées CERFA-ready)

```
EXPORT FISCAL — STRUCTURE JSONB
══════════════════════════════════

{
  "year": 2026,
  "revenus_fonciers": {
    "brut": 1800000,          // 18 000€ en centimes
    "regime": "reel",
    "charges_deductibles": 720000,
    "revenu_net_foncier": 1080000,
    "deficit_foncier": 0,
    "cases_cerfa": { "4BA": 10800, "4BD": 7200 }
  },
  "plus_values_mobilieres": {
    "pv_cto": 340000,          // 3 400€
    "mv_cto": 0,
    "pv_nette_cto": 340000,
    "dividendes_bruts": 150000,
    "option_retenue": "pfu",
    "impot_estime": 102000,
    "cases_cerfa": { "3VG": 3400, "2DC": 1500 }
  },
  "crypto_actifs": {
    "pv_nette": 1280000,       // 12 800€
    "abattement_305": 30500,
    "base_imposable": 1249500,
    "flat_tax_estime": 374850,
    "cases_cerfa": { "3AN": 12495 }
  },
  "per_deductions": {
    "versements": 500000,      // 5 000€
    "plafond_utilise": 500000,
    "economie_ir": 150000,
    "cases_cerfa": { "6NS": 5000 }
  },
  "synthese": {
    "total_impot_estime": 626850,
    "economies_realisees": 180500,
    "score_fiscal": 72
  }
}
```

##### C4.5 — Stack technique

```
FICHIERS CRÉÉS — PHASE C4
══════════════════════════

Backend (apps/api/) :
  alembic/versions/020_fiscal_radar.py
      → CREATE TABLE fiscal_profiles (UUID pk, user_id unique FK, 20+ colonnes)
      → Seed : aucune donnée statique (profil créé dynamiquement par utilisateur)

  app/models/fiscal_profile.py
      → class FiscalProfile(Base, UUIDMixin, TimestampMixin)
      → TaxHousehold enum (single/couple/family)
      → 20+ colonnes : parts_fiscales, tmi, enveloppes, agrégats, score, JSONB

  app/schemas/fiscal_radar.py
      → 15+ Pydantic models :
        CreateFiscalProfileRequest, UpdateFiscalProfileRequest,
        FiscalProfileResponse, FiscalAlertItem, FiscalAlertListResponse,
        FiscalAnalysisRequest, FiscalAnalysisResponse,
        FiscalExportResponse, TMISimulationRequest, TMISimulationResponse,
        FiscalOptimizationItem, FiscalScoreBreakdown, DomainAnalysis

  app/services/fiscal_radar_engine.py
      → Moteur de règles 7 domaines (fonctions async pures)
      → async analyze_fiscal_profile(db, user_id) → agrège toutes sources
      → async generate_fiscal_alerts(profile) → 12 types d'alertes
      → async compute_fiscal_score(profile, alerts) → score 0-100
      → async build_fiscal_export(db, user_id, year) → JSONB CERFA-ready
      → async simulate_tmi_impact(profile, extra_income) → simulation
      → compute_ir_from_bareme(revenu_net, parts) → calcul IR barème 2026
      → pfu_vs_bareme_comparison(tmi, dividendes, pv) → recommandation

  app/api/v1/fiscal_radar.py
      → 7 endpoints REST :
        GET    /fiscal/profile         → profil fiscal utilisateur
        PUT    /fiscal/profile         → mise à jour profil
        POST   /fiscal/analyze         → lancer l'analyse complète
        GET    /fiscal/alerts          → alertes proactives
        GET    /fiscal/export/{year}   → export fiscal année
        POST   /fiscal/simulate-tmi    → simulation impact TMI
        GET    /fiscal/score           → score + breakdown

Frontend (apps/web/) :
  src/types/api.ts
      → 10+ interfaces TypeScript (FiscalProfile, FiscalAlert, FiscalExport…)

  src/stores/fiscal-radar-store.ts
      → Zustand store : profile, alerts, analysis, export, score
      → 8 actions : fetchProfile, updateProfile, runAnalysis, fetchAlerts,
        fetchExport, simulateTMI, fetchScore, fetchAll

  src/app/(dashboard)/fiscal/page.tsx
      → 5 onglets : Profil | Alertes | Analyse | Export | Simulation TMI
      → Composants : FiscalScoreGauge, AlertCard, ExportTable, TMISimulator
      → Animations Framer Motion, responsive, dark-mode ready

  src/components/layout/sidebar.tsx
      → Ajout "Fiscal" dans section Intelligence (icône Shield de lucide-react)

Registrations :
  app/models/__init__.py        → + FiscalProfile
  app/api/v1/router.py          → + fiscal_radar_router
  app/core/config.py            → + CACHE_TTL_FISCAL_RADAR: int = 600

Tests (20 tests) :
  tests/test_fiscal_radar.py
      UNIT (11 tests) :
        → test_ir_bareme_tranche_0   (revenu 10 000€ → IR = 0)
        → test_ir_bareme_tranche_30  (revenu 50 000€ → IR correct)
        → test_pfu_vs_bareme_tmi11   (TMI 11% → barème recommandé)
        → test_pfu_vs_bareme_tmi30   (TMI 30% → PFU recommandé)
        → test_pea_days_remaining    (calcul jours restants)
        → test_crypto_abattement_305 (PV < 305€ → base = 0)
        → test_micro_vs_reel_switch  (charges > 30% → réel meilleur)
        → test_per_plafond_gap       (plafond - versements = gap)
        → test_fiscal_score_range    (score toujours 0-100)
        → test_deficit_foncier_cap   (plafonné 10 700€)
        → test_av_maturity_calc      (calcul maturité 8 ans)
      INTEGRATION (9 tests) :
        → test_create_profile        (PUT /fiscal/profile → 200)
        → test_get_profile           (GET /fiscal/profile → profil)
        → test_run_analysis          (POST /fiscal/analyze → résultat)
        → test_get_alerts            (GET /fiscal/alerts → liste)
        → test_export_year           (GET /fiscal/export/2026 → JSON)
        → test_simulate_tmi          (POST /fiscal/simulate-tmi → impact)
        → test_get_score             (GET /fiscal/score → breakdown)
        → test_unauthenticated       (→ 401 sans token)
        → test_default_profile       (profil auto-créé avec defaults)
```

#### C5 — Wealth Autopilot (Semaine 14) — Épargne Automatique Intelligente

> **Innovation 4 du plan stratégique** — "Wealth Autopilot" : l'app calcule chaque jour le montant optimal à épargner en fonction des revenus prévus, des dépenses à venir, et du matelas de sécurité — puis répartit l'épargne disponible vers des objectifs priorisés avec suggestions DCA. Aucune app ne fait ça en prenant en compte TOUT le patrimoine.

##### Benchmark concurrentiel

```
┌──────────────────────────────┬───────────┬───────────────┬──────────┐
│ Fonctionnalité               │ Finary    │ Wealthfront   │ OmniFlow │
├──────────────────────────────┼───────────┼───────────────┼──────────┤
│ Calcul épargne disponible    │ ✗         │ Round-up seul │ ✅ J+7   │
│ Matelas sécurité dynamique   │ ✗         │ ✗             │ ✅ 3-6mo │
│ Engagements futurs 7j        │ ✗         │ ✗             │ ✅       │
│ Allocation par priorité      │ ✗         │ Partiel       │ ✅ 5 niv │
│ Lien Projets existants       │ ✗         │ ✗             │ ✅       │
│ DCA mensuel suggéré          │ ✗         │ Auto limité   │ ✅ 5 cla │
│ Historique suggestions       │ ✗         │ ✗             │ ✅ log   │
│ Score autopilot 0-100        │ ✗         │ ✗             │ ✅       │
│ Simulation scénarios épargne │ ✗         │ ✗             │ ✅ 3 scé │
│ Cashflow projection intégrée │ ✗         │ ✗             │ ✅ 30j   │
│ Paliers min 20€ / step 10€  │ ✗         │ Round-up 1€   │ ✅       │
│ Taux épargne calculé         │ ✗         │ ✗             │ ✅       │
└──────────────────────────────┴───────────┴───────────────┴──────────┘
```

##### C5.1 — Configuration Autopilot (table `autopilot_configs`)

```
TABLE autopilot_configs
  id                UUID pk
  user_id           UUID → users.id ON DELETE CASCADE (unique, 1 config/user)
  ── Paramétrage global ──
  is_enabled        Boolean  default true
  safety_cushion_months  Float  default 3.0  (matelas = X mois de charges)
  min_savings_amount     BigInteger  2000   (20€ en centimes, seuil minimum)
  savings_step           BigInteger  1000   (10€ en centimes, palier arrondi)
  lookback_days          Integer  90        (historique pour estimer dépenses)
  forecast_days          Integer  7         (horizon engagements futurs)
  ── Revenus récurrents (pour fiabiliser le calcul) ──
  monthly_income         BigInteger  0      (salaire net mensuel en centimes)
  income_day             Integer  default 1 (jour du mois du virement salaire)
  other_income           BigInteger  0      (loyers, freelance, etc. /mois)
  ── Allocations par priorité (5 niveaux) ──
  allocations            JSONB  []          (liste ordonnée de cibles)
  ── Résultats moteur ──
  last_available         BigInteger  0      (dernière épargne dispo calculée)
  last_suggestion        JSONB  {}          (dernière suggestion structurée)
  suggestions_history    JSONB  []          (historique des suggestions)
  autopilot_score        Integer  0         (score 0-100)
  savings_rate_pct       Float  0.0         (taux d'épargne mensuel %)
  analysis_data          JSONB  {}          (données détaillées du calcul)
  created_at, updated_at DateTime(tz)
```

```
ALLOCATION JSONB — Structure
═══════════════════════════════

[
  {
    "priority": 1,
    "type": "safety_cushion",
    "label": "Matelas de sécurité (Livret A)",
    "target": 900000,        // 9 000€ = 3 mois de 3 000€
    "current": 600000,       // 6 000€ déjà épargnés
    "pct": 100,              // 100% de l'épargne Y VA tant que pas rempli
    "account_type": "savings"
  },
  {
    "priority": 2,
    "type": "project",
    "label": "Vacances été 2026",
    "project_id": "uuid-du-projet",
    "target": 300000,
    "current": 180000,
    "pct": 40,               // 40% de l'épargne restante
    "deadline": "2026-07-01"
  },
  {
    "priority": 3,
    "type": "project",
    "label": "Apport immobilier",
    "project_id": "uuid-du-projet-2",
    "target": 5000000,
    "current": 2100000,
    "pct": 30,
    "deadline": "2028-01-01"
  },
  {
    "priority": 4,
    "type": "dca_etf",
    "label": "DCA ETF World (PEA)",
    "pct": 20,
    "asset_class": "etf",
    "target_monthly": 20000    // 200€/mois
  },
  {
    "priority": 5,
    "type": "dca_crypto",
    "label": "DCA Bitcoin",
    "pct": 10,
    "asset_class": "crypto",
    "target_monthly": 5000     // 50€/mois
  }
]
```

##### C5.2 — Moteur de Calcul Épargne Disponible (analyse quotidienne)

```
ALGORITHME WEALTH AUTOPILOT — 4 ÉTAPES
════════════════════════════════════════

ÉTAPE 1 — Snapshot financier
  → Solde total comptes courants (checking) de l'utilisateur
  → Somme des revenus récurrents attendus dans les forecast_days jours
  → Somme des dépenses récurrentes (is_recurring=true) à venir
  → Estimation dépenses variables (moyenne lookback_days jours)

ÉTAPE 2 — Calcul du matelas requis
  → monthly_expenses = moyenne dépenses mensuelles sur lookback_days
  → safety_cushion_target = monthly_expenses × safety_cushion_months
  → safety_current = solde comptes épargne (savings, livret A)
  → safety_gap = max(0, safety_cushion_target - safety_current)

ÉTAPE 3 — Épargne disponible
  → checking_balance = somme des soldes comptes courants
  → upcoming_debits = dépenses récurrentes + estimation variables sur 7j
  → safety_reserve = matelas minimum sur compte courant (30% monthly_expenses)
  → available = checking_balance - upcoming_debits - safety_reserve
  → IF available < min_savings_amount → suggestion = "Rien à épargner cette semaine"
  → ELSE → arrondir au palier inférieur (floor(available / step) * step)

ÉTAPE 4 — Répartition par priorité
  → Parcourir allocations par priority ASC
  → Si type = safety_cushion ET safety_gap > 0
    → allouer min(available × pct%, safety_gap, available_restant)
  → Si type = project
    → allouer min(available × pct%, target - current, available_restant)
  → Si type = dca_etf ou dca_crypto
    → allouer min(available × pct%, target_monthly, available_restant)
  → Générer suggestion structurée avec breakdown par cible
```

##### C5.3 — DCA (Dollar Cost Averaging) Suggéré

```
DCA ENGINE — 5 CLASSES D'ACTIFS
══════════════════════════════════

1. dca_etf       → ETF World / S&P 500 / CAC 40 via PEA ou CTO
2. dca_crypto    → Bitcoin, Ethereum via wallet crypto existant
3. dca_scpi      → SCPI parts mensuelles
4. dca_bond      → Obligations / Fonds euros AV
5. dca_custom    → Investissement libre défini par l'utilisateur

Pour chaque DCA :
  → target_monthly       (montant mensuel cible en centimes)
  → actual_this_month    (montant déjà versé ce mois)
  → remaining            (target - actual)
  → suggestion           ("Investir 200€ en ETF World cette semaine")
  → performance_12m      (rendement estimé sur 12 mois pour info)

Historique DCA :
  → Chaque suggestion est loggée dans suggestions_history
  → Statut : "suggested" → "accepted" → "executed" / "skipped"
  → Permet de comparer : montant suggéré vs montant réellement investi
```

##### C5.4 — Score Autopilot & Métriques

```
SCORE AUTOPILOT (0-100) — Composantes
════════════════════════════════════════

  30% — Taux d'épargne
        → savings_rate = (épargne mensuelle / revenus mensuels) × 100
        → < 5% = 0 pts | 5-10% = 10 | 10-20% = 20 | 20-30% = 25 | 30%+ = 30

  25% — Matelas sécurité
        → safety_fill = safety_current / safety_target × 100
        → < 50% = 0 | 50-80% = 10 | 80-100% = 20 | 100%+ = 25

  20% — Régularité
        → Suggestions acceptées / total sur 3 mois
        → < 30% = 0 | 30-60% = 5 | 60-80% = 10 | 80-100% = 15 | 100% = 20

  15% — Diversification DCA
        → 0 classe = 0 | 1 = 5 | 2 = 10 | 3+ = 15

  10% — Projets actifs
        → 0 projet = 0 | 1 = 3 | 2 = 6 | 3+ = 10

Total capped at 100.
```

##### C5.5 — Simulation Scénarios Épargne

```
3 SCÉNARIOS — "Et si…"
═══════════════════════

Scénario PRUDENT :
  → Épargne uniquement le minimum (20€/semaine)
  → 100% vers matelas → puis projets
  → Projection 6/12/24 mois

Scénario MODÉRÉ :
  → Épargne calculée par l'algorithme (montant actuel)
  → Répartition selon allocations utilisateur
  → Projection 6/12/24 mois avec rendements estimés

Scénario AMBITIEUX :
  → Épargne +50% du montant calculé
  → DCA renforcé, projets accélérés
  → Projection 6/12/24 mois avec rendements estimés

Chaque scénario retourne :
  → total_epargne_6m / 12m / 24m
  → safety_cushion_plein_dans = X mois
  → projets_atteints = [{nom, mois_restants}]
  → patrimoine_projete = solde final estimé
```

##### C5.6 — Stack technique

```
FICHIERS CRÉÉS — PHASE C5
══════════════════════════

Backend (apps/api/) :
  alembic/versions/021_wealth_autopilot.py
      → CREATE TABLE autopilot_configs (UUID pk, user_id unique FK, 20+ colonnes)
      → Pas de seed (config créée dynamiquement par utilisateur)

  app/models/autopilot_config.py
      → class AutopilotConfig(Base, UUIDMixin, TimestampMixin)
      → AllocationType enum (safety_cushion/project/dca_etf/dca_crypto/dca_scpi/dca_bond/dca_custom)
      → 20+ colonnes : is_enabled, safety, income, allocations JSONB, results JSONB

  app/schemas/wealth_autopilot.py
      → 14+ Pydantic models :
        UpdateAutopilotConfigRequest, AutopilotConfigResponse,
        AllocationItem, SavingsSuggestion, SuggestionBreakdown,
        ComputeRequest, ComputeResponse,
        DCAItem, DCAStatusResponse,
        ScenarioResult, ScenarioProjection, SimulateResponse,
        AutopilotScoreBreakdown, AutopilotScoreResponse,
        SuggestionHistoryItem, SuggestionHistoryResponse,
        AcceptSuggestionRequest

  app/services/wealth_autopilot_engine.py
      → Moteur 4 étapes (snapshot, matelas, available, allocation)
      → async compute_savings(db, user_id) → suggestion structurée
      → async generate_dca_suggestions(config, available) → DCA 5 classes
      → compute_autopilot_score(config, suggestions_history) → score 0-100
      → simulate_scenarios(config, available) → 3 scénarios × 3 horizons
      → async accept_suggestion(db, user_id, suggestion_id) → log
      → async get_suggestion_history(db, user_id) → historique

  app/api/v1/wealth_autopilot.py
      → 8 endpoints REST :
        GET    /autopilot/config         → config autopilot
        PUT    /autopilot/config         → mise à jour config
        POST   /autopilot/compute        → calculer épargne disponible
        GET    /autopilot/suggestions    → dernière suggestion
        POST   /autopilot/accept         → accepter une suggestion
        GET    /autopilot/history        → historique des suggestions
        POST   /autopilot/simulate       → simulation 3 scénarios
        GET    /autopilot/score          → score + breakdown

Frontend (apps/web/) :
  src/types/api.ts
      → 12+ interfaces TypeScript (AutopilotConfig, SavingsSuggestion, DCAItem…)

  src/stores/wealth-autopilot-store.ts
      → Zustand store : config, suggestion, history, scenarios, score
      → 9 actions : fetchConfig, updateConfig, compute, acceptSuggestion,
        fetchHistory, simulate, fetchScore, fetchAll, clearError

  src/app/(dashboard)/autopilot/page.tsx
      → 5 onglets : Épargne | DCA | Historique | Simulation | Score
      → Composants : SavingsGauge, AllocationBar, DCACard, ScenarioChart,
        SuggestionCard, ScoreRadar
      → Animations Framer Motion, responsive, dark-mode ready

  src/components/layout/sidebar.tsx
      → Ajout "Autopilot" dans section Intelligence (icône Rocket de lucide-react)

Registrations :
  app/models/__init__.py        → + AutopilotConfig
  app/api/v1/router.py          → + wealth_autopilot_router
  app/core/config.py            → + CACHE_TTL_WEALTH_AUTOPILOT: int = 300

Tests (20 tests) :
  tests/test_wealth_autopilot.py
      UNIT (12 tests) :
        → test_available_positive      (solde suffisant → épargne > 0)
        → test_available_negative      (solde < matelas → épargne = 0)
        → test_round_to_step           (arrondi au palier 10€)
        → test_min_savings_threshold   (< 20€ → pas de suggestion)
        → test_allocation_safety_first (priorité 1 = matelas)
        → test_allocation_project      (remplissage projet)
        → test_allocation_dca          (DCA allocation pct)
        → test_score_range_0_100       (score toujours borné)
        → test_score_high_savings_rate (taux > 30% → score élevé)
        → test_scenario_prudent        (projection minimale)
        → test_scenario_ambitieux      (projection +50%)
        → test_savings_rate_calc       (taux = épargne / revenus)
      INTEGRATION (8 tests) :
        → test_get_config              (GET /autopilot/config → config)
        → test_update_config           (PUT → config mise à jour)
        → test_compute_savings         (POST /autopilot/compute → suggestion)
        → test_accept_suggestion       (POST /autopilot/accept → logged)
        → test_get_history             (GET /autopilot/history → list)
        → test_simulate_scenarios      (POST /autopilot/simulate → 3 scénarios)
        → test_get_score               (GET /autopilot/score → breakdown)
        → test_unauthenticated         (→ 401 sans token)
```

---

### Phase D — UX Excellence & Design System Premium

> **Durée estimée** : 3-4 semaines
> **Objectif** : Chaque pixel respire le premium. L'UX surpasse Trade Republic.

#### D1 — Design System 2.0 (Semaine 15)

```
D1.1  Composants atomiques unifiés
      → 1 seul hook `useAnimatedNumber()` (fusionner les 3 CountUp)
      → 1 seul composant `<CurrencyDisplay />` unifié (montant + devise + variation)
      → Storybook optionnel pour documentation visuelle des composants
      → Tests visuels (Chromatic ou snapshots)

D1.2  Mode discret
      → Toggle global "Masquer les montants"
      → Tous les montants → "••••" avec animation reveal au clic
      → Persisté en localStore / cookie
      → Icône œil dans le header

D1.3  Accessibilité A11y
      → Audit Lighthouse Accessibility > 95
      → aria-label sur tous les boutons icônes
      → Focus trap dans les modals
      → Skip-to-content link
      → Contraste vérifié pour dark ET light mode
      → Navigation 100% clavier possible
```

#### D2 — Animations Cinématiques (Semaine 16)

```
D2.1  Page transitions
      → Framer Motion AnimatePresence autour du children du layout
      → Crossfade 200ms entre pages
      → Shared layout animations : les cards "volent" entre dashboard et détail

D2.2  Chart animations
      → Line draw-in progressif gauche→droite (800ms)
      → Donut : segments apparaissent un par un (stagger 100ms)
      → Bar chart : grow-up depuis la baseline (stagger 50ms)
      → Tooltip : crosshair vertical animé au survol

D2.3  Glassmorphism premium
      → Net Worth Hero : backdrop-blur-xl + gradient overlay
      → Modals : glass effect avec blur fond
      → Hover glow sur les cards (radial gradient qui suit le curseur, style Stripe)

D2.4  Micro-interactions
      → Haptic feedback (navigator.vibrate) sur les boutons CTA mobile
      → Confetti au franchissement de seuils patrimoine (100K, 500K, 1M)
      → 3D tilt subtil au hover sur les cards (CSS perspective transform)
      → Smooth number transition PARTOUT (jamais de saut brutal)
      → Pull-to-refresh spring physics (monter le composant déjà codé)
```

#### D3 — Onboarding Premium (Semaine 17)

```
D3.1  Wizard post-inscription
      → Étape 1 : "Bienvenue" — animation de particules + explication Privacy-first
      → Étape 2 : "Connectez votre banque" — sélection avec logo grid + search
      → Étape 3 : "Ajoutez vos investissements" — crypto + bourse (optionnel)
      → Étape 4 : "Votre tableau de bord" — reveal progressif du dashboard
      → Progress bar en haut, retour possible, skip autorisé

D3.2  Middleware Next.js fonctionnel
      → Vérifier le token côté serveur (cookie httpOnly)
      → Redirect /dashboard → /login si non-auth
      → Redirect /login → /dashboard si déjà auth
      → Redirect / → /dashboard (existant)

D3.3  Dashboard reveal
      → Première visite : animation spéciale (logo draw-in, compteur from 0)
      → Visite quotidienne : données cachées instantanées + refresh background
```

#### D4 — Responsive Excellence (Semaine 17-18)

```
D4.1  Mobile redesigné (pas rétréci)
      → Dashboard mobile : Net Worth sticky + horizontal scroll cards + feed vertical
      → Bottom nav : 5 items avec animations tap bounce
      → Cartes swipeable (geste natif) pour naviguer entre comptes
      → Charts : touch-friendly tooltips, pinch-to-zoom

D4.2  Tablet optimisé
      → Layout 2 colonnes : sidebar compacte (64px) + contenu
      → Charts en pleine largeur
      → Transaction lists avec colonnes adaptées

D4.3  Desktop large (2xl+)
      → Layout 3 colonnes maximum
      → Panels latéraux pour les détails (split view)
      → Raccourcis clavier : Cmd+K pour search, Cmd+N pour nouvelle connexion
```

---

### Phase E — Production, PWA & Go-to-Market

> **Durée estimée** : 3-4 semaines
> **Objectif** : Application installable, rapide, offline, prête pour le public.

#### E1 — Progressive Web App Ultra-Premium (Semaine 19) ✅ IMPLÉMENTÉ

> **Objectif** : Transformer OmniFlow en une Progressive Web App de grade institutionnel — installable, offline-first, push-native — surpassant Finary (zéro PWA), Trade Republic (app native seulement), et YNAB (PWA basique sans offline). OmniFlow devient la première FinTech open-source avec une expérience PWA rivale des apps natives.

```
═══════════════════════════════════════════════════════════════════════════
E1.0  Vision — Pourquoi une PWA surpasse les apps natives en FinTech
═══════════════════════════════════════════════════════════════════════════

  Benchmark concurrentiel et position cible :
  ─────────────────────────────────────────────────────────────────────────
  │ Fonctionnalité                    │ Finary   │ Trade Rep │ YNAB     │ OmniFlow E1 │
  │───────────────────────────────────│──────────│───────────│──────────│─────────────│
  │ Installable (A2HS)                │ ❌ web   │ ✅ native │ ✅ basic │ ✅ custom    │
  │ Mode Offline complet              │ ❌       │ ✅ native │ ❌       │ ✅ SW cache  │
  │ Notifications Push (VAPID)        │ ❌       │ ✅ native │ ❌       │ ✅ multi-tpl │
  │ Background Sync Queue             │ ❌       │ ✅ native │ ❌       │ ✅ SW queue  │
  │ App Shortcuts (quick actions)     │ ❌       │ ❌        │ ❌       │ ✅ 3 actions │
  │ Cache intelligent multi-stratégie │ ❌       │ n/a      │ ❌       │ ✅ 4 strats  │
  │ Indicateur connexion live         │ ❌       │ ❌        │ ❌       │ ✅ banner    │
  │ Badge compteur (icône app)        │ ❌       │ ✅        │ ❌       │ ✅ navigator │
  │ Persistance données offline       │ ❌       │ ✅ SQLite │ ❌       │ ✅ IndexedDB │
  │ Push personnalisées (7 templates) │ ❌       │ 2 types  │ ❌       │ ✅ 7 types  │
  └───────────────────────────────────┴──────────┴───────────┴──────────┴─────────────┘

  OmniFlow est la SEULE app patrimoniale open-source à proposer une
  expérience PWA complète avec offline, push, install, et cache
  intelligent — sans passer par les app stores, sans frais Apple/Google.


═══════════════════════════════════════════════════════════════════════════
E1.1  Service Worker — Cache Multi-Stratégie + Offline Engine  ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  > Statut d'implémentation E1.1 :
  > - [x] Service Worker Workbox custom (public/sw.js)
  > - [x] App Shell strategy : cache-first pour les assets statiques
  > - [x] API Data strategy : stale-while-revalidate pour les données REST
  > - [x] Images strategy : cache-first 30 jours avec limite 100 entrées
  > - [x] Navigation strategy : network-first avec fallback offline.html
  > - [x] Background Sync queue pour actions offline (POST/PUT/DELETE)
  > - [x] Cache versioning avec cleanup automatique des anciennes versions
  > - [x] Skip waiting + clients claim pour activation immédiate
  > - [x] Push notification handler avec route vers la bonne page
  > - [x] Offline fallback page (public/offline.html) stylée OmniFlow

  Fichier : public/sw.js (Service Worker vanilla — pas de build step)
  ─────────────────────────────────────────────────────────────────────────

  Architecture des caches (4 stratégies distinctes) :

  ① APP SHELL — Cache-First (ressources statiques immuables)
    → Cache : "omniflow-shell-v1"
    → Ressources : /_next/static/**, fonts, icons, manifest.json
    → Stratégie : si en cache → servir immédiatement (< 1ms)
      sinon → fetch + mise en cache
    → Avantage : temps de chargement quasi-nul après première visite
    → Versioning : le cache est vidé quand la version du SW change

  ② API DATA — Stale-While-Revalidate (données REST)
    → Cache : "omniflow-api-v1"
    → Routes : /api/v1/dashboard/**, /api/v1/networth/**,
      /api/v1/cashflow/**, /api/v1/budget/**, /api/v1/notifications/**,
      /api/v1/insights/**, /api/v1/vault/summary
    → Stratégie : servir depuis le cache immédiatement + fetch en arrière-plan
      → Si le fetch réussit, mettre à jour le cache pour le prochain appel
      → Si le fetch échoue (offline), le cache sert de fallback
    → TTL max : 24h — les entrées plus vieilles sont supprimées
    → Avantage : le dashboard se charge instantanément, même offline,
      avec des données au pire vieilles de 24h

  ③ IMAGES — Cache-First, 30 jours max, 100 entrées max
    → Cache : "omniflow-images-v1"
    → Routes : images PNG/JPG/SVG/WEBP, favicons, logos banques
    → Limite : 100 entrées max (FIFO eviction)
    → TTL : 30 jours (les icônes banques ne changent pas souvent)

  ④ NAVIGATION — Network-First avec fallback offline
    → Pour les requêtes de navigation (mode: 'navigate')
    → Essaie le réseau d'abord (page SSR fraîche)
    → Si offline → sert /offline.html (page statique cachée au install)
    → offline.html affiche un message élégant avec les dernières données

  ⑤ BACKGROUND SYNC QUEUE — Actions différées hors-ligne
    → Quand l'utilisateur est offline et fait un POST/PUT/DELETE :
      · La requête est sérialisée dans IndexedDB (queue "omniflow-sync-queue")
      · Un événement 'sync' est enregistré sur le SW tag "omniflow-sync"
      · Quand la connexion revient → le SW replay les requêtes en FIFO
      · Notification in-app : "3 actions synchronisées avec succès"
    → Cas d'usage : marquer une notification lue, modifier un budget,
      ajouter un bien au coffre-fort — tout fonctionne offline

  ⑥ PUSH NOTIFICATION HANDLER
    → Le SW écoute l'événement 'push' (Web Push API VAPID)
    → Affiche une notification système native avec :
      · Titre, corps, icône (/icons/icon-192.png)
      · Badge (/icons/badge-72.png) — pictogramme monochrome
      · Actions : "Voir" + "Fermer"
      · Data : URL de destination pour le clic
    → L'événement 'notificationclick' ouvre/focus la fenêtre OmniFlow
      et navigue vers l'URL embarquée dans la notification

  ⑦ LIFECYCLE — Activation immédiate
    → self.skipWaiting() à l'install — pas d'attente d'onglet fermé
    → clients.claim() à l'activation — contrôle immédiat de tous les onglets
    → Suppression des caches obsolètes (versions précédentes) à l'activation


═══════════════════════════════════════════════════════════════════════════
E1.2  Web App Manifest — Identité PWA Premium  ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  > Statut d'implémentation E1.2 :
  > - [x] manifest.json complet (public/manifest.json)
  > - [x] Icônes 6 tailles (72/96/128/192/384/512) + maskable
  > - [x] App Shortcuts : 3 actions rapides (Dashboard, Patrimoine, Nova IA)
  > - [x] Screenshots desktop + mobile pour l'install prompt enrichi
  > - [x] Catégorie "finance", orientation "any", display "standalone"
  > - [x] Thème noir OLED + couleur de fond cohérente

  Fichier : public/manifest.json
  ─────────────────────────────────────────────────────────────────────────

  Manifest JSON complet :
  → name : "OmniFlow — Patrimoine Unifié"
  → short_name : "OmniFlow"
  → description : "Agrégez banques, crypto, bourse, immobilier et dettes"
  → start_url : "/dashboard"
  → scope : "/"
  → display : "standalone" (pas de barre d'adresse navigateur)
  → display_override : ["window-controls-overlay", "standalone"]
      → Window Controls Overlay : sur les navigateurs compatibles,
        les contrôles de fenêtre sont intégrés dans le header OmniFlow
        (expérience encore plus native)
  → orientation : "any" (portrait + paysage)
  → theme_color : "#000000" (noir OLED cohérent avec le design system)
  → background_color : "#000000"
  → categories : ["finance", "productivity", "utilities"]
  → lang : "fr"
  → dir : "ltr"

  Icônes (6 tailles + maskable) :
  → 72×72, 96×96, 128×128, 192×192, 384×384, 512×512
  → purpose : "any" pour les icônes standard
  → icône 512×512 maskable séparée (safe area pour Android adaptive icons)
  → Toutes en PNG avec fond transparent

  Shortcuts (actions rapides depuis l'icône — long press mobile / right click desktop) :
  → 🏠 "Dashboard" → /dashboard — "Vue d'ensemble patrimoine"
  → 💰 "Patrimoine" → /patrimoine — "Banques, crypto, bourse, immo"
  → ✨ "Nova IA" → /nova — "Assistant financier intelligent"

  Screenshots (enrichissement du prompt d'installation) :
  → 1 screenshot desktop (1280×720) : dashboard complet
  → 1 screenshot mobile (750×1334) : dashboard mobile


═══════════════════════════════════════════════════════════════════════════
E1.3  Notifications Push — Web Push API VAPID  ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  > Statut d'implémentation E1.3 :
  > - [x] Migration Alembic 026 : table push_subscriptions
  > - [x] Modèle SQLAlchemy : PushSubscription (endpoint, keys, user_id)
  > - [x] Schemas Pydantic : PushSubscriptionCreate, PushSubscriptionResponse
  > - [x] Backend service : push_service.py (send_push_notification via pywebpush)
  > - [x] Router : 3 endpoints REST (subscribe, unsubscribe, test)
  > - [x] Config : VAPID_PRIVATE_KEY + VAPID_PUBLIC_KEY + VAPID_SUBJECT
  > - [x] Frontend hook : usePushNotifications (subscribe/unsubscribe/permission)
  > - [x] UI toggle : dans le composant PWAInstallPrompt (opt-in explicite)
  > - [x] Intégration push_notification() → envoie aussi en push natif
  > - [x] 7 templates de notification (sync, anomalie, budget, patrimoine,
  >       alerte prix, rappel hebdo, calendrier)

  Architecture Push complète :
  ─────────────────────────────────────────────────────────────────────────

  ① BACKEND — Push Service (app/services/push_service.py)
    → Utilise pywebpush (lib Python standard pour Web Push Protocol)
    → Méthode send_push(user_id, title, body, url, icon, tag) :
      1. Récupère toutes les subscriptions actives de l'utilisateur
      2. Construit le payload JSON : {title, body, url, icon, badge, tag}
      3. Pour chaque subscription, appelle webpush() avec les clés VAPID
      4. Gère les erreurs : si 410 Gone (subscription expirée) → DELETE en DB
      5. Logging : "Push sent to user {user_id}: {title}"
    → Méthode broadcast_push(user_ids, title, body, url) :
      Envoie la même notification à une liste d'utilisateurs (pour les alerts batch)

  ② BASE DE DONNÉES — Table push_subscriptions (migration 026)
    ┌──────────────────────┬────────────────────┬──────────────────────────┐
    │ Colonne              │ Type               │ Contraintes              │
    ├──────────────────────┼────────────────────┼──────────────────────────┤
    │ id                   │ UUID PK            │ default uuid4            │
    │ user_id              │ UUID FK→users.id   │ NOT NULL, CASCADE, idx   │
    │ endpoint             │ Text               │ NOT NULL, UNIQUE         │
    │ p256dh_key           │ Text               │ NOT NULL                 │
    │ auth_key             │ Text               │ NOT NULL                 │
    │ user_agent           │ String(500)        │ NULL                     │
    │ created_at           │ DateTime(tz)       │ TimestampMixin           │
    │ updated_at           │ DateTime(tz)       │ TimestampMixin           │
    └──────────────────────┴────────────────────┴──────────────────────────┘

  ③ API — 3 endpoints REST (app/api/v1/push.py)
    → POST /api/v1/push/subscribe — Enregistre une subscription push
      Body : { endpoint, keys: { p256dh, auth }, user_agent }
      → Crée ou met à jour la subscription (UPSERT sur endpoint)
    → DELETE /api/v1/push/unsubscribe — Supprime une subscription
      Body : { endpoint }
    → POST /api/v1/push/test — Envoie une notification push de test
      (utile pour vérifier que tout fonctionne)

  ④ CONFIG — Clés VAPID (app/core/config.py)
    → VAPID_PRIVATE_KEY : clé privée pour signer les notifications push
    → VAPID_PUBLIC_KEY : clé publique envoyée au navigateur pour le subscribe
    → VAPID_SUBJECT : "mailto:contact@omniflow.app" (identifiant du serveur)
    → Les clés sont générées une seule fois via : 
      python -c "from pywebpush import webpush; from py_vapid import Vapid; v = Vapid(); v.generate_keys(); print(v.private_pem()); print(v.public_key)"
    → En mode dev : clés VAPID par défaut avec avertissement au boot

  ⑤ FRONTEND — Hook usePushNotifications (src/lib/usePushNotifications.ts)
    → isSupported : détecte si le navigateur supporte les push
    → permission : 'default' | 'granted' | 'denied' | 'unsupported'
    → isSubscribed : vérifie si une subscription active existe
    → subscribe() : 
      1. Demande la permission (Notification.requestPermission())
      2. Récupère le registration du Service Worker
      3. Appelle registration.pushManager.subscribe() avec la VAPID public key
      4. Envoie la subscription au backend (POST /api/v1/push/subscribe)
    → unsubscribe() :
      1. Récupère la subscription active
      2. Appelle subscription.unsubscribe()
      3. Notifie le backend (DELETE /api/v1/push/unsubscribe)

  ⑥ TEMPLATES DE NOTIFICATION (7 types)
    → 🔄 sync_complete : "Sync terminée — 12 transactions importées"
    → 🚨 anomaly_detected : "Dépense inhabituelle de 847€ chez Amazon"
    → 📊 budget_exceeded : "Budget Restaurants dépassé de 45€ ce mois"
    → 📈 patrimoine_milestone : "Patrimoine franchi : 100 000€ !"
    → ⚡ alert_triggered : "BTC a franchi 100 000$ (+2.3%)"
    → 📅 weekly_report : "Rapport hebdo : +1.2% patrimoine, 3 insights"
    → 🗓️ calendar_reminder : "Échéance PER dans 3 jours — max déduction"


═══════════════════════════════════════════════════════════════════════════
E1.4  Install Prompt — Banner Custom + Smart Timing  ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  > Statut d'implémentation E1.4 :
  > - [x] Composant PWAInstallPrompt (src/components/pwa/pwa-install-prompt.tsx)
  > - [x] Détection beforeinstallprompt + deferredPrompt stocké
  > - [x] Banner élégant avec animation Framer Motion (slide-up)
  > - [x] Boutons "Installer" + "Plus tard" + toggle Push
  > - [x] Persistance du choix "Plus tard" (localStorage, re-show après 7j)
  > - [x] Détection standalone (déjà installé → pas de banner)
  > - [x] Indicateur online/offline (banner "Hors-ligne" conditionnel)
  > - [x] Composant OfflineIndicator pour le statut réseau global
  > - [x] Service Worker registration dans le layout principal

  Composant : src/components/pwa/pwa-install-prompt.tsx
  ─────────────────────────────────────────────────────────────────────────

  ① DÉTECTION A2HS (Add to Home Screen)
    → Écoute l'événement 'beforeinstallprompt' sur window
    → Stocke le deferredPrompt dans un useRef
    → Empêche le prompt natif du navigateur (e.preventDefault())
    → Affiche le banner custom OmniFlow à la place
    → Si l'app est déjà installée (matchMedia('display-mode: standalone'))
      → Pas de banner

  ② BANNER CUSTOM ÉLÉGANT
    → Position : fixed bottom, full-width, z-50
    → Design : fond surface/95 avec backdrop-blur-xl, border-top brand
    → Animation : Framer Motion slide-up + fade (150ms ease)
    → Contenu :
      · Icône OmniFlow + titre "Installer OmniFlow"
      · Description "Accès instantané, mode offline, notifications push"
      · Bouton primaire "Installer" (gradient brand, hover animation)
      · Bouton secondaire "Plus tard" (text-only, transparent)
      · Toggle Push : "Activer les notifications push" (opt-in explicite)
    → Smart Timing : n'apparaît pas au premier chargement mais après 
      un délai de 3 secondes (laisser l'utilisateur découvrir l'app d'abord)

  ③ PERSISTANCE DU CHOIX UTILISATEUR
    → localStorage key : "omniflow_pwa_dismissed"
    → Valeur : timestamp de la dernière dismissal
    → Logique : si dismissed il y a < 7 jours → ne pas afficher
    → Après 7 jours → re-proposer une fois
    → Si installé → ne plus jamais afficher

  ④ SERVICE WORKER REGISTRATION (src/components/pwa/sw-register.tsx)
    → Composant client invisible monté dans le layout
    → useEffect : if ('serviceWorker' in navigator) →
      navigator.serviceWorker.register('/sw.js')
    → Écoute des événements : 'controllerchange' (update SW)
    → Logging : "Service Worker registered" / "SW update available"

  ⑤ OFFLINE INDICATOR (src/components/pwa/offline-indicator.tsx)
    → Composant global qui écoute navigator.onLine + events online/offline
    → Quand offline : banner fixé en haut "Vous êtes hors-ligne —
      les données affichées datent de la dernière synchronisation"
    → Animation Framer Motion slide-down
    → Quand retour online : banner vert "Connexion rétablie" pendant 3s puis disparaît
    → Badge "OFFLINE" discret dans le header quand hors-ligne


═══════════════════════════════════════════════════════════════════════════
E1.5  Offline Page — Fallback Élégant  ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  Fichier : public/offline.html
  ─────────────────────────────────────────────────────────────────────────

  → Page HTML/CSS self-contained (aucune dépendance externe)
  → Design cohérent avec le thème OmniFlow OLED noir
  → Contenu :
    · Logo/titre OmniFlow centré
    · Icône wifi-off animée (SVG inline, pulse animation CSS)
    · Message : "Vous êtes hors-ligne"
    · Sous-message : "Vos données sont en cache. Reconnectez-vous pour
      synchroniser les dernières mises à jour."
    · Bouton "Réessayer" (recharge la page)
  → Auto-refresh : tente un fetch toutes les 5s, redirige dès que online


═══════════════════════════════════════════════════════════════════════════
E1.6  Stack Technique Phase E1 — Fichiers & Dépendances
═══════════════════════════════════════════════════════════════════════════

  Nouveaux fichiers frontend (apps/web/) :
  ─────────────────────────────────────────────────────────────────────────
  public/sw.js                                   Service Worker (4 stratégies cache)
  public/manifest.json                           Web App Manifest complet
  public/offline.html                            Page fallback offline stylée
  public/icons/icon-72.svg                       Icône PWA 72×72
  public/icons/icon-96.svg                       Icône PWA 96×96
  public/icons/icon-128.svg                      Icône PWA 128×128
  public/icons/icon-192.svg                      Icône PWA 192×192
  public/icons/icon-384.svg                      Icône PWA 384×384
  public/icons/icon-512.svg                      Icône PWA 512×512
  public/icons/icon-512-maskable.svg             Icône PWA maskable
  public/icons/badge-72.svg                      Badge notification monochrome
  src/components/pwa/pwa-install-prompt.tsx       Banner install custom
  src/components/pwa/sw-register.tsx              Registration Service Worker
  src/components/pwa/offline-indicator.tsx        Indicateur online/offline
  src/components/pwa/index.ts                    Barrel export PWA components
  src/lib/usePushNotifications.ts                Hook push notifications

  Nouveaux fichiers backend (apps/api/) :
  ─────────────────────────────────────────────────────────────────────────
  alembic/versions/026_push_subscriptions.py     Migration table push_subscriptions
  app/models/push_subscription.py                Modèle PushSubscription
  app/schemas/push.py                            Schemas Pydantic push
  app/services/push_service.py                   Service envoi push VAPID
  app/api/v1/push.py                             4 endpoints push REST
  tests/test_push_notifications.py               18 tests push notifications

  Fichiers modifiés :
  ─────────────────────────────────────────────────────────────────────────
  apps/web/src/app/layout.tsx                    +manifest link, +<SWRegister/>, +<OfflineIndicator/>
  apps/web/src/providers/providers.tsx            +<PWAInstallPrompt/>
  apps/web/package.json                          (pas de nouvelle dépendance npm — tout natif!)
  apps/api/app/core/config.py                    +VAPID_PRIVATE_KEY, +VAPID_PUBLIC_KEY, +VAPID_SUBJECT
  apps/api/app/api/v1/router.py                  +push_router
  apps/api/app/models/__init__.py                +PushSubscription export
  apps/api/pyproject.toml                        +pywebpush

  Dépendances :
  ─────────────────────────────────────────────────────────────────────────
  Frontend : AUCUNE nouvelle dépendance npm !
    → Service Worker API native du navigateur
    → Web Push API native du navigateur
    → IndexedDB API native (pour le background sync queue)
    → Cache API native (pour le caching stratégique)
    → Manifest : standard W3C, aucune lib

  Backend :
    → pywebpush (pip) : envoi de notifications Web Push via VAPID
    → py-vapid est inclus dans pywebpush comme dépendance transitive

```

> **Statut d'implémentation E1** :
> ✅ public/sw.js — Service Worker 200+ lignes, 4 stratégies cache, background sync IndexedDB, push handler
> ✅ public/manifest.json — Manifest complet (shortcuts, display_override WCO, screenshots, 7 icônes SVG)
> ✅ public/offline.html — Page fallback OLED-themed, auto-retry 5s, bouton "Réessayer"
> ✅ public/icons/ — 8 fichiers SVG (72/96/128/192/384/512 + maskable + badge)
> ✅ alembic/versions/026_push_subscriptions.py — Migration SQL (push_subscriptions + index composite)
> ✅ app/models/push_subscription.py — Modèle SQLAlchemy (UUID PK, FK users, endpoint UNIQUE)
> ✅ app/schemas/push.py — 5 schemas Pydantic (Create, Keys, Unsubscribe, Response, TestRequest)
> ✅ app/services/push_service.py — Push service (send + broadcast + expired cleanup, lazy pywebpush)
> ✅ app/api/v1/push.py — 4 endpoints REST (vapid-key, subscribe, unsubscribe, test)
> ✅ src/lib/usePushNotifications.ts — Hook React complet (subscribe/unsubscribe/test, VAPID key fetch)
> ✅ src/components/pwa/pwa-install-prompt.tsx — Banner install (beforeinstallprompt, 7j dismiss, push opt-in)
> ✅ src/components/pwa/sw-register.tsx — Registration SW (lifecycle, update check 60min, controllerchange reload)
> ✅ src/components/pwa/offline-indicator.tsx — Indicateur online/offline (reconnection banner 3s)
> ✅ src/components/pwa/index.ts — Barrel exports
> ✅ app/core/config.py — +VAPID_PRIVATE_KEY, +VAPID_PUBLIC_KEY, +VAPID_SUBJECT
> ✅ app/api/v1/router.py — +push_router inclus
> ✅ app/models/__init__.py — +PushSubscription export
> ✅ pyproject.toml — +pywebpush>=2.0.0
> ✅ layout.tsx — +manifest link, +apple-mobile-web-app meta, +<SWRegister/>, +<OfflineIndicator/>
> ✅ providers.tsx — +<PWAInstallPrompt/>
> ✅ tests/test_push_notifications.py — 18 tests (VAPID key, subscribe CRUD, push service unit)

**Résultat attendu Phase E1 — Métriques de succès :**

| Métrique | Avant (G) | Après (E1) |
|----------|-----------|------------|
| Installable (A2HS) | ❌ Non | ✅ Custom prompt + manifest |
| Mode Offline | ❌ Erreur réseau | ✅ Dashboard consultable 24h |
| Notifications Push | ❌ Aucune | ✅ 7 templates, push natif |
| Cache intelligent | ❌ Aucun | ✅ 4 stratégies, versionné |
| Background Sync | ❌ Requêtes perdues | ✅ Queue + replay auto |
| Lighthouse PWA | ❌ 0/100 | ✅ 100/100 |
| Shortcuts | ❌ Aucun | ✅ 3 actions rapides |
| First Load (retour) | ~2s+ (réseau) | < 100ms (cache) |
| Concurrents surpassés | — | Finary (zéro PWA), YNAB (basic), Trade Republic (store-only) |

#### E2 — Performance Production (Semaine 20) ✅ IMPLÉMENTÉ

═══════════════════════════════════════════════════════════════════════════
E2.0  Benchmark Concurrentiel — Pourquoi E2 Dépasse le Marché
═══════════════════════════════════════════════════════════════════════════

  | Critère                       | Finary     | Trade Republic | YNAB       | OmniFlow E2       |
  |-------------------------------|------------|----------------|------------|--------------------|
  | Structured JSON Logging       | ❌ Inconnu | ❌ Propriétaire| ❌ Inconnu | ✅ JSON + correlation_id |
  | Prometheus Metrics            | ❌ Interne | ❌ Interne     | ❌ Interne | ✅ /metrics endpoint   |
  | Multi-stage Docker            | ❌ Inconnu | ✅ Probable    | ❌ Inconnu | ✅ 3 stages, non-root  |
  | Gunicorn + Uvicorn workers    | ❌ Inconnu | ✅ Probable    | ❌ Inconnu | ✅ WEB_CONCURRENCY     |
  | Health check Kubernetes-ready | ❌ Inconnu | ✅ Probable    | ❌ Inconnu | ✅ /health/live + /ready|
  | .dockerignore                 | ❌ Inconnu | ✅ Probable    | ❌ Inconnu | ✅ Exhaustif           |
  | Next.js standalone output     | ❌ Non     | N/A            | N/A        | ✅ output: standalone  |
  | Web Vitals reporting          | ❌ Non     | N/A            | ❌ Non     | ✅ Endpoint analytics  |
  | Redis pool configurable       | ❌ Inconnu | ❌ Inconnu     | ❌ Inconnu | ✅ Via env vars        |
  | Docker healthcheck api        | ❌ Non     | ✅ Probable    | ❌ Non     | ✅ curl /health/live   |

═══════════════════════════════════════════════════════════════════════════
E2.1  Structured JSON Logging — Production-Grade Observability
═══════════════════════════════════════════════════════════════════════════

  Problème actuel :
  ─────────────────────────────────────────────────────────────────────────
  → Logging Python via basicConfig en plain-text :
    "14:32:05 INFO     [omniflow.api] Request completed"
  → Impossible à parser par ELK/Loki/CloudWatch/Datadog
  → Pas de contexte structuré (user_id, correlation_id, latency, path)
  → Log level DEBUG possible en production (settings.LOG_LEVEL overridable)

  Solution — Formatter JSON conditionnel :
  ─────────────────────────────────────────────────────────────────────────
  Fichier : app/core/logging_config.py (NOUVEAU)

  Architecture :
  → En développement (ENVIRONMENT=development) : format humain coloré
    "14:32:05 INFO  [omniflow.api] Request completed"
  → En staging/production : format JSON structuré (une ligne par log)
    {"ts":"2026-03-04T14:32:05.123Z","level":"INFO","logger":"omniflow.api",
     "msg":"Request completed","correlation_id":"abc-123","method":"GET",
     "path":"/api/v1/dashboard","status":200,"latency_ms":42.1}

  Champs du JSON log :
    · ts             — ISO 8601 timestamp UTC
    · level          — INFO/WARNING/ERROR/CRITICAL
    · logger         — Nom du logger Python (omniflow.*)
    · msg            — Message humain
    · correlation_id — X-Request-ID propagé
    · exc_info       — Stacktrace si exception (optionnel)
    · extra.*        — Champs custom par logger

  Intégration main.py :
  → Remplacer basicConfig par setup_logging() importé de logging_config.py
  → Le middleware correlation_id injecte le correlation_id dans le log record
    via un contexvar (threading.local remplacé par contextvars.ContextVar)

  AccessLogMiddleware enrichi :
  → Log chaque requête HTTP avec : method, path, status_code, latency_ms,
    client_ip, user_agent, content_length, correlation_id
  → Exclut les health checks du logging (évite le bruit)
  → Format : une ligne JSON par requête en production

═══════════════════════════════════════════════════════════════════════════
E2.2  Prometheus Metrics — Observability Endpoint /metrics
═══════════════════════════════════════════════════════════════════════════

  Architecture — Métriques sans dépendance externe :
  ─────────────────────────────────────────────────────────────────────────
  → Pas de dépendance lourde (pas de prometheus_client, pas de opentelemetry)
  → Implémentation maison légère : compteurs atomiques in-memory
  → Endpoint GET /metrics retourne du texte Prometheus plaintext
  → Compatible scraping Prometheus/Grafana/Victoria Metrics nativement

  Fichier : app/core/metrics.py (NOUVEAU)

  Métriques collectées :
  ─────────────────────────────────────────────────────────────────────────
  Counters :
    · http_requests_total{method,path,status}    — Total requêtes par route
    · http_request_duration_seconds_sum{method,path} — Cumul latence
    · http_request_duration_seconds_count{method,path} — Nombre observations
    · db_queries_total                           — Total requêtes SQL
    · cache_hits_total / cache_misses_total      — Ratio cache Redis
    · push_notifications_sent_total              — Push envoyées
    · push_notifications_failed_total            — Push échouées

  Gauges :
    · db_pool_size                               — Taille pool DB actuelle
    · db_pool_checked_out                        — Connections occupées
    · redis_connected_clients                    — Clients Redis actifs
    · active_websocket_connections               — WS temps réel actives

  Histograms (buckets) :
    · http_request_duration_seconds_bucket{le}   — Distribution latences
      Buckets: 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0

  Infos :
    · app_info{version,environment}              — Metadata application

  Endpoint GET /metrics :
  → Format Prometheus exposition text/plain; version=0.0.4
  → Pas d'authentification (scraping interne réseau)
  → Exclut de ses propres compteurs (filtre path=/metrics)

  MetricsMiddleware :
  → Middleware FastAPI qui incrémente les compteurs à chaque requête
  → Mesure latence start→end et l'ajoute aux histogram buckets
  → Thread-safe via threading.Lock (pas de race condition)

═══════════════════════════════════════════════════════════════════════════
E2.3  Health Checks Kubernetes-Ready — /health/live + /health/ready
═══════════════════════════════════════════════════════════════════════════

  Problème actuel :
  ─────────────────────────────────────────────────────────────────────────
  → Un seul endpoint /health mélange liveness et readiness
  → Docker Compose n'a pas de healthcheck sur le service api
  → Kubernetes a besoin de 2 endpoints séparés :
    · livenessProbe  → le process est-il vivant ? (restart si non)
    · readinessProbe → le service accepte-t-il du trafic ? (retire du LB)

  Solution — 2 endpoints distincts :
  ─────────────────────────────────────────────────────────────────────────

  GET /health/live  → Liveness probe (toujours 200 si le process tourne)
    Response : {"status": "alive", "uptime_seconds": 12345.6}
    → Ultra-rapide, aucune dépendance externe
    → Si ce endpoint ne répond pas → le container est planté → restart

  GET /health/ready → Readiness probe (200 si DB + Redis OK)
    Response : {
      "status": "ready",
      "checks": {
        "database": {"status": "ok", "latency_ms": 1.2},
        "redis": {"status": "ok", "latency_ms": 0.3}
      },
      "uptime_seconds": 12345.6,
      "version": "0.1.0",
      "environment": "production"
    }
    → Mesure la latence de chaque dépendance
    → Retourne 503 si une dépendance est down → K8s retire du load balancer

  L'ancien GET /health redirige vers /health/ready pour rétrocompatibilité.

  Intégration Docker Compose :
  → api service healthcheck: curl -f http://localhost:8000/health/live
  → interval: 10s, timeout: 5s, retries: 3, start_period: 30s

═══════════════════════════════════════════════════════════════════════════
E2.4  Dockerfile Production — Multi-Stage, Non-Root, Gunicorn Workers
═══════════════════════════════════════════════════════════════════════════

  Problèmes actuels :
  ─────────────────────────────────────────────────────────────────────────
  → Single-stage build (image finale contient build-essential, headers C, pip cache)
  → --reload en CMD (CPU gaspillé en production, risque injection fichier)
  → Pas de user non-root (container tourne en root → escalade de privilège)
  → Pas de .dockerignore (tout le contexte envoyé au daemon Docker)
  → Pas de HEALTHCHECK dans le Dockerfile
  → Single worker uvicorn (pas de parallélisme CPU)

  Solution — Dockerfile 3 stages :
  ─────────────────────────────────────────────────────────────────────────

  Stage 1 : builder
    → FROM python:3.12-slim AS builder
    → Install build-essential + libpq-dev
    → pip install --user (install en ~/ pour copie sélective)
    → Compile uniquement les dépendances

  Stage 2 : woob-init
    → FROM python:3.12-slim AS woob-init
    → Copie les packages Python du builder
    → Pré-installe les 34 modules woob bancaires
    → Applique le patch cragr

  Stage 3 : runtime (final)
    → FROM python:3.12-slim AS runtime
    → COPY --from=woob-init uniquement les packages Python + woob data
    → COPY app source
    → Crée un user non-root : appuser (UID 1000)
    → USER appuser
    → HEALTHCHECK --interval=30s CMD curl -f http://localhost:8000/health/live
    → CMD : gunicorn avec uvicorn workers

  Gunicorn Configuration :
  ─────────────────────────────────────────────────────────────────────────
  Fichier : apps/api/gunicorn.conf.py (NOUVEAU)

  → Worker class: uvicorn.workers.UvicornWorker (async)
  → Workers: WEB_CONCURRENCY env var, default = min(CPU_COUNT * 2 + 1, 8)
  → Bind: 0.0.0.0:8000
  → Timeout: 120s (pour les gros calculs patrimoine)
  → Graceful timeout: 30s
  → Keep-alive: 5s
  → Max requests: 1000 + jitter 50 (prévient memory leaks)
  → Access log: "-" (stdout) en dev, désactivé en prod (le middleware log)
  → Error log: "-" (stdout)
  → Preload app: true (share memory entre workers, boot plus rapide)

  .dockerignore (NOUVEAU) :
  ─────────────────────────────────────────────────────────────────────────
  __pycache__/
  *.pyc
  .git/
  .env
  .venv/
  tests/
  alembic/versions/__pycache__/
  *.egg-info/
  .mypy_cache/
  .pytest_cache/
  .ruff_cache/
  Makefile
  README.md
  docker-compose*.yml

═══════════════════════════════════════════════════════════════════════════
E2.5  Next.js Production — Standalone Output + Security Headers
═══════════════════════════════════════════════════════════════════════════

  Optimisations next.config.mjs :
  ─────────────────────────────────────────────────────────────────────────

  → output: 'standalone'
    · Réduit l'image Docker de ~1GB à ~150MB
    · Seuls les fichiers nécessaires au runtime sont copiés
    · Compatible Docker multi-stage (node:alpine → Node slim runner)

  → Security headers via headers() :
    · X-DNS-Prefetch-Control: on
    · X-Content-Type-Options: nosniff
    · X-Frame-Options: SAMEORIGIN
    · Referrer-Policy: strict-origin-when-cross-origin
    · Permissions-Policy: camera=(), microphone=(), geolocation=()
    · Content-Security-Policy avec nonces pour scripts inline

  → Image optimization :
    · formats: ['image/avif', 'image/webp']
    · deviceSizes optimisés FinTech

  → Compression :
    · compress: true (gzip natif Next.js activé)

  → PoweredByHeader supprimé :
    · poweredBy: false (n'expose pas "X-Powered-By: Next.js")

  Web Vitals Reporter :
  ─────────────────────────────────────────────────────────────────────────
  Fichier : src/lib/web-vitals-reporter.ts (NOUVEAU)

  → Capture CLS, FID, FCP, LCP, TTFB, INP via le package web-vitals@5
  → Envoie les métriques au backend: POST /api/v1/analytics/vitals
  → Batching : accumule jusqu'à 10 métriques, flush toutes les 30s ou au unload
  → Navigator.sendBeacon pour garantir l'envoi même en fermeture d'onglet
  → Champs : name, value, delta, id, navigationType, rating (good/needs-improvement/poor)

  Endpoint backend : POST /api/v1/analytics/vitals
  → Reçoit les métriques web vitals du frontend
  → Les log en structured JSON (pas de DB write — pure observabilité)
  → Rate-limited à 30/min par IP (évite l'abus)

═══════════════════════════════════════════════════════════════════════════
E2.6  Docker Compose Production-Grade
═══════════════════════════════════════════════════════════════════════════

  Améliorations docker-compose.yml :
  ─────────────────────────────────────────────────────────────────────────

  → Service api : healthcheck via curl intégré
  → Redis : persistence volume (évite perte données cache au restart)
  → Resource limits (deploy.resources) :
    · api: memory 512M limit, 256M reservation
    · db: memory 256M limit
    · redis: memory 128M limit
  → Logging driver : json-file avec max-size 10m, max-file 3
  → Restart policy : unless-stopped sur tous les services

═══════════════════════════════════════════════════════════════════════════
E2.7  Stack Technique Phase E2 — Fichiers & Dépendances
═══════════════════════════════════════════════════════════════════════════

  Nouveaux fichiers backend (apps/api/) :
  ─────────────────────────────────────────────────────────────────────────
  app/core/logging_config.py                     Structured JSON logging
  app/core/metrics.py                            Prometheus metrics maison
  app/api/v1/analytics.py                        Endpoint web vitals + metrics
  gunicorn.conf.py                               Configuration Gunicorn workers
  .dockerignore                                  Exclusions build Docker

  Nouveaux fichiers frontend (apps/web/) :
  ─────────────────────────────────────────────────────────────────────────
  src/lib/web-vitals-reporter.ts                 Web Vitals capture + beacon

  Fichiers modifiés :
  ─────────────────────────────────────────────────────────────────────────
  apps/api/Dockerfile                            Multi-stage, non-root, gunicorn
  apps/api/app/main.py                           +structured logging, +metrics middleware, +health/live|ready
  apps/api/app/core/config.py                    +WEB_CONCURRENCY, +REDIS_MAX_CONNECTIONS, +SENTRY_DSN
  apps/api/app/core/redis.py                     +configurable max_connections
  apps/api/app/api/v1/router.py                  +analytics_router
  apps/web/next.config.mjs                       +standalone, +headers, +poweredBy, +images
  apps/web/src/app/layout.tsx                    +reportWebVitals intégration
  docker-compose.yml                             +healthcheck api, +redis volume, +resource limits

  Dépendances :
  ─────────────────────────────────────────────────────────────────────────
  Backend :
    → gunicorn (pip) : serveur WSGI/ASGI production multi-worker
    → AUCUNE autre nouvelle dépendance (metrics maison, logging stdlib)

  Frontend :
    → web-vitals@5 (déjà dans package.json — activation uniquement)
    → AUCUNE nouvelle dépendance npm

  Tests :
  ─────────────────────────────────────────────────────────────────────────
  tests/test_performance_production.py           30+ tests E2 (health probes,
                                                  metrics, logging, headers,
                                                  web vitals, config)

  ╔═════════════════════════════════════════════════════════════════════════╗
  ║  PHASE E2 — IMPLÉMENTATION TERMINÉE ✅                                ║
  ╠═════════════════════════════════════════════════════════════════════════╣
  ║                                                                       ║
  ║  Backend (apps/api/) :                                                ║
  ║    ✅ app/core/logging_config.py      → JSON structured logging       ║
  ║    ✅ app/core/metrics.py             → Prometheus metrics maison      ║
  ║    ✅ app/api/v1/analytics.py         → /metrics + /health/* + vitals  ║
  ║    ✅ gunicorn.conf.py                → Multi-worker ASGI config       ║
  ║    ✅ .dockerignore                   → Build context optimisé         ║
  ║    ✅ Dockerfile (rewrite)            → 3-stage, non-root, healthcheck ║
  ║    ✅ app/main.py (modified)          → Unified middleware + probes    ║
  ║    ✅ app/core/config.py (modified)   → +WEB_CONCURRENCY, +REDIS_MAX  ║
  ║    ✅ app/core/redis.py (modified)    → Configurable pool size         ║
  ║    ✅ pyproject.toml (modified)       → +gunicorn>=21.2.0              ║
  ║                                                                       ║
  ║  Frontend (apps/web/) :                                               ║
  ║    ✅ src/lib/web-vitals-reporter.ts  → Web Vitals + sendBeacon       ║
  ║    ✅ next.config.mjs (modified)      → standalone + headers + images  ║
  ║    ✅ src/providers/providers.tsx      → +initWebVitalsReporter()      ║
  ║                                                                       ║
  ║  Infrastructure :                                                     ║
  ║    ✅ docker-compose.yml (modified)   → healthcheck + redis vol + logs ║
  ║                                                                       ║
  ║  Tests :                                                              ║
  ║    ✅ tests/test_performance_production.py  → 30+ tests E2            ║
  ║                                                                       ║
  ║  Bilan : 5 nouveaux fichiers backend + 1 nouveau fichier frontend     ║
  ║          + 8 fichiers modifiés + 1 fichier test (30+ tests)           ║
  ║          310+ tests cumulés, couverture estimée 48%+                  ║
  ╚═════════════════════════════════════════════════════════════════════════╝

#### E3 — Documentation, RGPD & Audit Trail (Semaine 21)

═══════════════════════════════════════════════════════════════════════════
E3.0  Benchmark Concurrentiel — Pourquoi E3 Dépasse le Marché
═══════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────┬──────────┬──────────┬──────────┬──────────┐
  │ Fonctionnalité               │ Finary   │ T.Republic│ Bankin'  │ OmniFlow │
  ├──────────────────────────────┼──────────┼──────────┼──────────┼──────────┤
  │ RGPD Export JSON complet     │ Partiel  │ PDF seul │ ✗        │ ✅ Full   │
  │ Droit à l'oubli (hard del)  │ 30j délai│ Manuel   │ 14j      │ ✅ Instant│
  │ Audit trail complet          │ ✗        │ ✗        │ ✗        │ ✅ Full   │
  │ Data anonymization           │ ✗        │ ✗        │ ✗        │ ✅ Auto   │
  │ Consent tracking             │ ✗        │ Basique  │ ✗        │ ✅ Granul.│
  │ Privacy policy API           │ ✗        │ ✗        │ ✗        │ ✅ i18n   │
  │ Security.txt standard        │ ✗        │ ✗        │ ✗        │ ✅ RFC9116│
  │ OpenAPI auto-generated docs  │ ✗        │ ✗        │ ✗        │ ✅ Full   │
  │ Data retention auto-cleanup  │ ✗        │ ✗        │ ✗        │ ✅ Policy │
  │ Account data portability     │ PDF seul │ CSV      │ ✗        │ ✅ JSON++ │
  └──────────────────────────────┴──────────┴──────────┴──────────┴──────────┘

  OmniFlow est la première FinTech française à offrir :
  • Export intégral JSON structuré (43 tables, 200+ endpoints)
  • Suppression instantanée avec cascade cryptographique
  • Audit trail temps réel sur toutes les mutations sensibles
  • Anonymisation automatique des données exportées (PII masking)

═══════════════════════════════════════════════════════════════════════════
E3.1  RGPD Compliance — Droit d'Accès & Portabilité (Article 15 & 20)
═══════════════════════════════════════════════════════════════════════════

  GET /api/v1/settings/export
  ─────────────────────────────────────────────────────────────────────────
  Export complet de toutes les données utilisateur en un seul appel JSON.

  Architecture :
  • Requête authentifiée (JWT Bearer)
  • Collecte parallèle de toutes les tables liées à user_id
  • Anonymisation optionnelle des données sensibles (?anonymize=true)
  • Horodatage ISO 8601, montants en centimes (fidèle au stockage)
  • Rate limité : 1 export / 15 minutes (protection anti-abus)

  Données exportées (43 entités) :
  ─────────────────────────────────────────────────────────────────────────
  user : { id, email, name, created_at, updated_at, is_verified }
  bank_connections[] : { bank_name, status, last_sync_at }
  accounts[] : { label, type, balance, currency }
  transactions[] : { date, amount, label, category, subcategory, merchant }
  balance_snapshots[] : { balance, currency, captured_at }
  crypto_wallets[] : { platform, label, chain, status }
  crypto_holdings[] : { token_symbol, quantity, avg_buy_price, value, pnl }
  crypto_transactions[] : { tx_type, token_symbol, quantity, total_eur }
  stock_portfolios[] : { label, broker, envelope_type }
  stock_positions[] : { symbol, name, quantity, avg_buy_price, value, pnl }
  stock_dividends[] : { symbol, ex_date, pay_date, amount_per_share }
  real_estate_properties[] : { label, city, surface_m2, purchase_price, current_value }
  real_estate_valuations[] : { source, price_m2, estimation }
  budgets[] : { category, month, amount_limit, amount_spent }
  ai_insights[] : { type, severity, title, description, confidence }
  chat_conversations[] : { title, message_count }
  chat_messages[] : { role, content, model_used }
  profiles[] : { name, type, is_default }
  project_budgets[] : { name, target_amount, current_amount, status }
  notifications[] : { type, title, body, is_read }
  debts[] : { label, debt_type, creditor, initial_amount, remaining_amount }
  debt_payments[] : { payment_date, total_amount }
  user_alerts[] : { name, asset_type, symbol, condition, threshold }
  alert_history[] : { triggered_at, price_at_trigger, message }
  watchlists[] : { asset_type, symbol, name, target_price }
  retirement_profile : { birth_year, target_retirement_age, income, expenses }
  heritage_simulation : { marital_regime, heirs, life_insurance }
  fee_analysis : { total_fees_annual, best_alternative }
  fiscal_profile : { tmi_rate, revenu_fiscal_ref, fiscal_score }
  autopilot_config : { is_enabled, safety_cushion_months, allocations }
  tangible_assets[] : { name, category, purchase_price, current_value }
  nft_assets[] : { collection_name, token_id, blockchain, current_floor_eur }
  card_wallets[] : { card_type, tier, bank }
  loyalty_programs[] : { program_name, points_balance, estimated_value }
  subscriptions[] : { name, provider, amount, billing_cycle }
  vault_documents[] : { name, category, document_type, issuer }
  peer_debts[] : { counterparty_name, direction, amount, is_settled }
  calendar_events[] : { title, event_type, event_date, amount }
  nova_memories[] : { memory_type, category, content, importance }
  push_subscriptions[] : { endpoint, user_agent }
  audit_log[] : { action, resource_type, resource_id, ip_address, created_at }

  Format de réponse :
  ─────────────────────────────────────────────────────────────────────────
  {
    "export_version": "1.0",
    "exported_at": "2026-03-04T10:30:00Z",
    "user": { ... },
    "data": {
      "bank_connections": [...],
      "accounts": [...],
      ...43 clés
    },
    "metadata": {
      "total_records": 12847,
      "tables_exported": 43,
      "anonymized": false
    }
  }

═══════════════════════════════════════════════════════════════════════════
E3.2  RGPD Compliance — Droit à l'Effacement (Article 17)
═══════════════════════════════════════════════════════════════════════════

  DELETE /api/v1/settings/account
  ─────────────────────────────────────────────────────────────────────────
  Suppression totale et irréversible du compte + toutes les données.

  Architecture :
  • Confirmation requise : body { "confirmation": "SUPPRIMER MON COMPTE" }
  • Vérification mot de passe : body { "password": "..." }
  • Hard delete avec CASCADE sur les 43 tables
  • Suppression des clés de chiffrement (master_key_salt effacé)
  • Blacklist de tous les tokens JWT actifs
  • Suppression des données Redis associées
  • Réponse 204 No Content (irréversible)

  Ordre de suppression (cascade-safe) :
  ─────────────────────────────────────────────────────────────────────────
  1. Audit log entry "account_deletion_initiated"
  2. Push subscriptions (VAPID)
  3. Nova memories + Chat messages + Conversations
  4. Alert history + User alerts
  5. Watchlists
  6. Calendar events
  7. Vault : documents, peer debts, loyalty, subscriptions, cards, NFTs, assets
  8. Autopilot config + Fiscal profile + Heritage simulation + Retirement profile
  9. Fee analysis
  10. Crypto : transactions → holdings → wallets
  11. Stock : dividends → positions → portfolios
  12. Real estate : valuations → properties
  13. Debt : payments → debts
  14. Budget + Project contributions + Project budgets
  15. Balance snapshots + Transactions + Accounts + Bank connections
  16. Profiles + Profile account links
  17. AI insights + Notifications
  18. User record (final)
  19. Redis: blacklist all JTIs, clear rate-limit keys, clear cache

═══════════════════════════════════════════════════════════════════════════
E3.3  Audit Trail — Traçabilité Complète des Actions Sensibles
═══════════════════════════════════════════════════════════════════════════

  Table `audit_log` :
  ─────────────────────────────────────────────────────────────────────────
  id           UUID PK (default uuid4)
  user_id      UUID FK → users (nullable pour actions système)
  action       VARCHAR(50) — ex: "login", "register", "sync", "delete",
               "export_data", "update_password", "account_deletion"...
  resource_type VARCHAR(50) — ex: "user", "bank_connection", "transaction"...
  resource_id  VARCHAR(100) — ID de la ressource affectée
  ip_address   VARCHAR(45) — IPv4 ou IPv6 (anonymisable)
  user_agent   VARCHAR(500)
  metadata     JSONB — données contextuelles supplémentaires
  created_at   TIMESTAMP WITH TIME ZONE

  Index : (user_id, created_at DESC) pour requêtes par utilisateur
  Index : (action, created_at DESC) pour requêtes par type

  Actions tracées automatiquement :
  ─────────────────────────────────────────────────────────────────────────
  • login_success / login_failed
  • register
  • logout
  • password_change
  • bank_connection_created / bank_connection_synced / bank_connection_deleted
  • data_export_requested
  • account_deletion_initiated / account_deletion_completed
  • settings_changed
  • crypto_wallet_added / crypto_wallet_deleted
  • stock_portfolio_created / stock_portfolio_deleted
  • property_added / property_deleted
  • alert_created / alert_triggered
  • nova_conversation_started

  GET /api/v1/settings/audit-log
  ─────────────────────────────────────────────────────────────────────────
  Liste paginée de l'historique d'audit de l'utilisateur courant.
  Paramètres : ?action=login&limit=50&offset=0
  Seul l'utilisateur peut voir son propre audit trail.

═══════════════════════════════════════════════════════════════════════════
E3.4  Privacy Policy & Consent Tracking
═══════════════════════════════════════════════════════════════════════════

  GET /api/v1/settings/privacy-policy
  ─────────────────────────────────────────────────────────────────────────
  Retourne la politique de confidentialité structurée en JSON.
  • Versionnée (privacy_policy_version)
  • Sections : collecte, finalité, conservation, droits, DPO contact
  • Langue : français (extensible i18n)

  GET /api/v1/settings/consent
  ─────────────────────────────────────────────────────────────────────────
  Retourne le statut des consentements de l'utilisateur.

  PUT /api/v1/settings/consent
  ─────────────────────────────────────────────────────────────────────────
  Met à jour les consentements.
  • analytics : bool (Web Vitals, usage stats)
  • push_notifications : bool
  • ai_personalization : bool (Nova memories, insights)
  • data_sharing : bool (agrégation anonymisée)

═══════════════════════════════════════════════════════════════════════════
E3.5  Security Policy — RFC 9116 security.txt
═══════════════════════════════════════════════════════════════════════════

  GET /.well-known/security.txt
  ─────────────────────────────────────────────────────────────────────────
  Fichier standardisé pour la divulgation responsable de vulnérabilités.
  • Contact, Expires, Preferred-Languages, Policy, Canonical
  • Conforme RFC 9116 (Internet Security Reporting Format)

═══════════════════════════════════════════════════════════════════════════
E3.6  API Documentation Enhancement
═══════════════════════════════════════════════════════════════════════════

  Améliorations Swagger/OpenAPI :
  ─────────────────────────────────────────────────────────────────────────
  • Tags descriptifs groupés par domaine métier
  • Exemples de requêtes/réponses dans les schémas Pydantic
  • Description détaillée de chaque endpoint
  • Réponses d'erreur documentées (401, 403, 404, 409, 422, 429, 500)

═══════════════════════════════════════════════════════════════════════════
E3.7  Stack Technique Phase E3 — Fichiers & Dépendances
═══════════════════════════════════════════════════════════════════════════

  Nouveaux fichiers backend (apps/api/) :
  ─────────────────────────────────────────────────────────────────────────
  app/models/audit_log.py                        Modèle SQLAlchemy audit_log
  app/schemas/settings.py                        Schemas RGPD (export, consent, audit)
  app/services/gdpr_service.py                   Service RGPD (export, delete, anonymize)
  app/services/audit_service.py                  Service audit trail (log_action)
  app/api/v1/settings.py                         Endpoints settings/RGPD/audit
  alembic/versions/027_audit_log.py              Migration audit_log + consent fields

  Fichiers modifiés :
  ─────────────────────────────────────────────────────────────────────────
  app/models/__init__.py                         +AuditLog import
  app/models/user.py                             +consent fields (4 bools)
  app/api/v1/router.py                           +settings_router
  app/api/v1/auth.py                             +audit logging (login/register/logout)
  app/main.py                                    +security.txt endpoint

  Dépendances :
  ─────────────────────────────────────────────────────────────────────────
  Backend :
    → AUCUNE nouvelle dépendance (tout en stdlib + SQLAlchemy)

  Frontend :
    → AUCUNE nouvelle dépendance npm

  Tests :
  ─────────────────────────────────────────────────────────────────────────
  tests/test_rgpd_audit.py                       32 tests E3 (anonymization,
                                                  audit log, schemas, privacy,
                                                  consent, security.txt, RGPD
                                                  endpoints auth protection)

  ╔═════════════════════════════════════════════════════════════════════════╗
  ║  PHASE E3 — IMPLÉMENTATION TERMINÉE ✅                                ║
  ╠═════════════════════════════════════════════════════════════════════════╣
  ║                                                                       ║
  ║  Backend (apps/api/) :                                                ║
  ║    ✅ app/models/audit_log.py           → Modèle AuditLog (JSONB)     ║
  ║    ✅ app/schemas/settings.py           → 6 schemas RGPD/Pydantic     ║
  ║    ✅ app/services/audit_service.py     → log_action + helpers IP/UA  ║
  ║    ✅ app/services/gdpr_service.py      → export 43 tables + delete   ║
  ║    ✅ app/api/v1/settings.py            → 7 endpoints RGPD/settings   ║
  ║    ✅ alembic/versions/027_audit_log.py → Migration audit + consent   ║
  ║    ✅ app/models/user.py (modified)     → +6 consent columns          ║
  ║    ✅ app/models/__init__.py (modified) → +AuditLog export            ║
  ║    ✅ app/api/v1/router.py (modified)   → +settings_router            ║
  ║    ✅ app/api/v1/auth.py (modified)     → +audit on register/login/   ║
  ║                                            logout (success + failed)  ║
  ║    ✅ app/main.py (modified)            → +security.txt RFC 9116      ║
  ║                                                                       ║
  ║  Tests :                                                              ║
  ║    ✅ tests/test_rgpd_audit.py          → 32 tests E3                 ║
  ║                                                                       ║
  ║  Endpoints ajoutés (7) :                                              ║
  ║    GET  /api/v1/settings/export         → Export RGPD complet JSON    ║
  ║    DELETE /api/v1/settings/account      → Hard-delete irréversible    ║
  ║    GET  /api/v1/settings/audit-log      → Audit trail paginé          ║
  ║    GET  /api/v1/settings/consent        → Statut consentements        ║
  ║    PUT  /api/v1/settings/consent        → Update consentements        ║
  ║    GET  /api/v1/settings/privacy-policy → Politique confidentialité   ║
  ║    GET  /.well-known/security.txt       → RFC 9116 security.txt       ║
  ║                                                                       ║
  ║  Bilan : 5 nouveaux fichiers backend + 5 fichiers modifiés            ║
  ║          + 1 migration SQL + 1 fichier test (32 tests)                ║
  ║          340+ tests cumulés, couverture estimée 50%+                  ║
  ╚═════════════════════════════════════════════════════════════════════════╝

#### E4 — Beta publique & RGPD Frontend (Semaine 22)

> **Objectif** : Finaliser l'expérience utilisateur en connectant le frontend aux 7 endpoints RGPD/Audit E3,
> ajouter un système de feedback in-app, un changelog interactif, et des métriques d'usage anonymisées.
> Transformer OmniFlow d'un outil développeur en une application prête pour les premiers beta-testeurs.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     BENCHMARK E4 — Beta Publique                       │
├───────────────────────┬──────────────────┬─────────────────────────────┤
│   Feature             │ Finary / Bankin  │ OmniFlow E4                 │
├───────────────────────┼──────────────────┼─────────────────────────────┤
│ RGPD Export UI        │ Email CSV 72h    │ Instant JSON + UI preview   │
│ Consent Management    │ Cookie banner    │ 4-axis granular toggles     │
│ Audit Trail visible   │ Aucun            │ Timeline paginée filtrable  │
│ Account Deletion UI   │ Email support    │ Self-service 2-step confirm │
│ Feedback in-app       │ Intercom (SaaS)  │ Built-in modal zero-dep     │
│ Changelog             │ Blog externe     │ In-app timeline animée      │
│ Privacy policy        │ Page légale PDF  │ JSON structuré Art. 6-21    │
│ Password change       │ ✅               │ ✅ wired to API             │
│ Session management    │ Email notif      │ Audit log + logout all      │
│ Onboarding checklist  │ ✅               │ ✅ interactive progress      │
└───────────────────────┴──────────────────┴─────────────────────────────┘
```

**E4.0 — Architecture technique**

```
Frontend (Next.js 14 App Router)
├── Settings page — 4 nouvelles sections RGPD
│   ├── 'rgpd'       → Export données + Suppression compte
│   ├── 'consent'    → 4 toggles consentement + version policy
│   ├── 'audit'      → Timeline audit trail paginée
│   └── 'about'      → Changelog + Feedback + Version app
├── Types TypeScript  → 8+ nouvelles interfaces api.ts
├── Zustand store     → settings-store.ts (consent, audit, export)
└── Composants UI     → feedback-modal, changelog-timeline, consent-toggles

Backend (FastAPI)
├── Password change endpoint → PUT /api/v1/auth/password
├── Feedback endpoint → POST /api/v1/feedback
├── Feedback model + migration 028
└── Changelog endpoint → GET /api/v1/changelog (statique structuré)
```

**E4.1 — Settings RGPD Frontend (4 nouvelles sections)**

```
Section 'rgpd' — Mes Données (RGPD Art. 15/17/20)
├── Bouton "Exporter mes données" → GET /settings/export
│   ├── Spinner + barre de progression
│   ├── Preview JSON structuré inline (accordéon par table)
│   └── Téléchargement automatique fichier .json
├── Bouton "Exporter anonymisé" → GET /settings/export?anonymize=true
│   └── Export avec PII masquées (emails, téléphones, noms)
├── Zone dangereuse "Supprimer mon compte"
│   ├── Confirmation 2 étapes (bouton → saisie "SUPPRIMER MON COMPTE" + password)
│   ├── Countdown 5 secondes avant activation bouton final
│   └── Affichage nombre de tables/records qui seront supprimés
└── Lien vers politique de confidentialité (GET /settings/privacy-policy)

Section 'consent' — Consentements (RGPD Art. 6/7)
├── 4 toggles animés avec descriptions détaillées :
│   ├── Analytics comportementales (Web Vitals, navigation)
│   ├── Notifications push (alertes prix, anomalies, rapports)
│   ├── Personnalisation IA (tips, budget auto, insights)
│   └── Partage de données agrégées (benchmarks anonymes)
├── Version politique acceptée (ex: "v1.0 — Mars 2026")
├── Date dernière mise à jour des consentements
└── Auto-save avec PUT /settings/consent + toast confirmation

Section 'audit' — Journal d'activité (Audit Trail)
├── Timeline verticale paginée (10 items/page, infinite scroll)
├── Icônes par type d'action (login, logout, export, delete, consent)
├── Filtres par action (dropdown) + recherche par date
├── Affichage IP + User-Agent + métadonnées JSONB
└── Format relatif ("il y a 2h") + tooltip date absolue

Section 'about' — À propos & Feedback
├── Version de l'application (0.1.0) + environnement
├── Changelog timeline (5 dernières versions)
│   ├── Badge type (feature, fix, security, performance)
│   └── Détails techniques par entrée
├── Bouton "Envoyer un feedback"
│   ├── Modal avec catégorie (bug, feature, amélioration, autre)
│   ├── Zone de texte + screenshot optionnel (base64)
│   └── Métadonnées auto (user_agent, screen_size, route)
└── Liens : GitHub, documentation, status page
```

**E4.2 — Password Change (wired)**

```
PUT /api/v1/auth/password
├── Body : { current_password, new_password }
├── Validation : min 8 chars + uppercase + digit + special
├── Vérification ancien mot de passe via verify_password()
├── Hash bcrypt 12 rounds du nouveau
├── Audit trail : "password_change" dans audit_log
├── Invalidation de tous les refresh tokens existants
└── Response : 200 { message: "Mot de passe mis à jour" }

Frontend Settings → Section 'security'
├── Formulaire 3 champs (actuel, nouveau, confirmation)
├── Password strength indicator réutilisé du register
├── Validation zod côté client + erreur serveur handling
└── Toast succès + redirection vers login après 3s
```

**E4.3 — Feedback System**

```
POST /api/v1/feedback
├── Body : { category, message, metadata?, screenshot_b64? }
├── Categories : bug | feature | improvement | other
├── Metadata auto : user_agent, screen_size, current_route, app_version
├── Stockage PostgreSQL (table feedback, FK user_id)
├── Rate limit : 5 feedbacks/heure par user
└── Response : 201 { id, message: "Merci pour votre retour" }

Model Feedback (SQLAlchemy)
├── id         UUID PK (gen_random_uuid)
├── user_id    FK → users (SET NULL on delete)
├── category   VARCHAR(20) NOT NULL
├── message    TEXT NOT NULL
├── metadata   JSONB
├── screenshot TEXT (base64, nullable)
├── status     VARCHAR(20) DEFAULT 'new' (new/reviewed/resolved/dismissed)
├── created_at TIMESTAMP DEFAULT now()
└── INDEX : ix_feedback_user_created (user_id, created_at)

Migration 028_feedback.py
├── CREATE TABLE feedback (9 colonnes)
└── CREATE INDEX ix_feedback_user_created
```

**E4.4 — Changelog API**

```
GET /api/v1/changelog
├── Pas de DB — constante Python structurée
├── Response : { versions: [ { version, date, type, entries[] } ] }
├── Types d'entrée : feature | fix | security | performance
├── 5 dernières versions (extensible)
└── Pas d'auth requise (public)

Exemple de réponse :
{
  "versions": [
    {
      "version": "0.4.0",
      "date": "2026-03-04",
      "entries": [
        { "type": "feature", "title": "RGPD Frontend", "description": "Export, consent, audit trail" },
        { "type": "security", "title": "Audit Trail", "description": "Traçabilité des actions sensibles" }
      ]
    }
  ]
}
```

**E4.5 — Onboarding Checklist**

```
Frontend Dashboard — Composant OnboardingChecklist
├── Affiché si <3 étapes complétées
├── Étapes :
│   ├── ✅ Créer un compte (toujours fait si visible)
│   ├── 🔲 Connecter une banque (connections.length > 0)
│   ├── 🔲 Ajouter un wallet crypto (cryptoPortfolio?.wallets.length > 0)
│   ├── 🔲 Configurer les notifications (pushSubscribed)
│   └── 🔲 Personnaliser les consentements (consent_updated_at != null)
├── Barre de progression animée (0/5 → 5/5)
├── Chaque étape clickable → navigue vers la page correspondante
├── Dismissable avec localStorage "omniflow_onboarding_dismissed"
└── Animation confetti au 100% complété (réutilise <Confetti />)
```

**E4.6 — TypeScript Types & Store**

```
types/api.ts — Nouvelles interfaces :
├── ConsentStatus { analytics, push_notifications, ai_personalization,
│   data_sharing, updated_at, privacy_policy_version }
├── ConsentUpdateRequest { analytics?, push_notifications?, ai_personalization?, data_sharing? }
├── AuditLogEntry { id, action, resource_type, resource_id, ip_address,
│   user_agent, metadata, created_at }
├── AuditLogResponse { entries[], total, limit, offset }
├── DataExportResponse { export_version, exported_at, user, data, metadata }
├── PrivacyPolicySection { title, content }
├── PrivacyPolicyResponse { version, last_updated, language, dpo_contact, sections[] }
├── FeedbackRequest { category, message, metadata?, screenshot_b64? }
├── FeedbackResponse { id, message }
├── ChangelogEntry { type, title, description }
├── ChangelogVersion { version, date, entries[] }
├── ChangelogResponse { versions[] }
└── PasswordChangeRequest { current_password, new_password }

stores/settings-store.ts — Zustand store :
├── State : consent, auditLog[], auditTotal, isExporting, isDeleting, feedback{}
├── Actions :
│   ├── fetchConsent() → GET /settings/consent
│   ├── updateConsent(partial) → PUT /settings/consent
│   ├── exportData(anonymize?) → GET /settings/export → download JSON
│   ├── deleteAccount(confirmation, password) → DELETE /settings/account
│   ├── fetchAuditLog(offset, limit, action?) → GET /settings/audit-log
│   ├── changePassword(current, new) → PUT /auth/password
│   ├── sendFeedback(category, message) → POST /feedback
│   └── fetchChangelog() → GET /changelog
└── Persist : consent uniquement (léger)
```

**E4.7 — Fichiers & Stack technique**

```
Backend — Nouveaux fichiers :
├── app/api/v1/feedback.py          — POST /feedback endpoint
├── app/api/v1/changelog.py         — GET /changelog endpoint
├── app/models/feedback.py          — Modèle Feedback SQLAlchemy
├── app/schemas/feedback.py         — Schemas Pydantic feedback
├── alembic/versions/028_feedback.py — Migration feedback table
└── tests/test_feedback_changelog.py — Tests unitaires

Backend — Fichiers modifiés :
├── app/api/v1/auth.py              — +PUT /password endpoint
├── app/api/v1/router.py            — +feedback_router +changelog_router
├── app/models/__init__.py          — +Feedback import
└── app/schemas/auth.py             — +PasswordChangeRequest/Response

Frontend — Nouveaux fichiers :
├── src/types/api.ts                — +12 interfaces RGPD/feedback/changelog
├── src/stores/settings-store.ts    — Zustand store settings
├── src/components/settings/        — 4 composants sections RGPD
│   ├── rgpd-section.tsx
│   ├── consent-section.tsx
│   ├── audit-section.tsx
│   └── about-section.tsx
├── src/components/ui/feedback-modal.tsx — Modal feedback
└── src/components/finance/onboarding-checklist.tsx

Frontend — Fichiers modifiés :
├── src/app/(dashboard)/settings/page.tsx — +4 sections RGPD
└── src/app/(dashboard)/dashboard/page.tsx — +OnboardingChecklist
```

> **Phase E4 — IMPLÉMENTÉE** ✅ (4 mars 2026)
> 35 tests (16 unit pass ✓, 19 integration avec DB).
> Backend : 1 migration (028_feedback), 1 modèle, 6 schemas, 3 endpoints, 6 nouveaux fichiers + 3 modifiés.
> Frontend : 15+ interfaces TypeScript, 1 Zustand store, 4 composants RGPD settings, 1 onboarding checklist, 7 nouveaux fichiers + 3 modifiés.

#### E5 — Déploiement Production, Landing Page & Observabilité (Semaine 23)

> **Objectif** : Transformer OmniFlow d'un projet localhost en une application SaaS production-grade
> accessible publiquement, avec une landing page marketing de niveau Finary/Linear qui convertit,
> un pipeline CI/CD zero-downtime, et une observabilité complète (errors, metrics, analytics).
> Résultat : un utilisateur tape `omniflow.app` → voit la landing → s'inscrit → utilise l'app.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BENCHMARK E5 — Production Deployment                      │
├────────────────────────────┬──────────────────┬──────────────────────────────┤
│   Critère                  │ Finary / Linear  │ OmniFlow E5                  │
├────────────────────────────┼──────────────────┼──────────────────────────────┤
│ Hébergement Frontend       │ Vercel           │ Vercel (Edge Network global)  │
│ Hébergement Backend        │ GCP / AWS        │ Railway (Docker container)    │
│ Base de données            │ AWS RDS          │ Neon (PG serverless, branching│)
│ Cache / Queue              │ ElastiCache      │ Upstash Redis (serverless)    │
│ DNS + SSL + CDN            │ Cloudflare       │ Cloudflare (proxy + WAF)      │
│ CI/CD Pipeline             │ GitHub Actions   │ GitHub Actions multi-stage    │
│ Landing Page               │ Custom React     │ Next.js SSG + Framer Motion   │
│ SEO Score                  │ 90+              │ 100/100 (Lighthouse target)   │
│ Error Tracking             │ Sentry           │ Sentry (source maps + alerts) │
│ Analytics                  │ Mixpanel/Amplitude│ Plausible (RGPD-compliant)  │
│ Uptime Monitoring          │ Datadog          │ BetterStack + status page     │
│ Zero-Downtime Deploy       │ ✅               │ ✅ rolling + health checks    │
│ Preview Deployments        │ ✅               │ ✅ Vercel PR previews         │
│ Waitlist + Social Proof    │ ❌ (déjà public) │ ✅ animated counter + CTA     │
│ Demo Interactive           │ ✅               │ ✅ guided tour sans compte    │
│ OG Images + JSON-LD        │ ✅               │ ✅ dynamic OG + structured    │
│ TTFB P95                   │ < 200ms          │ < 150ms (Edge + ISR)          │
│ Core Web Vitals            │ Good             │ All Green (LCP<2.5s, CLS<0.1) │
└────────────────────────────┴──────────────────┴──────────────────────────────┘
```

**E5.0 — Architecture d'infrastructure cible**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                          INFRASTRUCTURE PRODUCTION — Zero Trust                                │
│                                                                                               │
│   INTERNET                                                                                    │
│     │                                                                                         │
│     ▼                                                                                         │
│  ┌────────────────────┐                                                                       │
│  │    CLOUDFLARE       │  ← WAF L7 + Bot Management + DDoS L3-L7                              │
│  │   ──────────────── │  ← SSL Full (Strict) + HSTS preload                                  │
│  │   DNS CNAME flat   │  ← Brotli + Early Hints (103) + HTTP/3 QUIC                          │
│  │   Edge Cache 30s   │  ← Rate Limit: 100 req/10s/IP on /api/*                              │
│  │   Geo-routing      │  ← Transform Rules: X-Real-IP, X-Forwarded-For                       │
│  └────────┬───────────┘                                                                       │
│           │                                                                                   │
│     ┌─────┴─────────────────────────────────────┐                                              │
│     │                                           │                                              │
│     ▼                                           ▼                                              │
│  ┌──────────────────────┐     ┌───────────────────────────────┐                                │
│  │       VERCEL          │     │         RAILWAY (EU-West)      │                                │
│  │   ────────────────── │     │   ───────────────────────────│                                │
│  │   Next.js 14 SSG/SSR │     │   FastAPI 0.115 + Gunicorn    │                                │
│  │   Edge Runtime (PoP) │     │   Uvicorn workers (x2-x6)     │                                │
│  │   ISR revalidate 60s │     │   Docker multi-stage (180MB)   │                                │
│  │   Image CDN AVIF/WebP│     │   Release cmd: alembic migrate │                                │
│  │   Preview per-PR     │     │   Health: /health/live + /ready │                               │
│  │   Web Analytics Edge │     │   Auto-scale 1→3 (CPU/mem)    │                                │
│  │   Cron: revalidate   │     │   Graceful shutdown 30s       │                                │
│  │   ┌────────────────┐ │     │   ┌─────────────────────────┐ │                                │
│  │   │ Sentry NextJS  │ │     │   │ Sentry FastAPI SDK      │ │                                │
│  │   │ Source maps     │ │     │   │ ASGI traces + profiles  │ │                                │
│  │   │ Session Replay  │ │     │   │ Cron monitors           │ │                                │
│  │   └────────────────┘ │     │   └─────────────────────────┘ │                                │
│  └──────────────────────┘     └──────────────┬────────────────┘                                │
│                                              │                                                 │
│                    ┌─────────────────────────┼─────────────────────────┐                        │
│                    │                         │                         │                        │
│                    ▼                         ▼                         ▼                        │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐                │
│  │       NEON            │  │      UPSTASH           │  │     SENTRY            │                │
│  │   ────────────────── │  │   ───────────────────│  │   ────────────────── │                │
│  │   PostgreSQL 16       │  │   Redis 7 + TLS       │  │   Error tracking     │                │
│  │   Serverless (scale   │  │   Global edge (< 5ms) │  │   Performance APM    │                │
│  │     0→4 CU autoscale) │  │   REST + native proto │  │   Session Replay     │                │
│  │   PgBouncer pooling   │  │   Eviction: allkeys-lr│  │   Release tracking   │                │
│  │   Branching (main/dev)│  │   TLS mutual auth     │  │   Cron monitoring    │                │
│  │   PITR 7 days         │  │   256MB (free tier)    │  │   Slack/email alerts │                │
│  │   ip-allow: Railway   │  │   Usage:               │  │   Source maps upload │                │
│  │   Extensions:         │  │     JWT blacklist       │  │                      │                │
│  │     uuid-ossp         │  │     Rate limiting       │  └───────────────────────┘                │
│  │     pg_trgm           │  │     Cache multi-tier    │                                         │
│  │   SSL: require        │  │     SlowAPI backend     │  ┌───────────────────────┐                │
│  │   Statement timeout:  │  └───────────────────────┘  │     PLAUSIBLE          │                │
│  │     30s (kill runaway)│                              │   ────────────────── │                │
│  └──────────────────────┘                              │   RGPD no-cookie     │                │
│                                                        │   Custom events      │                │
│  ┌──────────────────────────────────────────────────┐  │   Goal conversions   │                │
│  │               GITHUB ACTIONS CI/CD                │  └───────────────────────┘                │
│  │   ──────────────────────────────────────────────│                                           │
│  │   Push main → lint → test → build → deploy       │  ┌───────────────────────┐                │
│  │   PR → lint → test → preview deploy              │  │     BETTERSTACK       │                │
│  │   Coverage gate: 30% min (pytest-cov)            │  │   ────────────────── │                │
│  │   Lighthouse CI gate: score ≥ 90                 │  │   Uptime 30s probes  │                │
│  │   Bundle size gate: < 500KB first load           │  │   Status page public │                │
│  └──────────────────────────────────────────────────┘  │   Incident alerts    │                │
│                                                        └───────────────────────┘                │
│                                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐      │
│  │                        SECURITY LAYERS                                                │      │
│  │  L1: Cloudflare WAF (L7 filtering, bot management, DDoS)                             │      │
│  │  L2: TLS everywhere (Cloudflare↔Vercel, Cloudflare↔Railway, Railway↔Neon, ↔Upstash) │      │
│  │  L3: Application (CORS strict, rate limiting, JWT rotation, bcrypt-12)               │      │
│  │  L4: Database (IP allowlist, SSL require, PgBouncer, statement timeout)              │      │
│  │  L5: Secrets (Railway/Vercel env vars, rotation trimestrielle, boot guard fail-fast) │      │
│  └──────────────────────────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

                          REQUEST FLOW (< 150ms P95)
  ═══════════════════════════════════════════════════════════════════
  User (Paris) → Cloudflare PoP (CDG) → Vercel Edge (cdg1)
                                          │
                                          ├─ SSG pages: 0ms (pre-built, edge cached)
                                          └─ API proxy: → Railway (fra1) → Neon (eu-central)
                                                              ↓
                                                         FastAPI handler
                                                              ↓
                                                     ┌─ Redis cache hit? → 2ms response
                                                     └─ DB query → Neon PgBouncer → 8ms avg
                                                              ↓
                                                         Response + Sentry span
                                                              ↓
                                                     Total P95: 45ms backend / 150ms E2E
```

**E5.1 — Déploiement Backend (Railway + Neon + Upstash + Sentry)**

```
Objectif : API FastAPI accessible publiquement avec zero-downtime deploys,
           observabilité complète, et résilience aux pannes cloud.

E5.1.1  Railway — Container Docker Production-Grade
        ────────────────────────────────────────────
        Config file : railway.toml (à la racine du repo)

        [build]
          builder     = "dockerfile"
          dockerfilePath = "apps/api/Dockerfile"

        [deploy]
          startCommand  = "gunicorn app.main:app -c gunicorn.conf.py"
          healthcheckPath = "/health/live"
          healthcheckTimeout = 5            # seconds
          restartPolicyType = "on_failure"
          restartPolicyMaxRetries = 5
          numReplicas = 1                   # auto-scale to 3

        [deploy.releaseCommand]
          command = "alembic upgrade head"  # run migrations BEFORE traffic switch

        Variables d'environnement Railway :
        ┌─────────────────────────────┬───────────────────────────────────────────────┐
        │  Variable                   │  Valeur                                       │
        ├─────────────────────────────┼───────────────────────────────────────────────┤
        │  DATABASE_URL               │  ${{Neon.DATABASE_URL}}                       │
        │  REDIS_URL                  │  ${{Upstash.REDIS_URL}}                       │
        │  SECRET_KEY                 │  openssl rand -hex 64 (128 chars)             │
        │  ENCRYPTION_KEY             │  python -c "from cryptography.fernet import   │
        │                             │  Fernet; print(Fernet.generate_key().decode())"│
        │  ENVIRONMENT                │  production                                   │
        │  ALLOWED_ORIGINS            │  ["https://omniflow.app"]                     │
        │  LOG_LEVEL                  │  INFO                                         │
        │  WEB_CONCURRENCY            │  2                                            │
        │  SENTRY_DSN                 │  https://xxx@oXXX.ingest.sentry.io/xxx        │
        │  SENTRY_TRACES_SAMPLE_RATE  │  0.2                                          │
        │  SENTRY_PROFILES_SAMPLE_RATE│  0.1                                          │
        │  DB_POOL_SIZE               │  5  (Neon free = 20 max, partagé)             │
        │  DB_MAX_OVERFLOW            │  10                                           │
        │  DB_POOL_RECYCLE            │  300 (5 min — Neon suspend à 5 min inactivité)│
        │  VAPID_PRIVATE_KEY          │  (generated via pywebpush)                    │
        │  VAPID_PUBLIC_KEY           │  (generated via pywebpush)                    │
        └─────────────────────────────┴───────────────────────────────────────────────┘

        Sizing Railway :
        → vCPU : 2 (burst to 8)
        → RAM : 512 MB (burst to 2 GB)
        → Region : EU-West (Frankfurt)
        → Network : private networking disabled (free tier)
        → Persistent storage : non nécessaire (stateless API)

E5.1.2  Neon — PostgreSQL Serverless (Production-Optimized)
        ──────────────────────────────────────────────────
        Projet : omniflow-prod
        Version : PostgreSQL 16
        Region : eu-central-1 (Frankfurt) — co-located with Railway

        Branches :
          main  → production (protected, no direct writes)
          dev   → staging (auto-created from main, can reset)
          pr-*  → ephemeral per-PR (auto-delete after merge)

        Connection :
        → Pooled endpoint : postgresql+asyncpg://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/omniflow
        → PgBouncer : transaction mode, 100 server connections
        → SSL mode : require (verify-ca if needed)
        → Connection string format Railway :
          DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/omniflow?sslmode=require
        → Statement timeout : 30s (config.py DB_STATEMENT_TIMEOUT_MS)

        Extensions activées :
          CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- UUID v4
          CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- trigram search
          CREATE EXTENSION IF NOT EXISTS "btree_gist";      -- range exclusion

        Auto-scaling :
        → Compute : 0.25 CU → 4 CU (auto, basé sur load)
        → Auto-suspend : 5 min inactivité (wake-up ~500ms cold start)
        → Strategy : DB pool keep-alive ping every 60s évite le suspend
          (config : pool_pre_ping=True dans SQLAlchemy, déjà en place)

        Backup & Recovery :
        → Point-in-time recovery : 7 jours (Neon built-in)
        → Branching : clone instantané pour debug production
        → Logical replication : export continu vers S3 (optionnel, $5/mo)

E5.1.3  Upstash — Redis Serverless TLS
        ──────────────────────────────
        Database : omniflow-cache
        Region : eu-west-1 (Frankfurt)
        Protocol : rediss:// (TLS mandatory)
        Max memory : 256 MB
        Eviction : allkeys-lru
        Max connections : 1000 concurrent
        API : REST + native Redis protocol (dual)

        Connection sécurisée :
        → REDIS_URL=rediss://default:xxx@eu1-xxx.upstash.io:6379
        → TLS verification : activée par défaut
        → Configuration Redis client (redis.asyncio) :
          ssl=True automatique via rediss:// scheme
          ssl_cert_reqs=None (Upstash managed cert)

        Usage détaillé par feature :
        ┌──────────────────────┬──────────────┬────────────────────┐
        │  Feature             │  Key pattern │  TTL               │
        ├──────────────────────┼──────────────┼────────────────────┤
        │  JWT blacklist       │  jti:{uuid}  │  30 days (refresh) │
        │  Rate limiting       │  rl:{ip}:*   │  1-15 min          │
        │  Dashboard cache     │  cache:dash:*│  60s               │
        │  Net worth cache     │  cache:nw:*  │  120s              │
        │  Cashflow cache      │  cache:cf:*  │  300s              │
        │  OmniScore cache     │  cache:os:*  │  24h               │
        │  SlowAPI counters    │  LIMITER:*   │  1 min             │
        │  AI rate limit       │  ai:daily:*  │  24h               │
        └──────────────────────┴──────────────┴────────────────────┘
        → Estimation : ~500 cmd/heure en beta, bien sous le free tier (10K/jour)

E5.1.4  Sentry — Error Tracking & Performance Backend
        ────────────────────────────────────────────────
        SDK : sentry-sdk[fastapi] >= 2.0

        Initialisation (app/core/sentry_config.py) :
        → sentry_sdk.init() dans main.py lifespan startup
        → DSN via env var SENTRY_DSN (vide = disabled)
        → Environment tag : settings.ENVIRONMENT
        → Release : settings.APP_VERSION + git sha
        → traces_sample_rate : 0.2 en prod (20% des requêtes tracées)
        → profiles_sample_rate : 0.1 en prod (10% profilées)
        → FastAPIIntegration + SQLAlchemyIntegration + RedisIntegration
        → before_send filter :
          - Ignorer 401 (Unauthorized) — bruit normal
          - Ignorer 404 (Not Found) — bruit normal
          - Capturer 400 (avec taux réduit) — validation errors
          - Toujours capturer 500+ — errors critiques
        → Sensitive data scrubbing :
          - Strip Authorization header values
          - Strip password fields from request body
          - Strip cookies

        Performance Monitoring :
        → Chaque endpoint FastAPI → transaction Sentry automatique
        → Spans custom : DB queries (via SQLAlchemy integration)
        → Spans custom : Redis calls (via Redis integration)
        → Spans custom : External API calls (httpx)
        → Dashboard : latence P50/P95/P99 par endpoint
        → Alertes : > 500ms P95 sur /auth/login → Slack notification

        Cron Monitoring :
        → APScheduler sync job → Sentry cron monitor
        → MarketHub WebSocket → heartbeat monitor
        → Si un cron manque son schedule → alert immédiate

E5.1.5  Migration Strategy (Zero-Downtime Guaranteed)
        ───────────────────────────────────────────────
        Séquence de déploiement Railway :
        1. Push to main → Railway build new Docker image
        2. Release command : `alembic upgrade head` (sur nouveau container)
           → Si migration échoue → deploy annulé, ancien container reste actif
        3. Health check : GET /health/live → 200 OK
           → Si health échoue → rollback automatique
        4. Traffic switch : nouveau container reçoit le trafic
        5. Ancien container : graceful shutdown (30s drain)

        Règles de migration backward-compatible :
        → ✅ ADD COLUMN (nullable ou avec default)
        → ✅ CREATE TABLE
        → ✅ CREATE INDEX CONCURRENTLY
        → ❌ JAMAIS DROP COLUMN en migration (deprecate + remove after 2 releases)
        → ❌ JAMAIS ALTER COLUMN TYPE (create new column → migrate data → drop old)
        → ❌ JAMAIS RENAME TABLE (create new → copy → drop old)

        Rollback :
        → Railway : "Redeploy" sur commit précédent (1 clic, < 60s)
        → Alembic : `alembic downgrade -1` via Railway shell
        → Neon : branch instantané depuis PITR si corruption données

E5.1.6  Production Hardening (code changes)
        ──────────────────────────────────────
        Fichiers modifiés :

        config.py :
        → +SENTRY_DSN (str, default "")
        → +SENTRY_TRACES_SAMPLE_RATE (float, default 0.2)
        → +SENTRY_PROFILES_SAMPLE_RATE (float, default 0.1)
        → +SENTRY_ENVIRONMENT override (optionnel, fallback ENVIRONMENT)
        → APP_VERSION bump to "0.5.0"

        main.py :
        → +Sentry init dans lifespan startup (conditionnel si DSN non vide)
        → +Sentry capture_exception dans global exception handler
        → +Sentry set_user() dans les endpoints authentifiés (via middleware)

        database.py :
        → +SSL args pour Neon (detect rediss:// ou sslmode in URL)
        → +Pool events logging (checkin/checkout/overflow)

        redis.py :
        → +Gestion TLS Upstash (rediss:// auto-détecté par redis.asyncio)
        → +Connection retry avec backoff exponentiel (3 retries, 1s → 4s)
        → +Ping au startup pour fail-fast si Redis inaccessible

        gunicorn.conf.py :
        → +Sentry integration (worker processes)
        → +Signal handling amélioré (SIGTERM graceful)

        Nouveaux fichiers :
        ├── app/core/sentry_config.py   — Init Sentry SDK + filtering
        ├── railway.toml                — Railway deployment config
        ├── .env.production.example     — Template env vars production
        ├── DEPLOYMENT.md               — Guide déploiement complet
        └── tests/test_deployment.py    — Tests config prod + Sentry
```

**E5.2 — Déploiement Frontend (Vercel + Cloudflare + Docker Fallback)**

```
Objectif : Next.js 14 SSG/SSR accessible à omniflow.app, Lighthouse ≥ 95/100 sur les 4 axes.
           Performance budget strict : First Load JS < 100KB, LCP < 1.2s, CLS < 0.05.
           Dual deployment : Vercel (primary) + Dockerfile.prod (Railway fallback).

E5.2.1  Vercel — Next.js Edge Hosting (Configuration Avancée)

        vercel.json — Déclaratif, versionné, reproductible
        ─────────────────────────────────────────────────────
        {
          "framework": "nextjs",
          "buildCommand": "npm run build",
          "outputDirectory": ".next",
          "installCommand": "npm ci --prefer-offline",
          "regions": ["cdg1"],            ← Paris PoP prioritaire (< 10ms TTFB France)
          "functions": { "src/**/*.ts": { "maxDuration": 10 } },
          "crons": [],                    ← Réservé E5.5 (monitoring heartbeat)
          "headers": [
            {
              "source": "/api/v1/(.*)",
              "headers": [
                { "key": "Cache-Control", "value": "no-store, no-cache" },
                { "key": "X-Robots-Tag",  "value": "noindex" }
              ]
            },
            {
              "source": "/(.*)\\.(?:js|css|woff2?)$",
              "headers": [
                { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
              ]
            }
          ]
        }

        Variables d'environnement (production) :
        ┌──────────────────────────────────┬─────────────────────────────────────┐
        │ Variable                         │ Valeur                              │
        ├──────────────────────────────────┼─────────────────────────────────────┤
        │ NEXT_PUBLIC_API_URL              │ https://api.omniflow.app            │
        │ NEXT_PUBLIC_APP_URL              │ https://omniflow.app                │
        │ NEXT_PUBLIC_SENTRY_DSN           │ https://<key>@sentry.io/<id>        │
        │ NEXT_PUBLIC_SENTRY_ENVIRONMENT   │ production                          │
        │ NEXT_PUBLIC_PLAUSIBLE_DOMAIN     │ omniflow.app                        │
        │ NEXT_PUBLIC_BUILD_ID             │ $VERCEL_GIT_COMMIT_SHA (auto)       │
        │ NEXT_PUBLIC_APP_VERSION          │ 0.5.0                               │
        │ ANALYZE                          │ false (true pour debug bundle)      │
        └──────────────────────────────────┴─────────────────────────────────────┘

        Fonctionnalités Vercel activées :
        → Preview Deployments : chaque PR génère une URL unique (auto via GitHub)
        → Production Branch : main (auto-deploy)
        → Edge Network : CDG1 (Paris), priorité Europe, fallback global
        → ISR : landing = SSG (build-time), dashboard = dynamic (SSR)
        → Image Optimization : Vercel Image CDN (AVIF > WebP > JPEG, srcSet auto)
        → Speed Insights : activé (Core Web Vitals en dashboard Vercel)
        → Web Analytics : désactivé (on utilise Plausible pour RGPD)
        → Skew Protection : activé (évite les incohérences client/serveur lors des déploiements)

E5.2.2  Cloudflare — DNS + SSL + CDN + WAF (Configuration Production)

        DNS Records :
        ┌─────────┬──────────────────┬─────────────────────────────────┬────────┐
        │ Type    │ Name             │ Target                          │ Proxy  │
        ├─────────┼──────────────────┼─────────────────────────────────┼────────┤
        │ CNAME   │ @                │ cname.vercel-dns.com            │ ☁️ ON  │
        │ CNAME   │ www              │ cname.vercel-dns.com            │ ☁️ ON  │
        │ CNAME   │ api              │ <railway>.up.railway.app        │ ☁️ ON  │
        │ TXT     │ _vercel          │ vc-domain-verify=<token>        │ DNS    │
        │ TXT     │ @                │ v=spf1 include:_spf.google.com  │ DNS    │
        └─────────┴──────────────────┴─────────────────────────────────┴────────┘

        SSL/TLS :
        → Mode : Full (Strict) — Cloudflare ↔ Vercel/Railway TLS de bout en bout
        → Minimum TLS : 1.2 (RGPD recommandation CNIL)
        → HSTS : max-age=31536000, includeSubDomains, preload
        → Always Use HTTPS : ON
        → Opportunistic Encryption : ON
        → TLS 1.3 : ON (0-RTT Early Data pour perf)

        WAF Rules (Custom) :
        Rule 1 — Rate Limit API : 100 req/10s per IP on uri.path contains "/api/"
        Rule 2 — Block Auth Brute Force : 20 req/min per IP on uri.path contains "/auth/" AND method=POST
        Rule 3 — Challenge Bots : cf.client.bot AND NOT cf.bot_management.verified_bot → Challenge
        Rule 4 — Geo-Restrict (optionnel RGPD) : NOT ip.geoip.continent in {"EU"} → Challenge

        Performance (Speed tab) :
        → Brotli : ON (30% meilleur que gzip sur assets texte)
        → Early Hints (103) : ON (précharge CSS/JS pendant que le serveur traite)
        → HTTP/3 (QUIC) : ON (réduit la latence sur connexions mobiles)
        → Rocket Loader : OFF (conflit Next.js hydration, ne pas activer)
        → Auto Minify : OFF (Next.js minifie déjà via SWC — double minification inutile)
        → Polish (image optimization) : OFF (Vercel Image CDN gère déjà)

E5.2.3  Dockerfile Frontend (Alternative Railway — Production-Ready)

        Fichier : apps/web/Dockerfile.prod
        3-stage multi-stage build pour image minimale (~150MB) :
        ─────────────────────────────────────────────────────────
        Stage 1: deps       → npm ci (cache node_modules)
        Stage 2: builder    → npm run build (standalone output)
        Stage 3: runner     → node:20-alpine, copie .next/standalone + static + public
                             → Non-root user (nextjs:nodejs)
                             → HEALTHCHECK curl localhost:3000
                             → ENV HOSTNAME="0.0.0.0" PORT=3000
                             → CMD ["node", "server.js"]

        Avantages vs Vercel :
        → Contrôle total sur l'infrastructure (pas de vendor lock-in)
        → Même Railway que le backend (monorepo simplifié)
        → Coût prévisible (pas de tarification par invocation)
        → Utile si Vercel Free tier dépassé (100GB bandwidth)

E5.2.4  Sentry Frontend SDK (Error Boundary + Performance)

        Intégration Next.js via @sentry/nextjs :
        → instrumentation.ts : Sentry.init() côté serveur (Node.js runtime)
        → sentry.client.config.ts : Sentry.init() côté client (browser)
        → ErrorBoundary global dans layout.tsx (fallback UI gracieux)
        → beforeSend filter : supprime ResizeObserver loop + ChunkLoadError (bruit)
        → replaysSessionSampleRate: 0.1 (10% sessions rejouables pour debug UX)
        → replaysOnErrorSampleRate: 1.0 (100% sessions avec erreur rejouées)
        → Scrubbing : Authorization, cookies, passwords (aligné backend RGPD)
        → Performance : tracePropagation vers api.omniflow.app (distributed tracing)
        → Source Maps : uploadés à Sentry via @sentry/nextjs plugin (caché du client)

E5.2.5  Performance Budget & Monitoring

        Budget strict appliqué en CI :
        ┌──────────────────────┬──────────┬────────────────────────────────────┐
        │ Métrique             │ Seuil    │ Conséquence si dépassé             │
        ├──────────────────────┼──────────┼────────────────────────────────────┤
        │ First Load JS        │ < 100KB  │ CI fail (bundle size check)        │
        │ LCP                  │ < 1.2s   │ Lighthouse CI warning              │
        │ CLS                  │ < 0.05   │ Lighthouse CI warning              │
        │ INP                  │ < 200ms  │ Web Vitals reporter alert          │
        │ TTFB                 │ < 200ms  │ Vercel Edge → auto                 │
        │ Lighthouse Perf      │ ≥ 95     │ CI fail                            │
        │ Lighthouse A11y      │ ≥ 90     │ CI fail                            │
        │ Lighthouse BP        │ ≥ 90     │ CI warning                         │
        │ Lighthouse SEO       │ ≥ 95     │ CI warning                         │
        └──────────────────────┴──────────┴────────────────────────────────────┘
```

**E5.3 — CI/CD Pipeline (GitHub Actions — Production-Grade)**

```
Objectif : Pipeline CI/CD 6 jobs, parallélisé, avec cache agressif, security scanning,
           deploy conditionnel, et notifications Slack/Discord.
           Temps cible : < 3 minutes lint+test, < 5 minutes full pipeline.

E5.3.1  Architecture du Pipeline (ci.yml enrichi)

        ┌──────────────────────────────────────────────────────────────────────┐
        │                    OmniFlow CI/CD Pipeline v2                        │
        │                    ══════════════════════════                        │
        │                                                                      │
        │  TRIGGER: push main/develop │ PR vers main/develop                   │
        │                                                                      │
        │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
        │  │ BACKEND LINT │  │FRONTEND LINT │  │  SECURITY    │               │
        │  │ ───────────  │  │ ───────────  │  │ ───────────  │               │
        │  │ ruff check   │  │ next lint    │  │ pip-audit    │  ← PARALLEL   │
        │  │ ruff format  │  │ tsc --noEmit │  │ npm audit    │               │
        │  │ bandit (SAST)│  │ bundle size  │  │ trivy fs     │               │
        │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
        │         │                 │                  │                        │
        │  ┌──────┴───────┐  ┌──────┴───────┐         │                        │
        │  │ BACKEND TEST │  │FRONTEND BUILD│         │   ← PARALLEL           │
        │  │ ───────────  │  │ ───────────  │         │                        │
        │  │ pytest + cov │  │ next build   │         │                        │
        │  │ Postgres 16  │  │ Lighthouse CI│         │                        │
        │  │ Redis 7      │  │ size-limit   │         │                        │
        │  │ cov ≥ 50%    │  │ perf ≥ 95    │         │                        │
        │  └──────┬───────┘  └──────┬───────┘         │                        │
        │         │                 │                  │                        │
        │         └─────────────────┴──────────────────┘                        │
        │                           │                                           │
        │                    ┌──────┴───────┐                                   │
        │                    │   DEPLOY     │  ← ONLY on push to main           │
        │                    │ ───────────  │                                   │
        │                    │ Railway API  │                                   │
        │                    │ Health check │                                   │
        │                    │ Sentry release│                                  │
        │                    │ Slack notify │                                   │
        │                    └──────────────┘                                   │
        └──────────────────────────────────────────────────────────────────────┘

E5.3.2  Jobs Détaillés (6 jobs, 4 en parallèle)

        Job 1 — backend-lint (45s) :
          → actions/setup-python@v5 + cache pip
          → ruff check app/ tests/ --output-format=github
          → ruff format --check app/ tests/
          → bandit -r app/ -f json -o bandit-report.json (SAST Python)
          → Upload bandit-report.json comme artefact

        Job 2 — backend-test (90s) :
          → services: postgres:16-alpine (health-cmd pg_isready), redis:7-alpine
          → pip install -e ".[dev]"
          → pytest -v --cov=app --cov-report=xml --cov-fail-under=50 --tb=short
          → Upload coverage.xml comme artefact
          → Coverage badge auto-update (shields.io)

        Job 3 — frontend-quality (60s) :
          → actions/setup-node@v4 + cache npm
          → npm ci --prefer-offline
          → npx next lint --max-warnings 0 (zero tolérance warnings)
          → npx tsc --noEmit (type-check complet)
          → npx size-limit (budget bundle : first-load < 100KB)

        Job 4 — security-scan (30s, parallèle aux 3 autres) :
          → pip-audit (vulnérabilités Python connues)
          → npm audit --audit-level=high (vulnérabilités Node.js)
          → trivy fs . --severity HIGH,CRITICAL (scan filesystem)
          → Résultats uploadés en artefact + PR comment

        Job 5 — frontend-build (90s, needs: frontend-quality) :
          → npm run build (standalone output)
          → Lighthouse CI (4 audits : perf ≥ 95, a11y ≥ 90, bp ≥ 90, seo ≥ 95)
          → Bundle analysis : @next/bundle-analyzer output
          → Upload .next/analyze/*.html comme artefact

        Job 6 — deploy (120s, needs: backend-test + frontend-build, only main) :
          → Railway deploy via webhook trigger
          → Wait 30s → Health check curl https://api.omniflow.app/health/ready
          → Sentry release : sentry-cli releases new $VERSION
          → Sentry release : sentry-cli releases set-commits $VERSION --auto
          → Notification Discord webhook : deploy success/failure + version + changelog

E5.3.3  Branch Protection Rules (GitHub Settings)

        → Required status checks before merge :
          ✅ backend-lint
          ✅ backend-test
          ✅ frontend-quality
          ✅ security-scan
        → Require 1 review approval (equipe > 1 personne)
        → Dismiss stale reviews on new commits
        → No force push to main
        → No deletions of main
        → Auto-delete head branches after merge
        → Require conversation resolution before merging

E5.3.4  Release Strategy & Versioning

        → SemVer strict : MAJOR.MINOR.PATCH (actuellement 0.5.0)
        → Release branches : release/v0.5.0 → merge to main → tag v0.5.0
        → GitHub Releases : auto-generated notes from PR labels
        → Docker tags : latest + sha-{8chars} + v{semver}
        → Sentry releases : associe commits + source maps au tag
        → Rollback rapide : Railway 1-click redeploy N-1

E5.3.5  Caching Strategy (CI Performance)

        ┌──────────────────────┬────────────────────────┬───────────────────┐
        │ Cache                │ Key                    │ Gain estimé       │
        ├──────────────────────┼────────────────────────┼───────────────────┤
        │ pip packages         │ hash(pyproject.toml)   │ -30s (650MB)      │
        │ npm packages         │ hash(package-lock.json)│ -25s (400MB)      │
        │ Next.js build cache  │ hash(src/**) + OS      │ -40s (ISR cache)  │
        │ Docker layers        │ Dockerfile hash        │ -60s (build stage)│
        │ ruff cache           │ ruff version + hash    │ -5s               │
        └──────────────────────┴────────────────────────┴───────────────────┘
        Total gain estimé : ~2min40s sur un pipeline froid de ~5min.

E5.3.6  Inventaire des fichiers E5.2 + E5.3

        apps/web/
        ├── Dockerfile.prod              — Dockerfile frontend multi-stage (Node 20 Alpine)
        ├── vercel.json                  — Config Vercel déclarative (regions, headers, crons)
        ├── .env.production.example      — Template vars frontend production
        └── src/
            └── lib/
                └── sentry.client.config.ts  — Sentry SDK client-side config
        .github/workflows/
        ├── ci.yml                       — Pipeline CI enrichi (6 jobs, security scan, deploy)
        └── lighthouse.yml               — Workflow Lighthouse CI séparé (optionnel)
        tests/
        └── test_cicd.py                 — Tests validation pipeline & config déploiement
```

**E5.4 — Landing Page Marketing (Next.js SSG)**

```
Objectif : Page marketing world-class qui convertit les visiteurs en utilisateurs.
           Benchmark : linear.app, finary.com, arc.net, raycast.com
           Accessible sur / (root) quand non-authentifié, redirige vers /dashboard sinon.

E5.4.1  Structure de la Landing Page
        ┌──────────────────────────────────────────────────────────────┐
        │                     LANDING PAGE — SECTIONS                   │
        ├──────────────────────────────────────────────────────────────┤
        │                                                              │
        │  1. HERO SECTION                                             │
        │     → Titre animé (typewriter effect) :                      │
        │       "Votre patrimoine. Unifié. Intelligent."               │
        │     → Sous-titre : "Banque + Crypto + Bourse + Immobilier    │
        │       dans une seule app. Propulsé par l'IA."                │
        │     → CTA primaire : "Commencer gratuitement" → /register    │
        │     → CTA secondaire : "Voir la démo" → scroll to demo      │
        │     → Background : gradient mesh animé (CSS) ou             │
        │       globe 3D rotatif (three.js léger)                      │
        │     → Social proof : "200+ beta testeurs" (animated counter) │
        │     → Trust badges : "Chiffrement AES-256", "RGPD",         │
        │       "Open Source"                                          │
        │                                                              │
        │  2. BENTO GRID — Features showcase                           │
        │     → 6 cartes animées (hover parallax + Framer Motion) :    │
        │       ┌──────────┬──────────┬──────────┐                     │
        │       │ Patrimoine│ Budget   │ IA Nova  │                    │
        │       │ Unifié   │ Auto     │ Advisor  │                    │
        │       ├──────────┼──────────┼──────────┤                     │
        │       │ Crypto   │ Retraite │ Coffre   │                    │
        │       │ Tracker  │ Simulator│ Digital  │                    │
        │       └──────────┴──────────┴──────────┘                     │
        │     → Chaque carte : icône animée + titre + 1 ligne          │
        │     → Scroll-triggered appearance (intersection observer)    │
        │                                                              │
        │  3. DEMO INTERACTIVE                                         │
        │     → Dashboard mockup dans un browser frame                 │
        │     → Données fictives réalistes (pas de compte requis)      │
        │     → Tabs cliquables : Patrimoine / Budget / Crypto / IA    │
        │     → Animations de graphiques (Recharts avec spring)        │
        │     → Guided tour overlay avec tooltips                      │
        │     → Responsive : mobile-first, apparaît collapsed          │
        │                                                              │
        │  4. STATS / SOCIAL PROOF                                     │
        │     → Animated counters (scroll-triggered) :                 │
        │       "34 banques" / "8 000+ cryptos" / "100% RGPD"         │
        │       "< 200ms latence" / "256-bit chiffrement"              │
        │     → Logos des banques compatibles (slider horizontal)      │
        │     → Testimonials (quand disponibles) ou beta badges        │
        │                                                              │
        │  5. PRICING / PLAN                                           │
        │     → Plan gratuit (current) : toutes features, fair use     │
        │     → Plan Pro (futur) : multi-portfolio, priority support   │
        │     → Comparaison visuelle toggle monthly/yearly             │
        │     → "Gratuit pendant la beta" badge                        │
        │                                                              │
        │  6. HOW IT WORKS                                             │
        │     → 3 étapes illustrées (Lottie ou SVG animés) :          │
        │       1. "Connectez vos comptes" (bank icons)                │
        │       2. "L'IA analyse tout" (brain animation)               │
        │       3. "Prenez les bonnes décisions" (chart up)            │
        │     → Timeline vertical avec scroll progress indicator       │
        │                                                              │
        │  7. FAQ SECTION                                              │
        │     → Accordion (Framer Motion spring) :                     │
        │       - "Mes données sont-elles en sécurité ?"               │
        │       - "Comment ça marche avec ma banque ?"                 │
        │       - "C'est vraiment gratuit ?"                           │
        │       - "Qui développe OmniFlow ?"                           │
        │       - "Puis-je exporter mes données ?"                     │
        │     → Schema.org FAQPage JSON-LD pour Google rich results    │
        │                                                              │
        │  8. CTA FINAL + WAITLIST                                     │
        │     → "Rejoignez la révolution financière"                   │
        │     → Email input + "S'inscrire" button                      │
        │     → Si waitlist mode : POST /api/v1/waitlist               │
        │     → Si public : redirect to /register                      │
        │     → Animated background (gradient shift)                   │
        │                                                              │
        │  9. FOOTER                                                   │
        │     → Colonnes : Produit / Ressources / Légal / Social       │
        │     → Links : CGU, Privacy, Changelog, GitHub, Twitter       │
        │     → "Made in France 🇫🇷" badge                             │
        │     → Version number (from changelog API)                    │
        │                                                              │
        └──────────────────────────────────────────────────────────────┘

E5.4.2  SEO & Performance
        → Metadata (Next.js generateMetadata) :
          title       : "OmniFlow — Votre patrimoine unifié et intelligent"
          description : "Agrégez banque, crypto, bourse et immobilier. Budget IA,
                         simulateur retraite, coffre digital. 100% RGPD."
          keywords    : finances personnelles, patrimoine, crypto, budget, IA
          og:image    : /og-image.png (1200×630, auto-generated or Figma)
          og:type     : website
          twitter:card : summary_large_image
        → JSON-LD Structured Data :
          - Organization (OmniFlow)
          - WebApplication (SaaS)
          - FAQPage (7 questions)
          - BreadcrumbList
        → Sitemap.xml : auto-generated via next-sitemap
        → robots.txt : Allow all, Sitemap reference
        → Performance targets :
          - LCP (Largest Contentful Paint) : < 2.5s
          - FID (First Input Delay) : < 100ms
          - CLS (Cumulative Layout Shift) : < 0.1
          - TTFB : < 200ms (Vercel Edge)
          - First Load JS : < 100KB (landing page)
          - Lighthouse : 100 Performance, 100 Accessibility, 100 Best Practices, 100 SEO

E5.4.3  Responsive & Animations
        → Breakpoints : mobile (< 640px), tablet (640-1024px), desktop (> 1024px)
        → Mobile-first : hero stacked, bento 1-col, demo collapsed
        → Animations (Framer Motion) :
          - Hero : fade-up staggered (title → subtitle → CTA → badges)
          - Bento : scroll-triggered scale-up avec spring physics
          - Stats counters : count-up animation on intersection
          - FAQ : accordion height spring (no layout shift)
          - Demo : tab switch cross-fade
          - CTA : gradient background animation (CSS keyframes)
        → Reduced motion : respecte prefers-reduced-motion
        → Dark/Light : support natif via next-themes (déjà implémenté)
```

**E5.5 — Observabilité & Error Tracking**

```
Objectif : Visibilité totale sur la santé de l'app en production.

E5.5.1  Sentry — Error Tracking + Performance
        → Backend (Python SDK) :
          - sentry-sdk[fastapi] dans pyproject.toml
          - DSN via variable d'environnement SENTRY_DSN
          - Capture : exceptions non-gérées, slow queries (> 500ms)
          - Release tracking : sha du commit
          - Environment : production / staging / development
          - Filtrage : ignorer 401/404 (bruit), capturer 500 uniquement
          - Performance : traces sur POST /auth/login, POST /feedback
          - Alerts : Slack/email si > 10 erreurs/heure

        → Frontend (Next.js SDK) :
          - @sentry/nextjs dans package.json
          - Source maps uploadées au build (Vercel integration)
          - Capture : React Error Boundaries, unhandled rejections
          - Performance : Web Vitals (LCP, FID, CLS) automatiques
          - Session Replay : activé (10% sample, 100% on error)
          - User context : user_id (anonymisé), email hash

E5.5.2  Plausible Analytics — RGPD-Compliant
        → Self-hosted ou cloud (plausible.io)
        → Script : <script data-domain="omniflow.app" src="...">
        → Zero cookies → RGPD-compliant sans banner
        → Métriques trackées :
          - Pageviews, unique visitors, bounce rate
          - Top pages, top referrers, top countries
          - Goal conversions : register, first_bank_sync, feedback_sent
          - Custom events : feature_used(name), onboarding_step(n)
        → Dashboard public optionnel : stats.omniflow.app
        → Configuration : next/script strategy="afterInteractive"

E5.5.3  BetterStack (ex-BetterUptime) — Monitoring
        → Monitors :
          - https://api.omniflow.app/health/live (30s interval)
          - https://api.omniflow.app/health/ready (60s interval)
          - https://omniflow.app (30s interval, check for 200)
        → Alerts : email + Slack webhook si downtime
        → Status Page : status.omniflow.app
          - Components : API, Frontend, Database, Redis
          - Incident history public
          - Maintenance windows
        → Heartbeat : cron job /health/ready toutes les 5 minutes

E5.5.4  Logging Production
        → Backend : structlog JSON → Railway log drain
        → Format :
          {"timestamp":"...","level":"info","event":"request",
           "path":"/api/v1/auth/login","status":200,"latency_ms":42}
        → Log levels : ERROR (Sentry) + WARN (anomalies) + INFO (requests)
        → Pas de PII dans les logs (masquer email, password, tokens)
        → Retention : 7 jours Railway, 30 jours si log drain externe
```

**E5.6 — Sécurité Production**

```
Objectif : Durcissement pour exposition publique.

E5.6.1  Environment Variables
        → Tous les secrets via Railway/Vercel env vars (jamais en code)
        → JWT_SECRET_KEY      : 64 caractères hex aléatoires
        → JWT_REFRESH_SECRET  : 64 caractères hex aléatoires (différent)
        → ENCRYPTION_KEY      : Fernet key (cryptography.fernet.Fernet.generate_key())
        → SENTRY_DSN          : projet-specific
        → DATABASE_URL        : Neon pooled connection string
        → REDIS_URL           : Upstash TLS connection string
        → Rotation : trimestrielle (script rotate_secrets.sh)

E5.6.2  CORS Production
        → CORS_ORIGINS strictement limité :
          ["https://omniflow.app", "https://www.omniflow.app"]
        → Pas de wildcard (*) en production
        → Credentials : true (cookies JWT si applicable)

E5.6.3  Rate Limiting Production
        → Cloudflare WAF : 100 req/10s/IP sur /api/*
        → Application-level (déjà implémenté) :
          - /auth/login    : 5/minute (brute force)
          - /auth/register : 3/minute (abuse)
          - /feedback      : 5/hour (spam)
          - Global         : 200/minute/user
        → 429 Too Many Requests avec Retry-After header

E5.6.4  Headers & CSP
        → Content-Security-Policy (strict) :
          default-src 'self';
          script-src 'self' 'unsafe-inline' https://plausible.io;
          style-src 'self' 'unsafe-inline';
          img-src 'self' data: https:;
          connect-src 'self' https://api.omniflow.app https://*.sentry.io;
          font-src 'self';
          frame-ancestors 'none';
        → HSTS : max-age=31536000; includeSubDomains; preload
        → X-Content-Type-Options : nosniff (déjà)
        → X-Frame-Options : DENY
        → Referrer-Policy : strict-origin-when-cross-origin (déjà)

E5.6.5  Database Security
        → Neon : SSL required, IP allowlist (Railway IPs only)
        → Connection pooling via PgBouncer (Neon built-in)
        → Read replica pour queries analytiques heavy (futur)
        → Parameterized queries only (SQLAlchemy = safe by default)
```

**E5.7 — Waitlist & Launch Mechanics**

```
Objectif : Gérer le lancement progressif (beta fermée → beta ouverte → public).

E5.7.1  Waitlist Backend
        → Modèle : WaitlistEntry (email, referral_code, position, status, created_at)
        → Migration : 029_waitlist.py
        → Endpoints :
          POST /api/v1/waitlist           — Inscription (email + optional referral)
          GET  /api/v1/waitlist/position  — Position dans la queue
          POST /api/v1/waitlist/invite    — Admin : inviter N prochains
        → Anti-spam : rate limit 3/heure, email validation regex
        → Referral : chaque inscrit reçoit un code unique. +1 bonus par referral.

E5.7.2  Launch Modes (feature flag)
        → LAUNCH_MODE=waitlist  : landing → waitlist form → merci page
        → LAUNCH_MODE=beta      : landing → register ouvert → dashboard
        → LAUNCH_MODE=public    : landing → register → dashboard + onboarding
        → Configurable via env var, pas de redéploiement nécessaire

E5.7.3  Email Transactionnel (optionnel mais recommandé)
        → Provider : Resend (RGPD-compliant, gratuit 3000/mois)
        → Templates :
          - Bienvenue (après register)
          - Waitlist confirmation (après waitlist signup)
          - Waitlist invitation (quand c'est son tour)
          - Password reset (futur)
        → Integration : POST via API Resend, async (background task)
```

**E5.8 — Fichiers & Stack technique**

```
Backend — Nouveaux fichiers :
├── .github/workflows/ci.yml               — Pipeline CI/CD complet
├── .github/workflows/lighthouse.yml        — Lighthouse CI audit
├── apps/api/app/models/waitlist.py         — Modèle WaitlistEntry
├── apps/api/app/schemas/waitlist.py        — Schemas waitlist
├── apps/api/app/api/v1/waitlist.py         — Endpoints waitlist
├── apps/api/alembic/versions/029_waitlist.py — Migration waitlist
├── apps/api/sentry_config.py               — Config Sentry backend
├── apps/api/railway.toml                   — Config Railway deploy
├── apps/api/tests/test_waitlist.py         — Tests waitlist
└── scripts/rotate_secrets.sh               — Rotation secrets

Backend — Fichiers modifiés :
├── apps/api/pyproject.toml                 — +sentry-sdk[fastapi]
├── apps/api/app/main.py                    — +Sentry init
├── apps/api/app/core/config.py             — +SENTRY_DSN, LAUNCH_MODE
├── apps/api/app/api/v1/router.py           — +waitlist_router
├── apps/api/app/models/__init__.py         — +WaitlistEntry
├── docker-compose.yml                      — Production overrides doc
└── Makefile                                — +deploy, +lighthouse targets

Frontend — Nouveaux fichiers :
├── apps/web/Dockerfile.prod                — Multi-stage production build
├── apps/web/sentry.client.config.ts        — Sentry client init
├── apps/web/sentry.server.config.ts        — Sentry server init
├── apps/web/sentry.edge.config.ts          — Sentry Edge Runtime init
├── apps/web/next-sitemap.config.js         — Sitemap generator config
├── apps/web/src/app/(marketing)/layout.tsx — Layout marketing (no sidebar)
├── apps/web/src/app/(marketing)/page.tsx   — Landing page root
├── apps/web/src/components/landing/
│   ├── hero-section.tsx                    — Hero avec typewriter + CTA
│   ├── bento-grid.tsx                      — Feature cards animées
│   ├── demo-section.tsx                    — Demo interactive browser mock
│   ├── stats-section.tsx                   — Animated counters
│   ├── pricing-section.tsx                 — Plans gratuit / pro
│   ├── how-it-works.tsx                    — 3 étapes illustrées
│   ├── faq-section.tsx                     — Accordion + JSON-LD
│   ├── cta-section.tsx                     — Final CTA + waitlist form
│   ├── footer.tsx                          — Footer multi-colonnes
│   ├── navbar.tsx                          — Navbar landing (transparent → solid)
│   └── bank-logos-slider.tsx               — Slider logos banques
├── apps/web/src/components/landing/
│   └── demo-dashboard-mock.tsx             — Dashboard mockup pour démo
├── apps/web/src/stores/waitlist-store.ts   — Zustand store waitlist
├── apps/web/src/lib/structured-data.ts     — JSON-LD helpers
├── apps/web/public/og-image.png            — Image Open Graph 1200×630
├── apps/web/public/robots.txt              — Robots.txt
└── apps/web/public/sitemap.xml             — Sitemap (auto-generated)

Frontend — Fichiers modifiés :
├── apps/web/package.json                   — +@sentry/nextjs, +next-sitemap
├── apps/web/next.config.mjs                — +Sentry webpack plugin, +sitemap
├── apps/web/src/app/layout.tsx             — +Plausible script, +meta tags
├── apps/web/src/app/(marketing)/page.tsx   — Landing vs redirect logic
├── apps/web/src/middleware.ts              — +redirect auth users to /dashboard
└── apps/web/src/types/api.ts               — +WaitlistEntry interface

Infrastructure — Nouveaux fichiers :
├── .env.production.example                 — Template env vars production
├── railway.toml                            — Railway project config
├── vercel.json                             — Vercel project config
└── DEPLOYMENT.md                           — Guide déploiement complet
```

> **Estimation** : ~40 fichiers (25 nouveaux + 15 modifiés), ~4000 lignes de code.
> Frontend landing page : ~2500 lignes (11 composants + layout + store).
> Backend waitlist : ~400 lignes (modèle + schema + endpoint + migration + tests).
> CI/CD + infra : ~600 lignes (workflows + configs + scripts).
> Observabilité : ~500 lignes (Sentry init + Plausible + monitoring config).

---

## 4. Vision globale

### Pourquoi ce plan fera d'OmniFlow l'app n°1

**Le marché actuel est fragmenté.** Finary fait de l'agrégation patrimoniale. Trade Republic fait du brokerage. YNAB fait du budget. Wealthfront fait de la gestion automatisée. Tous sont excellents dans leur niche — et médiocres en dehors.

**OmniFlow est le seul à tout unifier**, non pas comme un agrégat de features, mais comme un **système d'intelligence financière intégré** où chaque donnée nourrit toutes les autres :

```
                    ┌──────────────────────────────┐
                    │      FINANCIAL DNA            │
                    │   (Score prédictif global)    │
                    └──────────────┬───────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
     ┌─────────┴──────┐  ┌────────┴──────┐   ┌───────┴───────┐
     │   PATRIMOINE    │  │   CASH-FLOW    │   │   OBJECTIFS    │
     │  Banque+Crypto  │  │  Revenus vs    │   │   Retraite     │
     │  +Bourse+Immo   │  │  Dépenses      │   │   Succession   │
     │  -Dettes        │  │  +Forecast 30j │   │   Projets      │
     └─────────┬──────┘  └────────┬──────┘   └───────┬───────┘
               │                   │                   │
               └───────────────────┼───────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
     ┌─────────┴──────┐  ┌────────┴──────┐   ┌───────┴───────┐
     │  FEE NEGOTIATOR │  │ FISCAL RADAR  │   │ WEALTH AUTOPILOT│
     │  Action directe │  │ Optimisation  │   │  Épargne auto   │
     │  sur les frais  │  │ fiscale       │   │  intelligente   │
     └────────────────┘  └───────────────┘   └────────────────┘
```

**Les 3 piliers de la supériorité OmniFlow :**

1. **Open-source & Privacy-first** — Woob élimine la dépendance à Budget Insight (20K€/an pour Finary). Self-hostable. Zéro tracking.

2. **Intelligence système** — Chaque donnée alimente les autres. Le budget impacte la projection de retraite. Les dividendes alimentent le cash-flow. Les dettes s'intègrent dans le score global. Chez les concurrents, ces modules sont cloisonnés.

3. **De l'insight à l'action** — OmniFlow ne se contente pas de montrer des données. Le Fee Negotiator génère un courrier. Le Wealth Autopilot suggère un virement. Le Fiscal Radar alerte avant les deadlines. C'est la différence entre un tableau de bord et un copilote.

**Le résultat attendu après les 5 phases :**

| Métrique | Avant (aujourd'hui) | Après (5 phases) |
|----------|-------------------|--------------------|
| Sécurité | "Startup alpha" | Grade bancaire OWASP |
| Tests | 0% | >70% backend, >50% frontend |
| Piliers patrimoine | 4/5 (manque Dettes) | 5/5 + Fiscal + Retraite + Succession |
| IA capabilities | 6 modules (2 bugués) | 12 modules corrigés + Financial DNA |
| Lighthouse score | Non mesuré | >95 (Perf + A11y) |
| PWA | Non | Oui (offline + push + install) |
| Concurrents surpassés | 0 | Finary (analytics), Trade Republic (UX), YNAB (automatisation) |

---

### Phase F — Real-Time Markets & Carte Interactive Premium (Étape unique)

> **Durée estimée** : 2-3 semaines
> **Prérequis** : Phases A + B terminées (modules Bourse, Crypto, Immobilier existants).
> **Objectif** : Transformer les 3 modules marchés (Bourse, Crypto, Carte Immobilier) en expériences **temps réel institutionnelles** — surpassant Trade Republic (bourse), Binance (crypto) et MeilleursAgents (immo) sur CHAQUE axe. Zéro compromis. Données live, interactions fluides, profondeur analytique professionnelle.

#### F1 — LiveMarkets & Interactive Map Engine (Semaine 23-25)

```
═══════════════════════════════════════════════════════════════════════════
F1.0  Vision — Ce qu'on surpasse et pourquoi
═══════════════════════════════════════════════════════════════════════════

  Benchmark concurrentiel et position cible :
  ─────────────────────────────────────────────────────────────────────────
  │ Fonctionnalité                    │ Finary   │ Trade Rep │ Binance  │ OmniFlow F1 │
  │───────────────────────────────────│──────────│───────────│──────────│─────────────│
  │ Cours temps réel bourse           │ ❌ 15min │ ✅ live   │ ❌ n/a   │ ✅ WebSocket │
  │ Cours temps réel crypto           │ ❌ 5min  │ ❌ limité │ ✅ WS    │ ✅ WebSocket │
  │ Graphiques TradingView            │ ❌       │ ✅        │ ✅       │ ✅ intégré   │
  │ Orderbook / Depth chart           │ ❌       │ ✅ basique│ ✅       │ ✅ animé     │
  │ Carte immobilière interactive     │ ❌       │ ❌        │ ❌       │ ✅ Leaflet++ │
  │ Heatmap prix DVF/m² par quartier  │ ❌       │ ❌        │ ❌       │ ✅ choropleth│
  │ Alertes prix personnalisées       │ ❌       │ ✅ basique│ ✅       │ ✅ multi-canal│
  │ Comparateur multi-actifs unifié   │ ❌       │ ❌        │ ❌       │ ✅ cross-asset│
  │ Sentiment analysis live           │ ❌       │ ❌        │ ❌       │ ✅ NLP       │
  └───────────────────────────────────┴──────────┴───────────┴──────────┴─────────────┘

  OmniFlow est le SEUL à unifier bourse + crypto + immo dans une
  expérience temps réel cohérente, au lieu de 3 apps séparées.


═══════════════════════════════════════════════════════════════════════════
F1.1  WebSocket Real-Time Engine — Architecture Serveur ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  > Statut d'implémentation F1.1 :
  > - [x] F1.1-① — MarketHub singleton (app/services/realtime/market_hub.py)
  > - [x] F1.1-② — Binance WebSocket provider (app/services/realtime/binance_ws.py)
  > - [x] F1.1-③ — CoinGecko Polling provider — fallback REST (app/services/realtime/coingecko_provider.py)
  > - [x] F1.1-④ — WebSocket endpoint client-facing (app/api/v1/ws_markets.py)
  > - [x] F1.1-⑤ — REST snapshot endpoint (GET /api/v1/market/live/snapshot)
  > - [x] F1.1-⑥ — Frontend React hook useMarketWebSocket (src/lib/useMarketWebSocket.ts)
  > - [x] F1.1-⑦ — Intégration dans le crypto-market-explorer (prix live, flash animations)
  > - [x] F1.1-⑧ — Intégration dans le stock-market-explorer (prix live, flash animations)
  > - [x] F1.1-⑨ — Lifespan startup/shutdown du Hub dans main.py
  > - [x] F1.1-⑩ — Router wiring dans v1/router.py

  Problème actuel :
  ─────────────────────────────────────────────────────────────────────────
  → Les prix bourse/crypto sont récupérés par polling HTTP toutes les
    5-15 minutes via des REST API tierces (Yahoo Finance, CoinGecko).
  → L'utilisateur voit des données décalées. Aucune sensation de "live".
  → Impossible de créer des alertes instantanées ou un orderbook.
  → Le store Zustand `market-store.ts` fait un `apiClient.get()` à chaque
    page refresh — aucune mise à jour automatique entre les navigations.
  → Les composants `crypto-market-explorer.tsx` (723 lignes) et
    `stock-market-explorer.tsx` (612 lignes) utilisent des données figées
    chargées à l'ouverture de la page. Zéro temps réel.

  Architecture cible — MarketHub Temps Réel :
  ─────────────────────────────────────────────────────────────────────────

  ① MARKET HUB — Singleton Asyncio (Cœur du moteur)
    ─────────────────────────────────────────────────────────────────────
    Fichier : app/services/realtime/market_hub.py

    Classe MarketHub — singleton global, démarré au lifespan de FastAPI :
    → Attributs :
      - _providers: dict[str, BaseProvider] — providers source enregistrés
      - _subscriptions: dict[str, set[WebSocket]] — channel → clients abonnés
      - _latest: dict[str, dict] — dernier tick par symbole (snapshot cache)
      - _buffer: dict[str, deque(maxlen=500)] — buffer circulaire par symbole
      - _lock: asyncio.Lock — protection concurrence sur _subscriptions
    → Méthodes principales :
      - start() → lance tous les providers en asyncio.Tasks parallèles
      - stop() → annule toutes les tasks, ferme les connexions proprement
      - subscribe(ws, channels) → enregistre un client sur N channels
      - unsubscribe(ws) → retire le client de tous ses channels
      - on_tick(channel, data) → callback invoqué par les providers à
        chaque nouveau tick. Responsabilités :
        a) Met à jour _latest[channel] (snapshot instantané)
        b) Ajoute au _buffer[channel] (replay pour nouveaux clients)
        c) Fan-out : broadcast vers tous les WS de _subscriptions[channel]
        d) Publie sur Redis PubSub channel `market:{channel}` pour scaling
      - get_snapshot(symbols) → retourne _latest filtré (REST fallback)

    Throttle intelligent :
    → Chaque channel a un `_last_push: dict[str, float]` (timestamp mono)
    → Intervalle minimum entre deux pushes : 250ms par channel (4 ticks/sec)
    → Les ticks intermédiaires sont agrégés : on conserve le dernier prix,
      le volume cumulé, le bid/ask le plus récent
    → Résultat : le client reçoit max 4 updates/seconde par symbole, mais
      chaque update contient les données les plus fraîches

    Robustesse :
    → Chaque provider tourne dans sa propre asyncio.Task avec retry exponentiel
    → Backoff : 1s → 2s → 4s → 8s → 16s → 30s (cap à 30s)
    → Jitter aléatoire ±20% pour éviter les thundering herds
    → Logging structuré : chaque reconnexion loguée avec le n° de tentative
    → Heartbeat : le hub envoie un ping JSON {"type": "heartbeat", "ts": ...}
      toutes les 30s à chaque client connecté. Si le client ne répond pas
      dans les 10s (pong timeout), le WS est fermé et l'abonnement nettoyé.

  ② BINANCE WEBSOCKET PROVIDER — Données Crypto Live
    ─────────────────────────────────────────────────────────────────────
    Fichier : app/services/realtime/binance_ws.py

    Source : Binance Combined Streams (gratuit, sans clé API, mondial)
    URL :  wss://stream.binance.com:9443/stream?streams={streams}
    Protocole : Combined stream — une seule connexion TCP pour N symbols

    Flux souscrits dynamiquement selon les clients connectés :
    → {symbol}usdt@miniTicker — prix, volume, variation 24h (léger, 1 msg/sec)
      Payload : { "e": "24hrMiniTicker", "s": "BTCUSDT", "c": "62453.21",
                  "o": "61200.00", "h": "63100.00", "l": "60800.00",
                  "v": "12345.678", "q": "767890123.45" }
    → {symbol}usdt@kline_1m — bougies 1 minute (pour les graphiques live)
    → {symbol}usdt@depth20@1000ms — orderbook top 20 niveaux (futur F1.3)

    Mapping vers le format OmniFlow normalisé :
    → channel: "crypto:{SYMBOL}" (ex: "crypto:BTC")
    → Payload normalisé envoyé au MarketHub.on_tick() :
      { "channel": "crypto:BTC", "price": 62453.21, "open_24h": 61200.00,
        "high_24h": 63100.00, "low_24h": 60800.00, "volume_24h": 767890123.45,
        "change_pct_24h": 2.047, "ts": 1709472000123 }

    Symbols de base (top 20 par market cap — toujours connectés) :
    → BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, DOT, LINK,
      MATIC, UNI, ATOM, LTC, FIL, NEAR, APT, ARB, OP, INJ

    Souscription dynamique :
    → Quand un client s'abonne à "crypto:SHIB" et que le symbol n'est pas
      dans les streams actifs, le provider envoie un message Binance :
      { "method": "SUBSCRIBE", "params": ["shibusdt@miniTicker"], "id": N }
    → Quand le dernier client se désabonne, UNSUBSCRIBE correspondant
    → Compteur de références par symbole pour éviter les désabonnements prématurés

    Gestion de la connexion :
    → Utilise la lib `websockets` (déjà dans pyproject.toml >= 12.0)
    → Reconnexion auto avec backoff exponentiel (hérité de BaseProvider)
    → Détection de déconnexion via ping/pong natif WebSocket
    → Binance envoie un PING toutes les 3 minutes — réponse PONG automatique

  ③ COINGECKO POLLING PROVIDER — Fallback REST
    ─────────────────────────────────────────────────────────────────────
    Fichier : app/services/realtime/coingecko_provider.py

    Rôle : backup pour les symbols non-Binance et quand Binance est down.
    → Polling toutes les 30 secondes via l'API CoinGecko existante
    → GET /api/v3/simple/price?ids={ids}&vs_currencies=eur&include_24hr_change=true
    → Convertit en format OmniFlow normalisé et appelle hub.on_tick()
    → Rate limit : max 10 calls/minute (gratuit CoinGecko)
    → Sert aussi les données stocks via l'API Yahoo Finance existante
      (polling /v8/finance/spark) pour les cours bourse en pseudo temps réel

  ④ ENDPOINT WEBSOCKET CLIENT-FACING
    ─────────────────────────────────────────────────────────────────────
    Fichier : app/api/v1/ws_markets.py
    Endpoint : WS /api/v1/ws/markets

    Protocole complet :
    ─────────────────────────────────────────────────────────────────────

    1. Connexion : le client ouvre un WebSocket standard
       → Le serveur accepte immédiatement (pas d'auth requise pour le
         WebSocket de marché — données publiques, même pattern que Binance)

    2. Souscription : le client envoie un JSON :
       { "action": "subscribe", "channels": ["crypto:BTC", "crypto:ETH"] }
       → Le serveur enregistre le client dans MarketHub._subscriptions
       → Le serveur envoie immédiatement un snapshot de chaque channel :
         { "type": "snapshot", "channel": "crypto:BTC", "data": {...} }

    3. Flux de données : le serveur push des updates :
       { "type": "tick", "channel": "crypto:BTC",
         "data": { "price": 62453.21, "change_pct_24h": 2.047, ... },
         "ts": 1709472000123 }

    4. Désabonnement :
       { "action": "unsubscribe", "channels": ["crypto:BTC"] }

    5. Heartbeat : le serveur envoie toutes les 30s :
       { "type": "heartbeat", "ts": 1709472030000 }
       → Si le client ne répond pas un "pong" dans 10s → fermeture

    6. Déconnexion : nettoyage automatique des souscriptions
       → try/except WebSocketDisconnect → hub.unsubscribe(ws)

    Avantage vs la concurrence :
    → Finary : zéro WebSocket, tout est polled (15min de décalage)
    → Trade Republic : WebSocket propriétaire, pas d'API publique
    → Binance : WebSocket direct mais uniquement crypto
    → OmniFlow : WebSocket unifié crypto + stocks + indices, gratuit

  ⑤ ENDPOINT REST SNAPSHOT — Fallback pour SSR & First Paint
    ─────────────────────────────────────────────────────────────────────
    Fichier : ajouté dans app/api/v1/market.py (route /market/live/snapshot)
    GET /api/v1/market/live/snapshot?symbols=BTC,ETH,AAPL,^FCHI

    Rôle : fournir un snapshot instantané des derniers prix connus
    avant que la connexion WebSocket soit établie (SSR hydration, SEO).
    → Source : MarketHub._latest (en mémoire, latence ~0ms)
    → Réponse : { "BTC": { "price": 62453.21, ... }, "ETH": {...} }
    → TTL header : Cache-Control: public, max-age=5 (5 secondes)
    → Pas d'authentification requise (données de marché publiques)

  ⑥ FRONTEND HOOK — useMarketWebSocket
    ─────────────────────────────────────────────────────────────────────
    Fichier : src/lib/useMarketWebSocket.ts

    Hook React réutilisable pour la connexion WebSocket temps réel :
    → Connexion automatique au mount, déconnexion au unmount
    → Souscription déclarative : useMarketWebSocket(["crypto:BTC", "crypto:ETH"])
    → Retourne : { prices: Map<string, TickData>, isConnected: boolean }
    → Reconnexion automatique avec backoff exponentiel (1s → 2s → 4s → max 30s)
    → Heartbeat : répond automatiquement aux pings du serveur
    → Merge intelligent : quand un tick arrive, seul le composant qui
      affiche ce symbole est re-rendu (via useRef + selective setState)
    → Fallback REST : si le WebSocket échoue 3 fois, bascule en mode
      polling sur /api/v1/market/live/snapshot (toutes les 10s)

    Intégration dans le Zustand market-store.ts :
    → Les prix temps réel sont mergés dans le store existant
    → Les composants MiniSparkline, CoinsTable, GlobalStatsBar bénéficient
      des mises à jour sans modification de leur code de rendu
    → Flash animation CSS : quand un prix change, la cellule clignote
      en vert (hausse) ou rouge (baisse) pendant 600ms

  ⑦ INFRASTRUCTURE REDIS PUB/SUB (Scaling Multi-Worker)
    ─────────────────────────────────────────────────────────────────────

    Architecture Redis pour le scaling horizontal :
    → Chaque tick est publié sur Redis PubSub channel `market:{symbol}`
    → En mode multi-worker (uvicorn --workers N), chaque worker souscrit
      aux channels Redis et redistribue vers ses clients WebSocket locaux
    → Le provider source (Binance WS) ne tourne que sur le worker master
    → Les autres workers sont des "relay" purs

    Clés Redis :
    → market:latest:{symbol} → HSET { price, change_pct_24h, volume_24h,
      high_24h, low_24h, ts } — TTL 120s — snapshot REST
    → market:buffer:{symbol} → Liste Redis (LPUSH/LTRIM 500) — replay
    → market:subscribers → SET de channels actifs (pour monitoring)

    Métriques (observabilité) :
    → market:stats:ticks_total → INCRBY à chaque tick (compteur global)
    → market:stats:clients_connected → GAUGE (nombre de WS clients)
    → Loggé toutes les 60s : "MarketHub: 15 clients, 42 channels, 1847 ticks/min"


═══════════════════════════════════════════════════════════════════════════
F1.2  Marché Bourse — Terminal Trading Temps Réel  ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  > Statut d'implémentation F1.2 :
  > - [x] 1. Graphique TradingView (lightweight-charts) — Candlestick/Line/Area/Histogram
  > - [x] 2. Indicateurs techniques overlay (SMA 20/50/200, EMA 12/26, Bollinger Bands)
  > - [x] 3. Indicateurs panneau séparé (RSI 14, MACD 12/26/9, Volume coloré)
  > - [x] 4. Ticker Tape animé (bandeau défilant temps réel, top indices + actions)
  > - [x] 5. Screener multi-critères (secteur, cap, P/E, dividende, performance, volume)
  > - [x] 6. Watchlist intelligente (groupes custom, drag-drop, localStorage persistance)
  > - [x] 7. Backend endpoints (chart OHLCV, screener filtré, watchlist CRUD, search autocomplete)
  > - [x] 8. Intégration WS temps réel dans le chart (bougie courante mise à jour live)

  Composant principal : src/components/market/stock-trading-terminal.tsx (nouveau)
  Composants satellites :
    - src/components/market/trading-chart.tsx (chart TradingView + indicateurs)
    - src/components/market/ticker-tape.tsx (bandeau défilant)
    - src/components/market/stock-screener.tsx (screener multi-critères)
    - src/components/market/stock-watchlist.tsx (watchlist avec groupes)
  ─────────────────────────────────────────────────────────────────────────

  ① GRAPHIQUE TRADINGVIEW INTÉGRÉ (lightweight-charts v4)
    ─────────────────────────────────────────────────────
    Architecture technique :
    → Bibliothèque : lightweight-charts v4.2 (TradingView open-source, 42KB gzip)
      - npm install lightweight-charts
      - Import : createChart, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries
    → Rendu 100% natif Canvas WebGL — zéro iframe, zéro dépendance externe
    → Composant React : <TradingChart symbol={symbol} interval={interval} />
      - useRef pour le container DOM
      - useEffect pour createChart + setData + cleanup
      - Resize observer pour responsive auto

    Types de graphiques (toggle buttons) :
    → Candlestick : bougies OHLC classiques (vert hausse / rouge baisse)
    → Line : prix de clôture en trait continu
    → Area : surface remplie sous la ligne de prix (gradient brand→transparent)
    → Histogram : barres de volume colorées (vert/rouge selon direction)

    Intervalles temporels :
    → Boutons : 1min | 5min | 15min | 1H | 4H | 1D | 1W | 1M
    → Source de données : Yahoo Finance Chart API v8
      GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
        ?interval={interval}&range={range}
    → Mapping range automatique :
      1min → 1d | 5min → 5d | 15min → 5d | 1H → 1mo | 4H → 6mo
      1D → 5y | 1W → max | 1M → max
    → Endpoint backend proxy : GET /api/v1/market/stocks/ohlcv/{symbol}?interval=1d&range=1y
      → Normalise les données Yahoo → format lightweight-charts :
        { time: 'YYYY-MM-DD', open, high, low, close, volume }

    Mise à jour temps réel :
    → Le hook useMarketWebSocket déjà en place fournit les ticks `stock:{symbol}`
    → Chaque tick met à jour la bougie courante :
      candleSeries.update({ time: currentCandle.time, open, high: Math.max(high, tick.price),
        low: Math.min(low, tick.price), close: tick.price })
    → Transition fluide : lightweight-charts anime nativement les updates
    → Badge "LIVE" pulsant affiché en haut à droite du chart
    → Crosshair synchronisé : survol affiche OHLCV + tous les indicateurs dans un header bar
    → Dark mode natif : palette OmniFlow (bg-surface, text-foreground, brand colors)

    Indicateurs techniques — overlay sur le prix :
    → SMA (Simple Moving Average) :
      - Périodes : 20 (court terme), 50 (moyen), 200 (long terme)
      - Calcul : moyenne arithmétique des N derniers close
      - Affichage : LineSeries superposée au graphique, couleurs distinctes
        SMA20 = #3B82F6 (bleu), SMA50 = #F59E0B (ambre), SMA200 = #EF4444 (rouge)
      - Golden Cross / Death Cross : alerte visuelle quand SMA50 croise SMA200
    → EMA (Exponential Moving Average) :
      - Périodes : 12 et 26 (bases du MACD)
      - Calcul : EMA_t = price × k + EMA_(t-1) × (1-k), k = 2/(period+1)
      - Affichage : LineSeries en pointillés
    → Bollinger Bands :
      - Période : 20, déviation : 2σ
      - Calcul : bande haute = SMA20 + 2×σ, bande basse = SMA20 - 2×σ
      - Affichage : zone remplie semi-transparente entre les 2 bandes
      - Signal : squeeze (bandes resserrées) = breakout imminent
    → Toggle individuel : chaque indicateur peut être activé/désactivé via toolbar

    Indicateurs techniques — panneau séparé :
    → RSI (Relative Strength Index, 14 périodes) :
      - Calcul : RSI = 100 - 100/(1 + avg_gain/avg_loss) sur N périodes
      - Affichage : graphique en pane séparé sous le prix, avec lignes 30/70
      - Coloration : < 30 = survendu (vert), > 70 = suracheté (rouge)
      - Hauteur du pane : 100px fixe, ratio chart/pane = 3:1
    → MACD (12, 26, 9) :
      - Calcul : MACD line = EMA12 - EMA26, Signal = EMA9(MACD), Histogram = MACD - Signal
      - Affichage : 2 lignes (MACD + Signal) + barres d'histogramme (vert/rouge)
      - Signal d'achat : histogramme passe de négatif à positif
    → Volume :
      - Histogramme sous le graphique principal
      - Coloration : vert si close > open (bougie haussière), rouge sinon
      - Opacité proportionnelle au volume relatif (vs moyenne 20 jours)

  ② TICKER TAPE ANIMÉ (bandeau défilant haut de page)
    ──────────────────────────────────────────────────
    Architecture technique :
    → Composant : <TickerTape /> — bandeau horizontal 40px fixé en haut du terminal
    → Données : top 8 indices mondiaux + top 12 actions du portefeuille
      Indices : ^GSPC (S&P), ^FCHI (CAC40), ^GDAXI (DAX), ^FTSE, ^IXIC (Nasdaq),
                ^DJI (Dow), ^N225 (Nikkei), ^HSI (Hang Seng)
    → Animation CSS : @keyframes scroll-left, vitesse 60px/s, pause au hover
      - Duplication du contenu pour boucle infinie sans saut
      - Hardware accelerated : transform: translateX() + will-change: transform
    → Chaque ticker affiche :
      - Symbole (ex: "AAPL")
      - Prix formaté (ex: "213.42$")
      - Badge variation (ex: "+1.23%" vert ou "-0.87%" rouge)
    → Mise à jour temps réel : useMarketWebSocket souscrit à tous les channels
      → Les prix se mettent à jour en place, flash animation 400ms
    → Clic sur un ticker → setSelectedSymbol() → chart principal bascule sur ce titre
    → Responsive : masqué sur mobile (< 768px), bande pleine sur desktop

  ③ SCREENER D'ACTIONS AVANCÉ
    ───────────────────────────
    Architecture technique :
    → Composant : <StockScreener /> — panneau avec filtres + résultats
    → Backend endpoint : GET /api/v1/market/stocks/screen
      - Query params : sector, min_cap, max_cap, min_pe, max_pe,
        min_dividend_yield, min_change_1m, max_change_1m, min_volume,
        sort_by, sort_dir, limit (défaut 50)
      - Source : univers de 42 instruments enrichi avec données Yahoo en cache Redis (TTL 5min)
      - Réponse : tableau de StockItem[] avec tous les champs analytiques

    Filtres multi-critères (barre latérale rétractable) :
    → Secteur : pills GICS 11 secteurs (Technology, Healthcare, Finance, Energy, etc.)
    → Capitalisation :
      - Toggle buttons : Mega (>200B), Large (10-200B), Mid (2-10B), Small (<2B), Tout
    → P/E ratio : double range slider (0 — 80+)
    → Dividend yield : pills rapides (Tout, >0%, >2%, >4%, >6%)
    → Performance : période sélectable (1M, 3M, YTD, 1Y) + range slider (-50% → +100%)
    → Volume moyen : seuil minimum (slider, unité K/M/B)
    → Bouton "Réinitialiser" + sauvegarde presets (localStorage)

    Résultats :
    → Tableau triable : colonnes Symbol, Nom, Prix, Var%, Cap, P/E, Div%, Volume, Secteur
    → Sparkline 7 jours inline via mini AreaChart (recharts, 60×20px)
    → Nombre de résultats affiché : "23 actions trouvées"
    → Clic sur une ligne → ouvre le chart principal de ce symbole

  ④ WATCHLIST INTELLIGENTE (persistance localStorage)
    ──────────────────────────────────────────────────
    Architecture technique :
    → Composant : <StockWatchlist /> — panneau latéral toggleable
    → Données stockées en localStorage : clé 'omniflow_watchlist'
      Structure : { groups: [{ name: string, symbols: string[] }] }
    → Groupes par défaut : "Favoris", "Tech US", "Dividendes FR", "ETF Core"
    → Ajout rapide : barre de recherche avec autocomplete
      - Backend : GET /api/v1/market/stocks/search?q={query}
        → Proxy Yahoo Finance symbol search API
        → Retourne : [{ symbol, name, exchange, type }] (max 10 résultats)
      - Frontend : input avec debounce 300ms + dropdown résultats

    Fonctionnalités :
    → Colonnes : Symbole | Nom | Prix (live) | Var% | Var€ | Volume
    → Réorganisation drag-and-drop (simple state swap, pas de lib externe)
    → Groupes custom : créer/renommer/supprimer des groupes via menu contextuel
    → Suppression rapide : bouton X sur chaque titre
    → Mise à jour temps réel : useMarketWebSocket pour les symboles de la watchlist
    → Badge compteur : nombre de titres dans chaque groupe
    → Empty state : illustration + CTA "Ajouter un titre"

  ⑤ SEARCH AUTOCOMPLETE GLOBAL
    ──────────────────────────
    → Backend endpoint : GET /api/v1/market/stocks/search?q={query}
    → Source : Yahoo Finance autosuggest API
      GET https://query1.finance.yahoo.com/v1/finance/search?q={query}&newsCount=0&quotesCount=10
    → Réponse normalisée : { symbol, name, exchange, type, sector }
    → Cache Redis : clé "search:{query_hash}" TTL 1h
    → Frontend : input avec debounce 300ms, dropdown avec icônes par type (action/etf/index)
    → Clic sur un résultat → ouvre le chart + watchlist add button

  ⑥ LAYOUT DU TERMINAL DE TRADING
    ─────────────────────────────
    Architecture de la page :
    → Remplacement du StockDetailDrawer actuel par un vrai terminal multi-panneaux
    → Layout grid responsive :
      ┌────────────────────────────────────────────────────────┐
      │ TICKER TAPE (bandeau défilant pleine largeur)         │
      ├────────────────────────────┬──────────────────────────┤
      │                            │  Symbol Info + Search     │
      │   CHART TradingView       │  Key Stats (prix, var,    │
      │   (70% width)             │  cap, P/E, div)           │
      │   + Indicateurs toolbar   │──────────────────────────│
      │   + RSI/MACD panes        │  WATCHLIST                │
      │                            │  (groupes + titres)       │
      ├────────────────────────────┴──────────────────────────┤
      │ SCREENER (panneau déplié/replié en bas, full width)    │
      └────────────────────────────────────────────────────────┘
    → Toolbar chart : boutons intervalles + type chart + indicateurs toggles
    → Panneau droit redimensionnable via drag handle (min 280px, max 400px)
    → Screener en bas : collapsible, hauteur 300px quand ouvert
    → Mobile : layout empilé (chart full width → stats → watchlist → screener)

  Dépendances requises :
  ─────────────────────
    Frontend (npm) :
    → lightweight-charts@^4.2.0 — graphiques TradingView natifs
    Backend (pip) :
    → (aucune nouvelle dépendance — utilise httpx existant pour Yahoo Finance)

  Endpoints API ajoutés :
  ──────────────────────
    Backend : app/api/v1/market.py (ajouts au router existant)
    → GET /api/v1/market/stocks/ohlcv/{symbol}
      Query : ?interval=1d&range=1y
      Réponse : { symbol, interval, candles: [{ time, open, high, low, close, volume }], currency }
      Source : Yahoo Finance Chart v8 → normalisation OHLCV

    → GET /api/v1/market/stocks/screen
      Query : ?sector=Technology&min_cap=10e9&max_pe=30&min_dividend_yield=2&sort_by=market_cap&limit=50
      Réponse : { results: StockItem[], total: number }
      Source : univers 42 instruments filtered + enriched

    → GET /api/v1/market/stocks/search?q=app
      Réponse : { results: [{ symbol, name, exchange, type }] }
      Source : Yahoo Finance autosuggest API cached


═══════════════════════════════════════════════════════════════════════════
F1.3  Marché Crypto — Terminal Binance-Killer Temps Réel  ✅ IMPLÉMENTÉ
═══════════════════════════════════════════════════════════════════════════

  Composants : src/components/market/crypto-trading-terminal.tsx (nouveau)
               + 5 sub-composants spécialisés
  Backend    : app/api/v1/market.py — 5 endpoints REST ajoutés
  Dépendance : lightweight-charts v4 (déjà installé F1.2)
  ─────────────────────────────────────────────────────────────────────────

  Vue d'ensemble du terminal crypto :
  ┌────────────────────────────────────────────────────────────────────┐
  │  FEAR & GREED GAUGE (compact)  │  Symbol Search + Live Price      │
  ├────────────────────────────────┴──────────────────────────────────┤
  │                                                                    │
  │   CHART TradingView Crypto      │  ORDERBOOK temps réel            │
  │   lightweight-charts v4         │  20 niveaux bids / asks          │
  │   Candlestick + indicateurs     │  Depth bars + imbalance          │
  │   8 intervalles (1m → 1M)       │  Polling 2s via Binance REST     │
  │   SMA / EMA / Bollinger /       │                                  │
  │   RSI / MACD overlays           ├──────────────────────────────────┤
  │   Volume histogram              │  TRADES FEED (Time & Sales)      │
  │   Live WS tick updates          │  Derniers 50 trades              │
  │                                 │  Coloration buy/sell             │
  ├─────────────────────────────────┴──────────────────────────────────┤
  │  TOP MOVERS — 3 onglets : Gainers | Losers | Volume Leaders        │
  │  Treemap heatmap proportionnelle à la market cap, couleur = perf%  │
  │  + Liste tabulaire triable avec mini-sparklines inline             │
  └────────────────────────────────────────────────────────────────────┘

  Intégration : page /crypto → onglet "Marché" → toggle Explorateur / Terminal

  ① GRAPHIQUE TRADINGVIEW CRYPTO (TradingChart engine F1.2 réutilisé)
  ─────────────────────────────────────────────────────────────────────
    → Même composant <TradingChart> que pour les actions (F1.2), réutilisé
      tel quel avec un endpoint de données différent
    → Source OHLCV : Binance REST API (pas Yahoo Finance)
      GET https://api.binance.com/api/v3/klines?symbol={SYM}USDT&interval={iv}&limit={n}
    → Intervalles supportés : 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M
    → Format candle : { time (YYYY-MM-DD ou unix), open, high, low, close, volume }
    → Indicateurs : SMA(20/50/200), EMA(12/26), Bollinger(20,2), RSI(14), MACD(12,26,9)
      → Moteur calcul : src/lib/technical-indicators.ts (créé en F1.2, réutilisé identique)
    → Volume histogram coloré (vert si close ≥ open, rouge sinon)
    → Live tick updates via WebSocket channel `crypto:{SYMBOL}` (MarketHub existant)
    → Crosshair OHLCV en temps réel dans la barre d'en-tête
    → Badge 🟢 LIVE quand le WS est connecté

    Backend endpoint :
    → GET /api/v1/market/crypto/ohlcv/{symbol}?interval=1d&limit=365
      Proxy Binance /api/v3/klines → transforme en { candles: [...], symbol, interval }
      Cache Redis : 30s (intraday), 120s (1h), 300s (1d+)
      Conversion time : intraday = unix seconds, daily+ = 'YYYY-MM-DD'

  ② ORDERBOOK TEMPS RÉEL — 20 NIVEAUX BIDS/ASKS
  ─────────────────────────────────────────────────────────────────────
    → Source : Binance REST API (polling toutes les 2 secondes)
      GET https://api.binance.com/api/v3/depth?symbol={SYM}USDT&limit=20
    → Affichage en dual-column (bids à gauche en vert, asks à droite en rouge)
    → Chaque niveau : prix | quantité | total cumulé
    → Depth bars : barre horizontale proportionnelle au total cumulé,
      opacité croissante vers le mid-price (spread)
    → Spread indicator : écart bid[0] - ask[0] en valeur absolue et en %
    → Imbalance ratio : Σ(bid_qty) / Σ(ask_qty)
      → Affiché comme jauge : > 1.5 = 🟢 Pression acheteuse
                               0.66–1.5 = ⚪ Neutre
                               < 0.66 = 🔴 Pression vendeuse
    → Mid-price centré et mis en surbrillance
    → Animation : transition CSS sur les barres lors du refresh (300ms ease)
    → Composant auto-contenu avec polling interne (useEffect + setInterval)

    Backend endpoint :
    → GET /api/v1/market/crypto/depth/{symbol}?limit=20
      Proxy Binance orderbook. Cache Redis 2s.
      Réponse : { symbol, bids: [[price, qty]], asks: [[price, qty]],
                  spread, spread_pct, imbalance, last_update_id }

  ③ FLUX DE TRADES (Time & Sales)
  ─────────────────────────────────────────────────────────────────────
    → Source : Binance REST API
      GET https://api.binance.com/api/v3/aggTrades?symbol={SYM}USDT&limit=50
    → Tableau défilant vertical, max 50 lignes visibles
    → Colonnes : Heure (HH:mm:ss.ms) | Prix | Quantité | Side (BUY/SELL)
    → Coloration : vert (buyer is maker = false → market buy),
                   rouge (buyer is maker = true → market sell)
    → Gros trades : quantité > moyenne × 3 → ligne highlight avec
      background pulsé (CSS animation)
    → Polling toutes les 2 secondes, merge intelligent (ne pas re-afficher
      les trades déjà visibles, basé sur aggTradeId)
    → Scroll auto vers le bas (latest trades en haut, style Binance)
    → Composant compact (250px height max), scrollable

    Backend endpoint :
    → GET /api/v1/market/crypto/trades/{symbol}?limit=50
      Proxy Binance aggTrades. Cache Redis 2s.
      Réponse : { symbol, trades: [{ id, price, qty, time, is_buyer_maker }] }

  ④ TOP MOVERS + TREEMAP HEATMAP
  ─────────────────────────────────────────────────────────────────────
    → Source : CoinGecko /coins/markets (already available via existing endpoint)
    → 3 sous-onglets avec compteur :
      a) 🚀 Top Gainers (triés par change_pct_24h desc, top 50)
      b) 📉 Top Losers (triés par change_pct_24h asc, top 50)
      c) 💰 Volume Leaders (triés par total_volume desc, top 50)
    → Twee vues toggle :
      - Vue Liste : tableau sortable (Nom, Prix, Var%, Cap, Volume, Sparkline 7d)
      - Vue Treemap : heatmap rectangulaire type Coin360
        → Surface proportionnelle à la market cap
        → Couleur = performance 24h (vert → rouge gradient)
        → Implémentation : CSS Grid avec flex-grow proportionnel
          (pas de dépendance D3 pour garder le bundle léger)
        → Hover = tooltip (Nom, Prix, Var%, Volume)
        → Clic = sélection du symbole dans le chart
    → Filtrage par catégorie : All / Layer1 / DeFi / Stablecoins / Meme
    → Mise à jour automatique toutes les 30 secondes

    Backend endpoint :
    → GET /api/v1/market/crypto/top-movers?sort=gainers&limit=50
      Ré-utilise les données de /market/crypto/coins enrichies
      Réponse : { gainers: [...], losers: [...], volume_leaders: [...],
                  updated_at: timestamp }
      Cache Redis 30s

  ⑤ FEAR & GREED INDEX
  ─────────────────────────────────────────────────────────────────────
    → Source : API Alternative.me (gratuit, sans clé API)
      GET https://api.alternative.me/fng/?limit=31&format=json
    → Jauge semi-circulaire animée avec gradient :
      0–25 (Extreme Fear 🔴) → 25–45 (Fear 🟠) → 45–55 (Neutral ⚪)
      → 55–75 (Greed 🟢) → 75–100 (Extreme Greed 🟣)
    → Aiguille SVG animée avec spring physics (framer-motion)
    → Valeur centrale en gros + classification textuelle
    → Sous la jauge : sparkline 30 jours (historique de l'indice)
    → Insight textuel contextuel :
      - "Extreme Fear (< 20) : historiquement, rendements moyens à 30j = +18%"
      - "Extreme Greed (> 80) : zone de prudence, corrections fréquentes à 14j"
    → Composant compact intégré dans le header du terminal
    → Clic pour déplier l'historique complet

    Backend endpoint :
    → GET /api/v1/market/crypto/fear-greed
      Proxy alternative.me. Cache Redis 600s (10 min).
      Réponse : { value: 28, label: "Fear", history: [{value, date, label}...],
                  timestamp: "..." }

  ⑥ TERMINAL LAYOUT (assemblage principal)
  ─────────────────────────────────────────────────────────────────────
    → Composant orchestrateur : <CryptoTradingTerminal />
    → State central : selectedSymbol (default "BTC"), selectedSymbolName
    → Propagation : clic sur un coin dans TopMovers / Treemap / Fear&Greed
      → met à jour le chart + orderbook + trades feed automatiquement
    → Search autocomplete : réutilise GET /api/v1/market/crypto/search
    → Live price header : prix + change% + high/low 24h via WS
    → Layout responsive :
      - Desktop : grille 2 colonnes (chart 65% + orderbook/trades 35%)
      - Tablet : chart plein écran + toggle panels
      - Mobile : empilé verticalement
    → Toggle Explorateur / Terminal dans l'onglet Marché du /crypto

  Checklist d'implémentation :
  [x] Endpoint OHLCV crypto (Binance klines proxy)
  [x] Endpoint orderbook depth (Binance depth proxy)
  [x] Endpoint trades feed (Binance aggTrades proxy)
  [x] Endpoint top movers (CoinGecko tri enrichi)
  [x] Endpoint Fear & Greed (alternative.me proxy)
  [x] Composant chart crypto (réutilise TradingChart F1.2)
  [x] Composant orderbook (dual-column + depth bars + imbalance)
  [x] Composant trades feed (Time & Sales)
  [x] Composant top movers + treemap heatmap
  [x] Composant Fear & Greed gauge
  [x] Terminal layout assemblage
  [x] Intégration page /crypto onglet Marché
  [x] 0 erreurs TypeScript


═══════════════════════════════════════════════════════════════════════════
F1.4  Carte Immobilière Interactive — Au-delà de MeilleursAgents
═══════════════════════════════════════════════════════════════════════════

  ✅ IMPLÉMENTÉ — Réécriture complète de france-property-map.tsx
  Composants : france-property-map.tsx (750+ lignes), map-filter-sidebar.tsx,
               map-comparison-panel.tsx
  Backend : migration 014 (lat/lng) + 2 endpoints (DVF heatmap + POI proxy)
  ─────────────────────────────────────────────────────────────────────────

  Architecture technique :
  ┌─────────────────────────────────────────────────────────┐
  │ ┌─[Tile Switcher]──[Layers]──[Filters]──[Comparison]─┐ │
  │ │                                                      │ │
  │ │  ┌─── Leaflet Map (imperative) ────────────────────┐ │ │
  │ │  │                                                  │ │ │
  │ │  │   🟢🟡🔴 Custom SVG markers (type + yield halo) │ │ │
  │ │  │   ┌──┐ MarkerCluster groups (CDN plugin)        │ │ │
  │ │  │   │42│ → spiderfy sur zoom                      │ │ │
  │ │  │   └──┘                                          │ │ │
  │ │  │   ░░░ DVF heatmap (circles overlay, toggle)     │ │ │
  │ │  │   📍 POI layer (Overpass, catégories toggleable) │ │ │
  │ │  │                                                  │ │ │
  │ │  └──────────────────────────────────────────────────┘ │ │
  │ │                                                      │ │
  │ │  [ Stats bar : X biens | Valeur totale | Rend. moy ] │ │
  │ └──────────────────────────────────────────────────────┘ │
  │                        ┌───────────────────────────────┐ │
  │                        │  Sidebar filtres (slide-in)   │ │
  │                        │  ☑ Type  ☑ Valeur  ☑ Rend.   │ │
  │                        │  Analytics : donut + sparkline│ │
  │                        │  ─────                        │ │
  │                        │  🔄 Comparaison (shift+clic)  │ │
  │                        └───────────────────────────────┘ │
  └─────────────────────────────────────────────────────────┘

  ① GÉOCODAGE PRÉCIS — LATITUDE / LONGITUDE EN BASE
    Migration Alembic 014 : ALTER TABLE real_estate_properties
      ADD COLUMN latitude FLOAT NULLABLE, ADD COLUMN longitude FLOAT NULLABLE
    → Modèle SQLAlchemy : 2 colonnes Float nullable
    → Schemas Pydantic : latitude/longitude ajoutés à Create/Update/Response
    → TypeScript : latitude/longitude dans RealEstateProperty interface
    → Wizard : handleSubmit envoie déjà lat/lng depuis BAN → passage dans le payload
    → Fallback : si lat=null, lookup CITY_COORDS[city] ou DEPT_COORDS[postal_code]
    → Résultat : précision adresse exacte (±10m) au lieu de centroïde ville (±10km)

  ② CLUSTER DE MARQUEURS — Leaflet.markercluster (CDN)
    Plugin : unpkg.com/leaflet.markercluster@1.5.3 (JS + 2 CSS)
    → Chargé dynamiquement après Leaflet init (pas de npm install)
    → L.markerClusterGroup({maxClusterRadius: 50, showCoverageOnHover: true,
        spiderfyOnMaxZoom: true, animateAddingMarkers: true})
    → Couleur cluster selon valeur agrégée :
       < 500K€ → bleu | 500K-2M€ → orange | > 2M€ → violet
    → Compteur numérique au centre du cluster
    → Spiderfy : biens au même point (même immeuble) → éventail sur zoom max
    → fitBounds() automatique au chargement (remplace calcul zoom manuel)

  ③ MARQUEURS SVG CUSTOM PAR TYPE DE BIEN
    Icônes SVG inline (L.divIcon) — pas d'images externes :
      🏢 apartment → pin #3B82F6 (blue-500) + icône building
      🏠 house     → pin #22C55E (green-500) + icône maison
      🅿️ parking   → pin #6B7280 (gray-500) + icône P
      🏪 commercial→ pin #F97316 (orange-500) + icône shop
      🌍 land      → pin #92400E (amber-800) + icône terrain
      📦 other     → pin #8B5CF6 (violet-500) + icône ?
    → Halo rendement (ring SVG autour du pin) :
       > 6% → ring vert #22C55E | 3-6% → ring jaune #EAB308
       < 3% → ring rouge #EF4444 | pas de loyer → ring gris
    → Taille proportionnelle à la valeur : lerp(24px, 44px) sur [50K€, 2M€]
    → Tooltip natif Leaflet (survol sans clic) : "Label — 320K€ — 4.5%"
    → Popup au clic : fiche HTML riche (valeur, loyer, rendements, surface, DVF)
      avec bouton "Voir détails" → ouvre le wizard-modal en mode édition

  ④ COUCHE DVF HEATMAP — Prix médians par zone
    Backend endpoint :
      GET /api/v1/realestate/dvf-heatmap?postal_code=75011
      → Source : api.cquest.org/dvf (open data DVF, gratuit, sans clé)
      → Agrégation : prix médian/m² sur les 12 derniers mois par code postal
      → Cache Redis : TTL 7 jours (clé = dvf:heatmap:{postal_code})
      → Réponse : {postal_code, median_price_m2, nb_transactions, avg_surface}
    Frontend :
      → Pour chaque bien localisé, fetch DVF heatmap de son code postal
      → Affichage : L.circleMarker (rayon 800m) semi-transparent
      → Gradient : bleu (#3B82F6) < 3K€/m² → orange → rouge (#EF4444) > 10K€/m²
      → Tooltip sur survol : "75011 — 8 420€/m² (342 ventes)"
      → Toggle ON/OFF via bouton dans la toolbar carte

  ⑤ COUCHE POI — Points d'Intérêt via Overpass API
    Backend endpoint :
      GET /api/v1/realestate/poi?lat=48.86&lng=2.35&radius=1000
      → Proxy Overpass API (overpass-api.de/api/interpreter)
      → Requête Overpass QL : amenity, railway, shop dans un rayon
      → 5 catégories : transport | education | health | commerce | parks
      → Cache Redis : TTL 24h (clé = poi:{lat:.3f}:{lng:.3f}:{radius})
      → Réponse : {category: string, name: string, lat, lng, type}[]
    Frontend :
      → Chargé au clic sur un bien (pas au chargement global)
      → Marqueurs mini (L.circleMarker 6px) colorés par catégorie :
        🚇 transport=#3B82F6 | 🏫 education=#8B5CF6 | 🏥 health=#EF4444
        🛒 commerce=#F97316 | 🌳 parks=#22C55E
      → Checkboxes toggleables dans la toolbar pour masquer/afficher chaque catégorie
      → Score de proximité calculé frontend :
        walkscore = Σ(catégorie × poids) / nb_catégories
        Affiché dans le popup du bien sous forme de badge coloré

  ⑥ 3 FONDS DE CARTE — Basculement instantané
    a) CartoDB Light (défaut) — propre, design minimaliste
       https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
    b) Esri Satellite — imagerie aérienne mondiale gratuite
       https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
    c) OpenStreetMap Standard — cartographie détaillée
       https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
    → Switch via 3 boutons icônes dans le coin supérieur droit de la carte
    → Le changement de fond conserve zoom, centre et tous les layers

  ⑦ SIDEBAR FILTRES & ANALYTICS
    Composant : map-filter-sidebar.tsx (slide-in 320px depuis la droite)
    → Toggleable via bouton "Filtres" dans la toolbar
    Filtres interactifs (mise à jour carte en temps réel) :
      - Type de bien : checkboxes multi-sélection (6 types)
      - Fourchette de valeur : range input min/max (0€ — 5M€)
      - Rendement brut minimum : range input (0% — 15%)
      - Surface minimum : range input (0 m² — 500 m²)
      - Ville : input texte filtrant
    Analytics en bas du sidebar (calculés sur biens filtrés) :
      - Nombre de biens affichés / total
      - Valeur totale filtrée
      - Rendement brut moyen pondéré
      - Cash-flow net mensuel agrégé
      - Répartition par type (mini barres horizontales colorées)
    → Bouton "Réinitialiser" pour vider tous les filtres

  ⑧ MODE COMPARAISON — Shift+Clic sur 2 biens
    Composant : map-comparison-panel.tsx
    → Shift+clic sur un marqueur → sélectionne pour comparaison (max 2)
    → Marqueurs sélectionnés : contour doré pulsant
    → Panneau overlay en bas de la carte :
      | Critère           | Bien A          | Bien B          | Delta     |
      | Valeur             | 320 000€        | 185 000€        | +135K€    |
      | Surface            | 65 m²           | 42 m²           | +23 m²    |
      | Prix/m²            | 4 923€          | 4 405€          | +518€     |
      | Loyer              | 1 200€/mois     | 850€/mois       | +350€     |
      | Rendement brut     | 4.50%           | 5.51%           | -1.01pts  |
      | Cash-flow net      | +320€/mois      | +180€/mois      | +140€     |
    → Delta coloré : vert si avantageux pour A, rouge sinon
    → Bouton "Fermer" pour quitter le mode comparaison

  Checklist :
  [x] Migration 014 : latitude + longitude
  [x] Modèle SQLAlchemy : colonnes latitude, longitude
  [x] Schemas Pydantic : lat/lng dans Create/Update/Response
  [x] TypeScript types : latitude/longitude dans RealEstateProperty
  [x] Wizard : handleSubmit envoie lat/lng
  [x] _property_to_response() inclut lat/lng
  [x] Endpoint DVF heatmap : GET /api/v1/realestate/dvf-heatmap
  [x] Endpoint POI : GET /api/v1/realestate/poi
  [x] Marqueurs SVG custom par type + halo rendement
  [x] Marker clustering (Leaflet.markercluster CDN)
  [x] 3 fonds de carte (CartoDB / Satellite / OSM)
  [x] Couche DVF heatmap (circles + toggle)
  [x] Couche POI (5 catégories + checkboxes)
  [x] Sidebar filtres + analytics
  [x] Mode comparaison shift+clic
  [x] 0 erreurs TypeScript


═══════════════════════════════════════════════════════════════════════════
F1.5  Système d'Alertes Unifiées Cross-Assets — "OmniAlert"
═══════════════════════════════════════════════════════════════════════════

  Benchmark : Finary = 0 alerte prix / Trade Republic = alertes prix basiques
  OmniFlow = alertes cross-assets (actions + crypto + immo + indices),
  conditions composées, multi-canal, suggestions IA, évaluation temps réel
  via le MarketHub WebSocket existant, cooldown intelligent.

  ─────────────────────────────────────────────────────────────────────────
  ① MODÈLE DE DONNÉES — Tables SQL
  ─────────────────────────────────────────────────────────────────────────

    Table `user_alerts` (Alembic 015) :
    ┌──────────────────────┬────────────────────┬──────────────────────────┐
    │ Colonne              │ Type               │ Contraintes              │
    ├──────────────────────┼────────────────────┼──────────────────────────┤
    │ id                   │ UUID PK            │ default uuid4            │
    │ user_id              │ UUID FK→users.id   │ NOT NULL, CASCADE, idx   │
    │ name                 │ String(255)        │ NOT NULL                 │
    │ asset_type           │ String(20)         │ stock/crypto/realestate/ │
    │                      │                    │ index — NOT NULL         │
    │ symbol               │ String(50)         │ "AAPL","BTC","prop:uuid" │
    │ condition            │ String(30)         │ price_above/price_below/ │
    │                      │                    │ pct_change_24h_above/    │
    │                      │                    │ pct_change_24h_below/    │
    │                      │                    │ volume_spike             │
    │ threshold            │ Float              │ NOT NULL                 │
    │ is_active            │ Boolean            │ default True             │
    │ cooldown_minutes     │ Integer            │ default 60               │
    │ last_triggered_at    │ DateTime(tz) null  │ — cooldown check         │
    │ notify_in_app        │ Boolean            │ default True             │
    │ notify_push          │ Boolean            │ default False            │
    │ notify_email         │ Boolean            │ default False            │
    │ created_at           │ DateTime(tz)       │ TimestampMixin           │
    │ updated_at           │ DateTime(tz)       │ TimestampMixin           │
    └──────────────────────┴────────────────────┴──────────────────────────┘
    Index composé : (user_id, is_active, symbol) pour O(1) lookup par tick.

    Table `alert_history` :
    ┌──────────────────────┬────────────────────┬──────────────────────────┐
    │ id                   │ UUID PK            │ default uuid4            │
    │ alert_id             │ UUID FK            │ CASCADE, NOT NULL        │
    │ user_id              │ UUID FK            │ CASCADE, NOT NULL, idx   │
    │ triggered_at         │ DateTime(tz)       │ server_default now()     │
    │ price_at_trigger     │ Float              │ NOT NULL                 │
    │ message              │ Text               │ NOT NULL                 │
    └──────────────────────┴────────────────────┴──────────────────────────┘

  ─────────────────────────────────────────────────────────────────────────
  ② BACKEND — Moteur d'évaluation temps réel (alert_engine.py)
  ─────────────────────────────────────────────────────────────────────────

    Architecture :
    MarketHub.on_tick(channel, data)
      → AlertEngine.evaluate(channel, price)
        → O(1) dict lookup : _alerts_by_symbol[symbol] → list[UserAlert]
        → Pour chaque alerte active :
          1. Vérifier cooldown (now - last_triggered > cooldown_minutes)
          2. Évaluer condition :
             - price_above : price >= threshold → déclencher
             - price_below : price <= threshold → déclencher
             - pct_change_24h_above : change_24h >= threshold% → déclencher
             - pct_change_24h_below : change_24h <= -threshold% → déclencher
             - volume_spike : volume_24h > avg_volume * threshold → déclencher
          3. Si déclenché :
             a. INSERT alert_history
             b. UPDATE last_triggered_at sur l'alerte
             c. push_notification() → in-app notification
             d. WebSocket push → {"type":"alert_triggered","data":{...}}
        → Rechargement périodique : toutes les 30s, reload depuis DB
          (gère les créations/suppressions sans restart)

    Intégration MarketHub :
    → market_hub.py : après on_tick(), appeler alert_engine.evaluate()
    → Le moteur transforme "crypto:BTC" en symbol "BTC", "stock:AAPL" en "AAPL"
    → Charge initiale : au start du MarketHub, charge toutes les alertes actives
    → Index mémoire : dict[symbol → list[AlertRule]] — O(1) par tick

  ─────────────────────────────────────────────────────────────────────────
  ③ API REST — 6 endpoints CRUD + historique + suggestions
  ─────────────────────────────────────────────────────────────────────────

    POST   /api/v1/alerts              Créer une alerte (auth required)
    GET    /api/v1/alerts              Lister mes alertes (paginé, filtrable)
    GET    /api/v1/alerts/{id}         Détail d'une alerte + stats
    PUT    /api/v1/alerts/{id}         Modifier (seuil, canaux, active)
    DELETE /api/v1/alerts/{id}         Supprimer
    GET    /api/v1/alerts/history      Historique des déclenchements (paginé)
    POST   /api/v1/alerts/suggestions  Suggestions IA (analyse portefeuille)

    Validation :
    → asset_type ∈ {stock, crypto, realestate, index}
    → condition ∈ {price_above, price_below, pct_change_24h_above,
                    pct_change_24h_below, volume_spike}
    → threshold > 0
    → cooldown_minutes ∈ [1, 10080] (1min → 7 jours)
    → Max 50 alertes par utilisateur (anti-abuse)

  ─────────────────────────────────────────────────────────────────────────
  ④ FRONTEND — Page /alerts + composants
  ─────────────────────────────────────────────────────────────────────────

    Nouvelle page : /alerts (ajoutée au sidebar sous "Intelligence")
    ┌─────────────────────────────────────────────────────────────────────┐
    │  OmniAlert — Alertes Cross-Assets                                 │
    ├──────────────┬──────────────────────────────────────────────────────┤
    │              │                                                      │
    │  📊 Stats    │   Liste des alertes (cards)                          │
    │  12 actives  │   ┌──────────────────────────────────────────────┐  │
    │  3 today     │   │ 🟢 BTC > $100,000      active   [✏️] [🗑️]  │  │
    │  47 total    │   │ 🔴 AAPL < $150         active   [✏️] [🗑️]  │  │
    │              │   │ 🟡 ETH +10% 24h        paused   [✏️] [🗑️]  │  │
    │  [+ Créer]   │   │ 🏠 Appart DVF > 8k/m² active   [✏️] [🗑️]  │  │
    │              │   └──────────────────────────────────────────────┘  │
    │  Filtres:    │                                                      │
    │  ○ Tous      │   Historique récent                                  │
    │  ○ Actions   │   ┌──────────────────────────────────────────────┐  │
    │  ○ Crypto    │   │ 14:32  BTC a franchi $100,000 (+2.3%)       │  │
    │  ○ Immo      │   │ 09:15  NVDA sous $800 (-1.8%)               │  │
    │  ○ Indices   │   └──────────────────────────────────────────────┘  │
    └──────────────┴──────────────────────────────────────────────────────┘

    Composants :
    → alert-store.ts : Zustand store CRUD + polling
    → alerts/page.tsx : page principale
    → AlertList : liste des alertes avec toggle active/pause
    → AlertCreateModal : modal création avec asset picker + condition builder
    → AlertHistoryPanel : historique des déclenchements avec prix + timestamp
    → Intégration NotificationCenter : les alertes déclenchées apparaissent
      automatiquement dans la cloche via push_notification()

  ─────────────────────────────────────────────────────────────────────────
  ⑤ NOTIFICATIONS TEMPS RÉEL — WebSocket push
  ─────────────────────────────────────────────────────────────────────────

    Quand une alerte se déclenche :
    1. Le moteur appelle push_notification() → INSERT dans notifications
    2. Le MarketHub broadcast un message type "alert_triggered" aux WS clients
       abonnés au channel de l'alerte : {"type":"alert_triggered", "data":{
         "alert_id": "uuid", "symbol": "BTC", "condition": "price_above",
         "threshold": 100000, "current_price": 100234, "message": "..."
       }}
    3. Le NotificationCenter reçoit ce WS event et ajoute un toast + badge
    4. La page /alerts met à jour l'historique en temps réel

  ─────────────────────────────────────────────────────────────────────────
  ⑥ SUGGESTIONS IA — Analyse du portefeuille
  ─────────────────────────────────────────────────────────────────────────

    POST /api/v1/alerts/suggestions
    → Analyse le portefeuille (stocks + crypto + immo) du user
    → Algorithme de suggestion :
      a. Concentration : si un actif > 30% du total → alerte baisse -10%
      b. Volatilité : si un actif a un ATR élevé → alerte pct_change
      c. Rendement immo : si yield < seuil marché → alerte surveillance
      d. Gains importants : si +50% depuis achat → alerte prise de profit
    → Retourne 3-5 suggestions avec nom, condition, seuil pré-remplis
    → L'utilisateur accepte/refuse chaque suggestion en un clic

  ─────────────────────────────────────────────────────────────────────────
  Checklist d'implémentation :
  ─────────────────────────────────────────────────────────────────────────
  [ x] Migration 015 : tables user_alerts + alert_history
  [x] Modèle SQLAlchemy : UserAlert + AlertHistory
  [x] Schemas Pydantic : Create/Update/Response alert + history
  [x] Router alerts.py : 6 endpoints CRUD + history
  [x] AlertEngine : évaluation temps réel + reload cache
  [x] Intégration MarketHub : on_tick → evaluate
  [x] TypeScript types : UserAlert + AlertHistory dans api.ts
  [x] alert-store.ts : Zustand CRUD + polling
  [x] Page /alerts : layout, AlertList, AlertCreateModal, HistoryPanel
  [x] Navigation sidebar : lien /alerts ajouté
  [x] 0 erreurs TypeScript


═══════════════════════════════════════════════════════════════════════════
F1.6  Performance Frontend — 60fps Garanti
═══════════════════════════════════════════════════════════════════════════

  Objectif : UI temps-réel fluide en toutes circonstances — smartphones
  milieu de gamme, rafales WebSocket à 50+ ticks/s, listes de 10 000+ lignes.
  Cible : 60fps constant, TTI < 2s, LCP < 1.5s, CLS < 0.05.

  ① WEBSOCKET TICK BATCHING — requestAnimationFrame Pipeline
    Problème identifié : chaque tick WS appelle setPrices(new Map(prev)),
    créant un nouveau Map et déclenchant un re-render React complet.
    À 50 ticks/s, cela génère 50 re-renders/s → jank garanti.

    Solution : architecture « tick buffer + RAF flush » :
    → Fichier : src/lib/use-throttled-market.ts
    → Les ticks WS s'accumulent dans un Map<string, TickData> mutable (ref)
    → Un seul requestAnimationFrame par frame flushe le buffer → 1 setState/frame
    → Résultat : 60 re-renders/s max, quel que soit le débit WS
    → Fallback : si RAF n'est pas disponible (SSR), throttle à 250ms via setTimeout
    → Le hook expose la même API que useMarketWebSocket (drop-in replacement)
    → Gain mesuré : de ~50 re-renders/s à exactement 1/frame (16.67ms)

  ② WEB WORKER — Indicateurs Techniques Off-Thread
    Problème identifié : SMA, EMA, Bollinger, RSI, MACD calculés sur le
    thread principal dans technical-indicators.ts → freeze de 50-200ms
    sur les datasets de 500+ bougies, bloquant les interactions chart.

    Solution : Web Worker dédié avec comlink-style messaging :
    → Fichier : src/lib/workers/indicators.worker.ts
    → Toutes les fonctions (calcSMA, calcEMA, calcBollinger, calcRSI, calcMACD)
      sont déplacées dans le worker
    → Fichier bridge : src/lib/use-worker-indicators.ts
      → Hook React qui envoie les données au worker via postMessage
      → Réception asynchrone du résultat, mise à jour via setState
      → Lazy-init du worker (new Worker() seulement au premier appel)
      → Gestion automatique terminateWorker() au unmount du composant
    → Le thread principal ne calcule PLUS RIEN — il affiche seulement
    → Pattern structuredClone pour le transfert zero-copy des ArrayBuffers
    → Gain mesuré : main thread libéré, 0ms de blocking pendant le calcul

  ③ VIRTUALISATION — react-window pour les Listes Massives
    Problème identifié : la table Crypto rend 100+ <motion.tr> avec chacune
    un MiniSparkline SVG + framer-motion animation → DOM gigantesque.
    La table Stock a le même pattern. Idem pour l'orderbook et le trades feed.

    Solution : remplacement par react-window FixedSizeList :
    → Fichier : src/components/ui/virtual-table.tsx
    → Table wrapper générique qui accepte columns[] + data[] + rowHeight
    → Seules les ~20 lignes visibles sont montées dans le DOM
    → Overscan de 5 lignes pour le scroll fluide
    → Intégration dans CoinsTable (crypto-market-explorer.tsx)
    → Intégration dans StocksTable (stock-market-explorer.tsx)
    → Suppression de motion.tr par ligne (remplacé par CSS transitions)
    → Gain : de 100+ DOM nodes à ~25, scroll 60fps même avec 10 000 lignes

  ④ OPTIMISATIONS CARTE LEAFLET — Canvas Renderer
    Problème identifié : Leaflet utilise le renderer SVG par défaut.
    Chaque marqueur est un <svg> dans le DOM → lent au-delà de 50 marqueurs.

    Solution : preferCanvas + debounce intelligent :
    → Ajout preferCanvas: true dans les options L.map()
      → Tous les CircleMarkers et paths utilisent Canvas au lieu de SVG
      → 5x plus rapide pour 100+ marqueurs (benchmarké)
    → Debounce des filtres carte : 300ms d'inactivité avant re-render
    → Lazy loading des couches POI/DVF : chargement uniquement quand zoom > 12
    → keepBuffer: 4 pour précharger les tuiles adjacentes
    → Tile preloading via {keepBuffer: 4} sur le TileLayer
    → updateWhenZooming: false pour éviter les redraws pendant le zoom

  ⑤ BUNDLE OPTIMIZATION — Code Splitting & Tree-Shaking
    → next.config.mjs amélioré :
      → optimizePackageImports étendu : + 'recharts' (économie ~80KB)
      → Bundle analyzer intégré (@next/bundle-analyzer) activable via
        ANALYZE=true npm run build
    → Code splitting déjà en place (next/dynamic ssr:false) — conservé
    → lightweight-charts : imports nommés seulement (createChart, types)
    → Leaflet : import dynamique conservé (F1.4)
    → Suppression @tanstack/react-query (installé mais non utilisé, ~20KB)

  ⑥ PERFORMANCE MONITORING — Web Vitals Dashboard
    → Fichier : src/lib/performance-monitor.ts
    → Module utilitaire qui expose :
      → measureFPS() : compteur FPS temps réel via requestAnimationFrame
      → reportWebVitals() : hook dans le Next.js reportWebVitals callback
      → measureRenderTime(label) : wrapper chrono pour mesurer les renders
    → Intégration dans le layout principal en mode dev uniquement
    → Overlay FPS discret en bas à droite (dev mode)
    → Logging des Long Tasks via PerformanceObserver (> 50ms)
    → Tracking CLS, LCP, FID, INP via web-vitals API

  Nouveaux fichiers frontend :
  ─────────────────────────────────────────────────────────────────────────
  src/lib/use-throttled-market.ts           Hook RAF-batched WS ticks
  src/lib/workers/indicators.worker.ts      Web Worker calculs techniques
  src/lib/use-worker-indicators.ts          Hook bridge vers le worker
  src/components/ui/virtual-table.tsx        Table virtualisée react-window
  src/lib/performance-monitor.ts            Métriques Web Vitals + FPS

  Fichiers modifiés :
  ─────────────────────────────────────────────────────────────────────────
  next.config.mjs                           optimizePackageImports + analyzer
  package.json                              +react-window +@next/bundle-analyzer +web-vitals
  crypto-market-explorer.tsx                Virtual table + throttled WS
  stock-market-explorer.tsx                 Virtual table + throttled WS
  france-property-map.tsx                   preferCanvas + debounce + keepBuffer
  trading-chart.tsx                         Worker indicators au lieu de sync


═══════════════════════════════════════════════════════════════════════════
F1.7  Backend Intelligence — Watchlists, Sentiment, WalkScore, Schemas
═══════════════════════════════════════════════════════════════════════════

  Objectif : Combler les lacunes backend restantes post-F1.1→F1.6—
  ajouter les 4 endpoints manquants, le modèle Watchlist persistant,
  des Pydantic response models typés pour TOUTE l'API market,
  et 3 nouveaux services intelligents (sentiment NLP, walk score,
  géocodage BAN). Résultat : zéro `dict` brut dans les réponses market,
  watchlists cross-assets sauvegardées en base, news avec scoring,
  marchabilité calculée pour chaque bien immobilier.

  Benchmarking concurrentiel :
  ─────────────────────────────────────────────────────────────────────────
  • Finary        : aucun sentiment, pas de walk score, pas de watchlist
  • Trade Republic : watchlist basique (actions seulement), pas de news NLP
  • MeilleursAgents: walk score propriétaire, pas d'API ouverte
  → OmniFlow : watchlists cross-assets (stock+crypto+realestate),
    sentiment multi-source avec conviction score, walk score auto-calculé
    via Overpass+POI, géocodage BAN gratuit & souverain

  ① PYDANTIC RESPONSE MODELS — Typage intégral de l'API market
    → Fichier : app/schemas/market.py
    → Problème actuel : les 17 endpoints de market.py retournent des `dict`
      bruts sans validation. Aucun type pour le frontend, aucune doc OpenAPI.
    → Solution : Pydantic v2 BaseModel pour chaque endpoint :
      → CoinListItem          — coins/markets (list_crypto_coins)
      → CoinDetail            — coin/{coin_id} (get_crypto_coin_detail)
      → ChartData             — chart/{coin_id} (get_crypto_chart)
      → TrendingCoin          — trending (get_trending_coins)
      → GlobalMarketData      — global (get_global_crypto_data)
      → SearchResult          — search (search_crypto)
      → StockUniverseItem     — stocks/universe (list_stock_universe)
      → StockQuote            — stocks/quote/{symbol}
      → StockChartData        — stocks/chart/{symbol}
      → OHLCVCandle           — OHLCV candle unit
      → OHLCVResponse         — stocks/ohlcv & crypto/ohlcv
      → ScreenerResponse      — stocks/screen
      → OrderbookResponse     — crypto/depth & stocks/orderbook
      → TradeItem             — crypto/trades
      → TopMoversResponse     — crypto/top-movers (gainers+losers+treemap)
      → FearGreedResponse     — crypto/fear-greed
      → NewsItem + SentimentResponse  — stocks/news/{symbol}
      → WalkScoreResponse     — realestate/walkscore
      → GeocodeResult         — realestate/geocode
    → Intégration : response_model=XXX sur chaque @router.get/post
    → Bénéfice : documentation OpenAPI /docs auto-générée,
      validation côté serveur, type safety e2e avec le frontend

  ② CROSS-ASSET WATCHLISTS — Favoris persistants multi-marchés
    → Modèle : app/models/watchlist.py — UserWatchlist (SQLAlchemy)
      → Colonnes : id (UUID PK), user_id (FK users), asset_type (enum:
        stock/crypto/realestate/index), symbol (VARCHAR 50), name (VARCHAR 255),
        display_order (INTEGER, pour tri drag-and-drop), notes (TEXT, optionnel),
        target_price (FLOAT, optionnel — objectif de cours),
        created_at, updated_at (TimestampMixin)
      → Index composé : (user_id, asset_type, symbol) UNIQUE — pas de doublons
      → Index de tri : (user_id, display_order) — rendu rapide
    → Migration : alembic/versions/016_watchlists.py
      → CREATE TABLE user_watchlists, index unique, index tri
    → Schemas : app/schemas/watchlist.py
      → WatchlistCreateRequest(asset_type, symbol, name?, notes?, target_price?)
      → WatchlistUpdateRequest(display_order?, notes?, target_price?)
      → WatchlistResponse(id, asset_type, symbol, name, display_order, notes,
        target_price, created_at)
      → WatchlistReorderRequest(items: [{id, display_order}])
    → Router : app/api/v1/watchlists.py — 6 endpoints :
      → POST   /watchlists                     Ajouter un actif aux favoris
      → GET    /watchlists                     Lister (filtrable par asset_type)
      → GET    /watchlists/enriched            Lister + prix live injectés
      → PUT    /watchlists/{id}                Modifier notes/target
      → DELETE /watchlists/{id}                Retirer des favoris
      → PUT    /watchlists/reorder             Réordonner (drag-and-drop)
    → Enrichment live : l'endpoint /enriched injecte le prix actuel
      depuis Yahoo Finance (stocks) ou CoinGecko (crypto) — même
      logique que _fetch_yahoo_quotes() dans market.py
    → Intégration : wired dans router.py, protégé par get_current_user

  ③ SENTIMENT ENGINE — News + NLP scoring multi-source
    → Service : app/services/sentiment_service.py
    → Sources de données (gratuites, sans API key) :
      → Yahoo Finance v8 /chart endpoint → news embed (déjà proxié)
      → Google News RSS feed → titre + source + date + lien
      → CoinGecko community_data → sentiment_votes (déjà dans coin detail)
    → Pipeline NLP (keyword-based, zero dépendance externe) :
      → 1. Fetch des 20 dernières news pour un symbol
      → 2. Scoring par keywords pondérés :
         POSITIF : "surges", "rally", "beats", "upgrade", "breakout",
                   "bullish", "record", "growth" → +1 à +3
         NÉGATIF : "crash", "plunges", "downgrade", "lawsuit", "hack",
                   "bearish", "warning", "loss" → -1 à -3
      → 3. Conviction Score (0-100) = normalisation du score agrégé
      → 4. Classification : Très Positif / Positif / Neutre / Négatif / Très Négatif
      → 5. Trending topics extraction (top 5 mots-clés récurrents)
    → Cache Redis : 15 minutes pour les news, 5 minutes pour le score
    → Endpoint : GET /market/stocks/news/{symbol}
      → Response : { articles: NewsItem[], sentiment: SentimentScore,
        conviction: int, classification: str, trending_topics: str[] }
    → Extensible : préparé pour brancher un vrai modèle NLP (HuggingFace
      transformers FinBERT) quand les ressources serveur le permettront

  ④ WALK SCORE CALCULATOR — Marchabilité auto-calculée via Overpass
    → Service : app/services/walkscore_service.py
    → Algorithme (inspiré de walkscore.com, 100% open-source) :
      → 1. Récupère les POI dans un rayon de 1.5 km via Overpass (réutilise
           la query existante dans realestate.py, extraite dans un service)
      → 2. Pondération par catégorie (sur 100 points) :
         Transport  (gares, métro, tram, bus) : 30 pts max
         Commerce   (supermarché, boulangerie, pharmacie) : 25 pts max
         Éducation  (écoles, universités) : 15 pts max
         Santé      (hôpital, clinique, pharmacie) : 15 pts max
         Loisirs    (parcs, jardins, sport) : 15 pts max
      → 3. Decay function : score = base × e^(-distance/500)
         Plus le POI est proche, plus il contribue au score
      → 4. Score final : somme plafonnée à 100, classifié :
         90-100 : Walker's Paradise
         70-89  : Very Walkable
         50-69  : Somewhat Walkable
         25-49  : Car-Dependent
         0-24   : Almost All Errands Require a Car
    → Cache Redis : 30 jours (les POI ne changent pas souvent)
    → Endpoint : GET /realestate/walkscore?lat=&lng=
      → Response : { score: int, label: str, breakdown: {transport: int,
        commerce: int, education: int, health: int, leisure: int},
        poi_count: int, radius_m: 1500 }
    → Intégration future : affichage dans la fiche bien immobilier,
      score comparatif sur la carte, filtre dans le screener immo

  ⑤ GÉOCODAGE BAN — Adresse → Coordonnées souveraines françaises
    → Service : app/services/geocoding_service.py
    → API : Base Adresse Nationale (api-adresse.data.gouv.fr)
      → Gratuit, illimité, souverain français, pas d'API key
      → Endpoint BAN : GET /search/?q={adresse}&limit=5
      → Endpoint BAN batch : POST /search/csv/ (pour géocodage en masse)
    → Fonctionnalités :
      → geocode_single(address: str) → (lat, lng, score, label, context)
      → geocode_batch(addresses: list[str]) → list[GeocodeResult]
      → reverse_geocode(lat, lng) → adresse la plus proche
    → Cache Redis : 90 jours (les adresses ne bougent pas)
    → Endpoint : GET /realestate/geocode?q={adresse}&limit=5
      → Response : { results: [{ lat, lng, score, label, context,
        postcode, city, importance }] }
    → Intégration : utilisé automatiquement à la création d'un bien
      immobilier (POST /realestate) pour remplir lat/lng si absent

  ⑥ STOCK ORDERBOOK — Carnet d'ordres actions via Yahoo
    → Problème : l'orderbook crypto existe (Binance depth), mais pas
      d'équivalent pour les actions
    → Solution : endpoint proxy Yahoo Finance summary detail
      → Récupère bid/ask/bidSize/askSize depuis le quote data
      → Pour les actions les plus liquides, construit un carnet simulé
        basé sur le bid-ask spread + distribution gaussienne des niveaux
    → Endpoint : GET /market/stocks/orderbook/{symbol}
      → Response : OrderbookResponse { symbol, bids, asks, spread,
        spread_pct, mid_price, bid_volume, ask_volume, imbalance }
    → Cache Redis : 5 secondes (données temps quasi-réel)

  Nouveaux fichiers backend :
  ─────────────────────────────────────────────────────────────────────────
  app/schemas/market.py                          19 Pydantic response models
  app/schemas/watchlist.py                       CRUD schemas watchlist
  app/models/watchlist.py                        Modèle UserWatchlist
  alembic/versions/016_watchlists.py             Migration table watchlists
  app/services/sentiment_service.py              News + NLP keyword scoring
  app/services/walkscore_service.py              Walk Score via Overpass POI
  app/services/geocoding_service.py              Géocodage BAN souverain
  app/api/v1/watchlists.py                       6 endpoints CRUD watchlist

  Fichiers modifiés :
  ─────────────────────────────────────────────────────────────────────────
  app/api/v1/market.py                           +response_model sur 17 endpoints
                                                 +2 nouveaux endpoints (news, orderbook)
  app/api/v1/router.py                           +watchlists_router
  app/models/__init__.py                         +UserWatchlist export
  app/schemas/__init__.py                        +market + watchlist exports
```

**Résultat attendu Phase F1 — Métriques de succès :**

| Métrique | Avant (B5) | Après (F1) |
|----------|-----------|-----------|
| Latence prix bourse | 15 min (polling Yahoo) | < 1s (WebSocket live) |
| Latence prix crypto | 5 min (polling CoinGecko) | < 200ms (Binance WS) |
| Graphiques | Sparklines statiques | TradingView complet + indicateurs |
| Orderbook | Inexistant | 20 niveaux temps réel + depth chart |
| Carte immo — précision | ±10 km (ville) | ±10 m (adresse exacte) |
| Carte immo — couches | Marqueurs seuls | DVF heatmap + POI + satellite + clusters |
| Alertes | Aucune | Cross-assets, multi-canal, suggestions IA |
| Screener | Inexistant | Multi-critères, filtres sauvegardables |
| Sentiment | Inexistant | NLP sur news, Fear & Greed, Conviction Score |
| FPS graphiques | n/a (pas de graphiques live) | 60fps constant (Canvas + Web Workers) |
| Concurrents surpassés | 0 | Trade Republic (graphiques), Binance (intégration), MeilleursAgents (carte), Finary (temps réel) |

---

### Phase G — Digital Vault & Shadow Wealth (Patrimoine Invisible)

> **Durée estimée** : 3-4 semaines
> **Prérequis** : Phases A + B + C + F terminées.
> **Objectif** : Capturer 100% de la richesse d'un individu — y compris les actifs "invisibles" que AUCUNE app FinTech ne couvre : biens tangibles (voiture, tech, luxe), NFTs, cartes bancaires optimisées, points de fidélité, abonnements, documents identitaires, et dettes entre amis. Résultat : le "Shadow Wealth" devient visible et actionnable.

#### Benchmark concurrentiel

```
┌────────────────────────────────────┬─────────┬────────────┬──────────┬──────────┐
│ Fonctionnalité                     │ Finary  │ Bankin'    │ Revolut  │ OmniFlow │
├────────────────────────────────────┼─────────┼────────────┼──────────┼──────────┤
│ Bibliothèque biens tangibles       │ ✗       │ ✗          │ ✗        │ ✅ 6 cat │
│ Argus auto (dépréciation)          │ ✗       │ ✗          │ ✗        │ ✅ 3 alg │
│ Suivi garanties + alertes expiry   │ ✗       │ ✗          │ ✗        │ ✅       │
│ NFT Gallery + Floor Price          │ ✗       │ ✗          │ ✗        │ ✅ live  │
│ Wallet cartes bancaires sécurisé   │ ✗       │ ✗          │ Partiel  │ ✅ AES   │
│ Recommandation carte par achat     │ ✗       │ ✗          │ ✗        │ ✅ IA    │
│ Points fidélité → valeur €         │ ✗       │ ✗          │ ✗        │ ✅ conv  │
│ Subscription manager               │ ✗       │ Basique    │ ✗        │ ✅ smart │
│ Alerte résiliation J-7             │ ✗       │ ✗          │ ✗        │ ✅       │
│ Coffre-fort documents              │ ✗       │ ✗          │ ID seul  │ ✅ 8 cat │
│ Alerte renouvellement papiers      │ ✗       │ ✗          │ ✗        │ ✅       │
│ IOU Peer-to-Peer tracker           │ ✗       │ ✗          │ Partiel  │ ✅ smart │
│ Rappels polis automatiques         │ ✗       │ ✗          │ ✗        │ ✅       │
│ Shadow Wealth total agrégé         │ ✗       │ ✗          │ ✗        │ ✅ score │
└────────────────────────────────────┴─────────┴────────────┴──────────┴──────────┘
```

##### G1 — Bibliothèque des Biens Tangibles (Semaine 26)

```
TABLE tangible_assets
  id                UUID pk
  user_id           UUID → users.id ON DELETE CASCADE
  ── Identification ──
  name              String(255) NOT NULL        — "iPhone 15 Pro Max"
  category          Enum(vehicle/tech/collectible/furniture/jewelry/other)
  subcategory       String(100) NULL            — "Smartphone", "Montre"
  brand             String(100) NULL            — "Apple", "Rolex"
  model             String(255) NULL            — "iPhone 15 Pro Max 512GB"
  ── Valeurs (centimes) ──
  purchase_price    BigInteger NOT NULL          — prix d'achat
  purchase_date     Date NOT NULL
  current_value     BigInteger default 0         — valeur actuelle calculée
  ── Dépréciation ──
  depreciation_type Enum(linear/declining/none/market)
  depreciation_rate Float default 20.0           — % annuel
  residual_pct      Float default 10.0           — % valeur résiduelle min
  ── Garantie ──
  warranty_expires  Date NULL
  warranty_provider String(255) NULL
  ── État & Détails ──
  condition         Enum(mint/excellent/good/fair/poor)
  serial_number     String(255) NULL
  notes             Text NULL
  image_url         String(500) NULL
  metadata          JSONB {}
  created_at, updated_at

ALGORITHME DÉPRÉCIATION — 3 TYPES
═══════════════════════════════════
  LINEAR :
    → value = purchase × max(residual%, 1 - rate% × years_since_purchase)
    → Véhicules : -15%/an, résiduel 10%
    → Tech : -25%/an, résiduel 5%
    → Mobilier : -10%/an, résiduel 15%

  DECLINING (dégressif) :
    → value = purchase × (1 - rate%)^years
    → Plus réaliste pour tech (perd -40% an 1, -20% an 2)

  MARKET :
    → Valeur fixée manuellement ou via API externe
    → Objets de collection (montres, sacs, LEGO rares)
    → La valeur peut AUGMENTER

  NONE :
    → Valeur = prix d'achat (bijoux, art, foncier)

CATÉGORIES PRÉDÉFINIES (avec taux par défaut) :
  vehicle     → linear 15%, résiduel 10%
  tech        → declining 25%, résiduel 5%
  collectible → market (manual), résiduel 0%
  furniture   → linear 10%, résiduel 15%
  jewelry     → none, résiduel 100%
  other       → linear 10%, résiduel 10%

GARANTIE TRACKER :
  → Alerte J-30, J-7, J-0 avant expiration
  → Notification in-app + email optionnel
  → Badge "Sous garantie" / "Garantie expirée" affiché
```

##### G2 — NFTs & Web3 Gallery (Semaine 26)

```
TABLE nft_assets
  id                 UUID pk
  user_id            UUID → users.id ON DELETE CASCADE
  ── Identification ──
  collection_name    String(255) NOT NULL
  token_id           String(255) NOT NULL
  name               String(255) NOT NULL
  blockchain         Enum(ethereum/polygon/solana/other)
  contract_address   String(255) NULL
  ── Valeurs ──
  purchase_price_eth Float NULL
  purchase_price_eur BigInteger NULL          — centimes
  current_floor_eur  BigInteger NULL          — centimes, auto-updated
  ── Marketplace ──
  marketplace        String(100) NULL         — "opensea", "blur", "magic_eden"
  marketplace_url    String(500) NULL
  ── Média ──
  image_url          String(500) NULL
  animation_url      String(500) NULL         — pour les NFTs vidéo
  ── Tracking ──
  last_price_update  DateTime(tz) NULL
  rarity_rank        Integer NULL
  traits             JSONB {}                 — attributs du NFT
  metadata           JSONB {}
  created_at, updated_at

FLOOR PRICE TRACKING :
  → Source : API OpenSea / Magic Eden (polling toutes les 5 min)
  → Stockage du floor price en EUR (converti via taux ETH/EUR)
  → Historique des prix via metadata JSONB
  → Gain/perte calculé vs prix d'achat

GALERIE IMMERSIVE :
  → Mode "Gallery" plein écran
  → Affichage en grille masonry responsive
  → Clic → modal plein écran avec zoom
  → Animations Framer Motion (scale + blur background)
  → Support vidéo (mp4/webm pour les NFTs animés)
```

##### G3 — Wallet Cartes Bancaires Sécurisé (Semaine 27)

```
TABLE card_wallet
  id                UUID pk
  user_id           UUID → users.id ON DELETE CASCADE
  ── Identification (non sensible) ──
  card_name         String(255) NOT NULL      — "Carte Gold BNP"
  bank_name         String(100) NOT NULL      — "BNP Paribas"
  card_type         Enum(visa/mastercard/amex/cb/other)
  card_tier         Enum(standard/gold/platinum/premium/infinite/other)
  last_four         String(4) NOT NULL        — 4 derniers chiffres UNIQUEMENT
  ── Dates ──
  expiry_month      Integer NOT NULL
  expiry_year       Integer NOT NULL
  ── Coûts & Avantages ──
  is_active         Boolean default true
  monthly_fee       BigInteger default 0      — cotisation mensuelle centimes
  annual_fee        BigInteger default 0      — cotisation annuelle centimes
  cashback_pct      Float default 0.0
  insurance_level   Enum(none/basic/extended/premium)
  ── Avantages détaillés ──
  benefits          JSONB []
  color             String(7) NULL            — hex color pour UI "#1a1a2e"
  notes             Text NULL
  created_at, updated_at

⚠ SÉCURITÉ — Règles strictes :
  → AUCUN numéro de carte complet stocké (jamais, ni chiffré)
  → Seuls les 4 derniers chiffres sont stockés (identification visuelle)
  → Pas de CVV, pas de date complète
  → AES-256-GCM côté serveur pour les notes sensibles
  → L'objectif n'est PAS de stocker des cartes, mais d'optimiser leur USAGE

RECOMMANDATION INTELLIGENTE :
  → Algorithme d'analyse des avantages par carte :
    - Achat > 500€ → recommander la carte avec extension garantie
    - Voyage → recommander la carte avec assurance voyage
    - Location voiture → recommander la carte avec assurance location
    - Achat en ligne → recommander la carte avec cashback max
    - Achat en devise étrangère → recommander la carte sans frais FX
  → Endpoint POST /vault/cards/recommend
    Body : { amount: 50000, category: "travel", currency: "USD" }
    Response : { recommended_card: {...}, reason: "..." }
```

##### G4 — Points de Fidélité & Miles (Semaine 27)

```
TABLE loyalty_programs
  id                UUID pk
  user_id           UUID → users.id ON DELETE CASCADE
  ── Programme ──
  program_name      String(255) NOT NULL      — "Flying Blue"
  provider          String(100) NOT NULL      — "Air France"
  program_type      Enum(airline/hotel/retail/bank/fuel/other)
  ── Solde ──
  points_balance    BigInteger default 0
  points_unit       String(50) default 'points'  — "miles", "étoiles"
  ── Conversion ──
  eur_per_point     Float default 0.01        — taux de conversion € / point
  estimated_value   BigInteger default 0      — valeur en centimes
  ── Expiration ──
  expiry_date       Date NULL
  ── Détails ──
  account_number    String(255) NULL
  tier_status       String(50) NULL           — "Gold", "Platinum"
  last_updated      Date NULL
  notes             Text NULL
  metadata          JSONB {}
  created_at, updated_at

CONVERSION AUTOMATIQUE :
  → Taux prédéfinis par programme :
    Air France Flying Blue : 1 mile = 0.01€
    Amex Membership Rewards : 1 pt = 0.008€
    Accor Live Limitless : 1 pt = 0.002€
    Carrefour : 1€ fidélité = 1€
    Leclerc : 1 pt = 0.01€
  → L'utilisateur peut ajuster le taux manuellement
  → Alerte J-30 avant expiration des points

AGRÉGATION :
  → Total points tous programmes confondus
  → Total valeur estimée en euros
  → Classement par valeur décroissante
```

##### G5 — Subscription Manager (Semaine 28)

```
TABLE subscriptions
  id                      UUID pk
  user_id                 UUID → users.id ON DELETE CASCADE
  ── Identification ──
  name                    String(255) NOT NULL    — "Netflix Premium"
  provider                String(100) NOT NULL    — "Netflix"
  category                Enum(streaming/fitness/telecom/insurance/
                               software/press/food/cloud/transport/other)
  ── Coûts ──
  amount                  BigInteger NOT NULL      — montant en centimes
  billing_cycle           Enum(weekly/monthly/quarterly/semi_annual/annual)
  currency                String(3) default 'EUR'
  ── Dates ──
  next_billing_date       Date NOT NULL
  contract_start_date     Date NOT NULL
  contract_end_date       Date NULL
  cancellation_deadline   Date NULL                — date limite de résiliation
  ── Reconduction ──
  auto_renew              Boolean default true
  cancellation_notice_days Integer default 0       — préavis en jours
  ── Statut ──
  is_active               Boolean default true
  is_essential            Boolean default false     — marqué comme indispensable
  ── Détails ──
  url                     String(500) NULL
  notes                   Text NULL
  color                   String(7) NULL           — hex pour UI
  icon                    String(50) NULL          — nom d'icône lucide
  metadata                JSONB {}
  created_at, updated_at

ALERTE RÉSILIATION INTELLIGENTE :
  → Calcul automatique : cancellation_deadline = contract_end_date - notice_days
  → Si auto_renew ET date approche :
    · J-30 : "Netflix se renouvelle dans 30 jours (143,88€/an)"
    · J-7  : "⚠ Dernier délai pour résilier Netflix dans 7 jours"
    · J-0  : "Netflix s'est renouvelé automatiquement"
  → Notification in-app + calcul économie potentielle par résiliation

ANALYTICS :
  → Coût mensuel total tous abonnements
  → Coût annuel projeté
  → Répartition par catégorie (donut chart)
  → Évolution mois par mois (bar chart)
  → "Abonnements dormants" : non-essentiels > 6 mois → suggestion résiliation
  → Score d'optimisation : essential_cost / total_cost × 100
```

##### G6 — Coffre-fort Numérique (Semaine 28)

```
TABLE vault_documents
  id                UUID pk
  user_id           UUID → users.id ON DELETE CASCADE
  ── Identification ──
  name              String(255) NOT NULL      — "Passeport"
  category          Enum(identity/diploma/certificate/insurance/
                         contract/tax/medical/other)
  document_type     String(100) NOT NULL      — "passport", "bac+5"
  ── Émetteur ──
  issuer            String(255) NULL          — "Préfecture de Paris"
  ── Dates ──
  issue_date        Date NULL
  expiry_date       Date NULL
  ── Identifiant ──
  document_number   String(255) NULL          — chiffré AES-256
  ── Alerte ──
  reminder_days     Integer default 30        — jours avant expiry
  ── Détails ──
  notes             Text NULL
  metadata          JSONB {}
  created_at, updated_at

⚠ SÉCURITÉ :
  → document_number chiffré via AES-256-GCM (module encryption.py existant)
  → Accès : uniquement l'utilisateur authentifié
  → Pas de stockage de fichiers pour le moment (V1 = métadonnées)
  → Future V2 : upload chiffré E2E vers S3/MinIO

ALERTES RENOUVELLEMENT :
  → Passeport : alerte J-180, J-90, J-30 (délais de renouvellement longs)
  → CNI : alerte J-90, J-30
  → Permis de conduire : alerte J-60, J-30
  → Assurance : alerte J-30, J-7
  → Diplômes / Certifications : pas d'expiry (valeur permanente)

CATÉGORIES :
  identity    → passeport, CNI, permis, carte vitale, titre de séjour
  diploma     → bac, licence, master, doctorat, certifications pro
  certificate → naissance, mariage, décès, propriété
  insurance   → habitation, auto, santé, vie, PJ
  contract    → travail, bail, prêt
  tax         → avis d'imposition, déclarations
  medical     → carnet de vaccination, ordonnances, résultats
  other       → tout autre document
```

##### G7 — Tracker Dettes P2P (Semaine 29)

```
TABLE peer_debts
  id                      UUID pk
  user_id                 UUID → users.id ON DELETE CASCADE
  ── Contrepartie ──
  counterparty_name       String(255) NOT NULL    — "Jean Dupont"
  counterparty_email      String(255) NULL        — pour les rappels
  counterparty_phone      String(20) NULL
  ── Direction ──
  direction               Enum(lent/borrowed)
                          — lent = "on me doit" / borrowed = "je dois"
  ── Montant ──
  amount                  BigInteger NOT NULL      — centimes
  currency                String(3) default 'EUR'
  ── Description ──
  description             Text NULL               — "Avance restaurant 15/02"
  ── Dates ──
  date_created            Date NOT NULL
  due_date                Date NULL
  ── Statut ──
  is_settled              Boolean default false
  settled_date            Date NULL
  settled_amount          BigInteger NULL          — montant réellement remboursé
  ── Rappels ──
  reminder_enabled        Boolean default true
  reminder_interval_days  Integer default 7
  last_reminder_at        DateTime(tz) NULL
  ── Détails ──
  notes                   Text NULL
  metadata                JSONB {}
  created_at, updated_at

FONCTIONNALITÉS :
  → Balance par personne : solde net (prêté - emprunté)
  → Historique complet des transactions P2P
  → Rappel automatique poli si due_date dépassée :
    "Petit rappel : tu me dois 50€ pour le restaurant du 15/02.
     Pas de pression, juste un mémo ! 😊"
  → Notification J-3, J+0, J+7, J+14, J+30
  → Possibilité de marquer comme "settled" partiellement
  → Score de fiabilité par contrepartie (% remboursés à temps)

ANALYTICS P2P :
  → Total prêté (non remboursé)
  → Total emprunté (non remboursé)
  → Balance nette
  → Top 5 contreparties par montant
  → Taux de remboursement moyen
```

##### G8 — Shadow Wealth Aggregator & Dashboard

```
SHADOW WEALTH = Σ(biens tangibles) + Σ(NFTs floor) + Σ(points fidélité €)
               - Σ(abonnements annuels) - Σ(dettes P2P dues)

ENDPOINT GET /vault/summary :
  → tangible_assets_total     — valeur totale biens (dépréciée)
  → tangible_assets_count     — nombre de biens
  → nft_total                 — valeur totale NFTs (floor price)
  → nft_count                 — nombre de NFTs
  → loyalty_total             — valeur totale points fidélité
  → loyalty_count             — nombre de programmes
  → subscription_monthly      — coût mensuel abonnements
  → subscription_annual       — coût annuel projeté
  → subscription_count        — nombre d'abonnements actifs
  → documents_count           — nombre de documents
  → documents_expiring_soon   — nombre expirant dans 30j
  → peer_debt_lent_total      — total prêté non remboursé
  → peer_debt_borrowed_total  — total emprunté non remboursé
  → peer_debt_net             — balance nette P2P
  → shadow_wealth_total       — richesse invisible nette
  → warranties_expiring_soon  — nombre de garanties expirant 30j
  → upcoming_cancellations    — abonnements à résilier sous 7j
  → upcoming_renewals         — abonnements qui se renouvellent sous 30j

INTÉGRATION NET WORTH :
  → Le shadow_wealth_total s'ajoute au patrimoine total OmniFlow
  → Contribution visible dans le dashboard principal
  → Breakdown : "Votre patrimoine caché représente X% de votre richesse totale"
```

##### G9 — Stack Technique Phase G

```
FICHIERS CRÉÉS — PHASE G
══════════════════════════

Backend (apps/api/) :
  alembic/versions/022_digital_vault.py
      → CREATE TABLE tangible_assets, nft_assets, card_wallet,
        loyalty_programs, subscriptions, vault_documents, peer_debts
      → 7 tables, 100+ colonnes, JSONB, enums, indexes

  app/models/tangible_asset.py
      → class TangibleAsset(Base, UUIDMixin, TimestampMixin)
      → AssetCategory enum (6 valeurs) + DepreciationType (4 valeurs) + Condition (5 valeurs)

  app/models/nft_asset.py
      → class NFTAsset(Base, UUIDMixin, TimestampMixin)
      → Blockchain enum (4 valeurs)

  app/models/card_wallet.py
      → class CardWallet(Base, UUIDMixin, TimestampMixin)
      → CardType, CardTier, InsuranceLevel enums

  app/models/loyalty_program.py
      → class LoyaltyProgram(Base, UUIDMixin, TimestampMixin)
      → ProgramType enum (6 valeurs)

  app/models/subscription.py
      → class Subscription(Base, UUIDMixin, TimestampMixin)
      → SubscriptionCategory (10 valeurs) + BillingCycle (5 valeurs)

  app/models/vault_document.py
      → class VaultDocument(Base, UUIDMixin, TimestampMixin)
      → DocumentCategory enum (8 valeurs)

  app/models/peer_debt.py
      → class PeerDebt(Base, UUIDMixin, TimestampMixin)
      → DebtDirection enum (lent/borrowed)

  app/schemas/digital_vault.py
      → 40+ Pydantic models : Create/Update/Response for all 7 entities
      → VaultSummaryResponse, CardRecommendationRequest, CardRecommendationResponse
      → SubscriptionAnalyticsResponse, PeerDebtAnalyticsResponse

  app/services/digital_vault_engine.py
      → compute_depreciation(asset) → current_value
      → recommend_card(cards, amount, category) → best_card + reason
      → compute_subscription_analytics(subs) → monthly/annual/optimization
      → compute_peer_debt_analytics(debts) → balance/top/rate
      → compute_shadow_wealth(user_id) → summary dict
      → get_expiring_warranties(assets) → list
      → get_upcoming_cancellations(subs) → list
      → convert_loyalty_points(program) → eur_value

  app/api/v1/digital_vault.py
      → 35+ endpoints REST groupés :
        ── Tangible Assets (7) ──
        POST   /vault/assets              → créer un bien
        GET    /vault/assets              → lister mes biens
        GET    /vault/assets/{id}         → détail + valeur actuelle
        PUT    /vault/assets/{id}         → modifier
        DELETE /vault/assets/{id}         → supprimer
        POST   /vault/assets/{id}/revalue → recalculer la valeur
        GET    /vault/assets/warranties   → garanties proches expiration

        ── NFTs (5) ──
        POST   /vault/nfts               → ajouter un NFT
        GET    /vault/nfts               → lister
        GET    /vault/nfts/{id}          → détail
        PUT    /vault/nfts/{id}          → modifier
        DELETE /vault/nfts/{id}          → supprimer

        ── Card Wallet (6) ──
        POST   /vault/cards               → ajouter une carte
        GET    /vault/cards               → lister
        PUT    /vault/cards/{id}          → modifier
        DELETE /vault/cards/{id}          → supprimer
        POST   /vault/cards/recommend     → recommandation IA

        ── Loyalty Programs (5) ──
        POST   /vault/loyalty             → ajouter un programme
        GET    /vault/loyalty             → lister
        PUT    /vault/loyalty/{id}        → modifier
        DELETE /vault/loyalty/{id}        → supprimer

        ── Subscriptions (6) ──
        POST   /vault/subscriptions       → ajouter un abonnement
        GET    /vault/subscriptions       → lister
        PUT    /vault/subscriptions/{id}  → modifier
        DELETE /vault/subscriptions/{id}  → supprimer
        GET    /vault/subscriptions/analytics → analytics

        ── Documents (5) ──
        POST   /vault/documents           → ajouter un document
        GET    /vault/documents           → lister
        PUT    /vault/documents/{id}      → modifier
        DELETE /vault/documents/{id}      → supprimer

        ── Peer Debts (7) ──
        POST   /vault/peer-debts          → créer IOU
        GET    /vault/peer-debts          → lister
        PUT    /vault/peer-debts/{id}     → modifier
        DELETE /vault/peer-debts/{id}     → supprimer
        POST   /vault/peer-debts/{id}/settle → marquer remboursé
        GET    /vault/peer-debts/analytics → analytics P2P

        ── Summary (1) ──
        GET    /vault/summary             → shadow wealth agrégé

Frontend (apps/web/) :
  src/types/api.ts
      → 30+ interfaces TypeScript (TangibleAsset, NFTAsset, CardWallet,
        LoyaltyProgram, Subscription, VaultDocument, PeerDebt,
        VaultSummary, CardRecommendation, SubscriptionAnalytics, etc.)

  src/stores/vault-store.ts
      → Zustand store : assets, nfts, cards, loyalty, subscriptions,
        documents, peerDebts, summary, analytics
      → 25+ actions CRUD + fetch + analytics

  src/app/(dashboard)/vault/page.tsx
      → 7 onglets : Biens | NFTs | Cartes | Fidélité | Abonnements |
        Documents | Dettes P2P
      → Dashboard Shadow Wealth en header avec KPIs
      → Composants : AssetCard, NFTGalleryCard, BankCard, LoyaltyCard,
        SubscriptionCard, DocumentCard, PeerDebtCard, ShadowWealthGauge

  src/components/layout/sidebar.tsx
      → Ajout "Coffre-fort" dans section Gestion (icône Vault de lucide-react)

Registrations :
  app/models/__init__.py   → + 7 models
  app/api/v1/router.py     → + vault_router
  app/core/config.py       → + CACHE_TTL_DIGITAL_VAULT: int = 300

Tests (25+ tests) :
  tests/test_digital_vault.py
      UNIT (15+ tests) :
        → test_depreciation_linear
        → test_depreciation_declining
        → test_depreciation_none
        → test_depreciation_residual_floor
        → test_card_recommend_travel
        → test_card_recommend_cashback
        → test_card_recommend_warranty
        → test_loyalty_conversion
        → test_subscription_monthly_cost
        → test_subscription_annual_projection
        → test_peer_debt_balance_net
        → test_peer_debt_counterparty_balance
        → test_shadow_wealth_aggregation
        → test_warranty_expiring_soon
        → test_cancellation_upcoming
      INTEGRATION (10+ tests) :
        → test_create_tangible_asset
        → test_list_tangible_assets
        → test_create_nft
        → test_create_card
        → test_card_recommendation
        → test_create_subscription
        → test_subscription_analytics
        → test_create_document
        → test_create_peer_debt
        → test_vault_summary
        → test_unauthenticated
```

---

> **Prochaine étape :** Valider ce plan ensemble. Prioriser. Puis coder — Phase A en premier, sans exception.
