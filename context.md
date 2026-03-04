# OmniFlow — Source de Vérité (context.md)

> **Version** : 0.1.0-alpha
> **Date de création** : 1er mars 2026
> **Auteur** : Équipe OmniFlow
> **Statut** : Document vivant — à mettre à jour à chaque décision architecturale majeure.

---

## Table des matières

1. [Vision & Objectifs](#1-vision--objectifs)
2. [Analyse concurrentielle](#2-analyse-concurrentielle)
3. [User Journey](#3-user-journey)
4. [Architecture technique](#4-architecture-technique)
5. [Stack technique détaillée](#5-stack-technique-détaillée)
6. [Moteur Woob — Cœur de l'agrégation](#6-moteur-woob--cœur-de-lagrégation)
7. [Design System — « OmniUI »](#7-design-system--omniui)
8. [Fonctionnalités innovantes](#8-fonctionnalités-innovantes)
9. [Algorithmes & Calculs financiers](#9-algorithmes--calculs-financiers)
10. [Sécurité & Privacy-first](#10-sécurité--privacy-first)
11. [Intelligence Artificielle](#11-intelligence-artificielle)
12. [PWA & Performance](#12-pwa--performance)
13. [Phases d'implémentation](#13-phases-dimplémentation)
14. [Structure du Monorepo](#14-structure-du-monorepo)
15. [Conventions & Standards](#15-conventions--standards)
16. [API Contract (Backend ↔ Frontend)](#16-api-contract-backend--frontend)
17. [Modèle de données](#17-modèle-de-données)
18. [Déploiement & Infrastructure](#18-déploiement--infrastructure)
19. [KPIs & Métriques de succès](#19-kpis--métriques-de-succès)
20. [Risques & Mitigations](#20-risques--mitigations)

---

## 1. Vision & Objectifs

### 1.1 La Super-Vision

OmniFlow n'est pas un agrégateur de comptes. C'est un **cockpit financier personnel** qui donne à chaque utilisateur un pouvoir jusqu'ici réservé aux gestionnaires de fortune : **une vue unifiée, intelligente et prédictive de TOUT son patrimoine** — comptes bancaires, portefeuilles crypto, actions en bourse, biens immobiliers et dettes — dans une seule interface élégante.

### 1.2 Différenciateurs clés

| Critère | Finary | Trade Republic | **OmniFlow** |
|---|---|---|---|
| Agrégation bancaire | API Budget Insight (payante) | Limité | **Woob (Open-Source, gratuit)** |
| Crypto | Lecture seule | Non | **Multi-wallets, DeFi tracking** |
| Bourse | Via connecteurs | Natif (broker) | **Multi-brokers via Woob + API** |
| Immobilier | Manuel | Non | **Estimation auto (DVF + ML)** |
| IA prédictive | Basique | Non | **LLM-powered forecasting** |
| Open-Source | Non | Non | **Core engine open-source** |
| Coût | Freemium (10€/mois) | Commissions | **Gratuit (self-hosted) / Premium** |

### 1.3 Objectifs produit (6 mois)

- **M1** : MVP fonctionnel — agrégation de 3 banques FR (Boursorama, SG, Crédit Mutuel) via Woob.
- **M2** : Dashboard complet avec Net Worth en temps réel, graphiques interactifs.
- **M3** : Module Crypto (Binance, Kraken, MetaMask) + module Bourse (Boursorama, Degiro).
- **M4** : Intelligence Artificielle — prévisions de trésorerie, détection d'anomalies.
- **M5** : Immobilier (valeur estimée) + Dettes (crédit immo, conso) + Auto-Budget.
- **M6** : PWA optimisée, beta publique, documentation open-source.

### 1.4 Principes fondamentaux

1. **Privacy-first** : Les credentials ne quittent JAMAIS le device/serveur de l'utilisateur. Zéro tracking.
2. **Speed obsession** : TTI < 1.5s, LCP < 2s, skeleton loaders partout. L'app doit sembler instantanée.
3. **Offline-capable** : Les données critiques sont cachées. L'app fonctionne sans réseau.
4. **Pixel Perfect** : Chaque pixel compte. Le design inspire confiance et modernité.
5. **Open by default** : Le moteur d'agrégation est open-source. La communauté peut ajouter des connecteurs.

---

## 2. Analyse concurrentielle

### 2.1 Finary
- **Forces** : UX soignée, large couverture bancaire via Budget Insight, community active.
- **Faiblesses** : Dépendance à une API tierce coûteuse, pas de crypto DeFi, IA limitée, 10€/mois pour les features avancées.
- **Notre avantage** : Woob = zéro coût d'agrégation, plus de flexibilité, self-hostable.

### 2.2 Trade Republic
- **Forces** : UX minimaliste, broker intégré, fractional shares.
- **Faiblesses** : Pas un agrégateur, pas de crypto DeFi, pas d'immobilier.
- **Notre avantage** : Vue holistique du patrimoine, pas de lock-in à un broker.

### 2.3 Bankin' / Linxo
- **Forces** : Historiques, bonne couverture bancaire.
- **Faiblesses** : UX datée, modèle pub/freemium agressif, innovation stagnante.
- **Notre avantage** : Design moderne, IA embarquée, transparent et open-source.

---

## 3. User Journey

### 3.1 Premier lancement (Onboarding)

```
[Splash Screen animé — logo OmniFlow avec particles effect]
           │
           ▼
[Écran 1 : "Votre patrimoine, simplifié"]
  ─ Carousel de 3 slides avec animations Framer Motion
  ─ Illustrations isométriques des 5 piliers (Banque, Crypto, Bourse, Immo, Dettes)
           │
           ▼
[Écran 2 : Création de compte]
  ─ Email + mot de passe OU auth sociale (Google, Apple)
  ─ Génération d'une clé de chiffrement locale (Master Key)
  ─ Explication visuelle du modèle "Privacy-first"
           │
           ▼
[Écran 3 : "Connectez votre première banque"]
  ─ Search bar avec autocomplétion des banques françaises
  ─ Sélection de la banque → formulaire Woob dynamique
  ─ Gestion SCA : popup d'attente avec progress bar + instructions
  ─ Animation de succès (confetti particles)
           │
           ▼
[Écran 4 : Premier aperçu]
  ─ Skeleton loaders pendant le fetch initial (~5-15s)
  ─ Reveal progressif : solde total → comptes → dernières transactions
  ─ CTA : "Ajouter un autre compte" ou "Explorer votre dashboard"
           │
           ▼
[Dashboard principal — l'utilisateur est chez lui]
```

### 3.2 Usage quotidien

```
[Ouverture de l'app]
  ─ Données cachées affichées INSTANTANÉMENT (Redis + Service Worker)
  ─ Refresh en background (badge "Mis à jour il y a 2 min")
           │
           ▼
[Dashboard]
  ─ Net Worth total (compteur animé avec CountUp.js)
  ─ Répartition visuelle (donut chart interactif)
  ─ Variation J-1, S-1, M-1, A-1 (badges verts/rouges)
  ─ Alertes intelligentes (frais cachés, prélèvements inhabituels)
           │
           ▼
[Deep dive dans une catégorie]
  ─ Banques : liste des comptes, transactions catégorisées, graphes de flux
  ─ Crypto : portefeuille par token, P&L, connexion wallets
  ─ Bourse : performance par ligne, dividendes, allocation sectorielle
  ─ Immobilier : estimation du bien, plus-value latente, rendement locatif
  ─ Dettes : tableau d'amortissement, coût total, recommandation de remboursement
```

### 3.3 Moments clés (Triggers d'engagement)

| Moment | Action OmniFlow |
|---|---|
| Lundi matin | Push notification : "Votre patrimoine cette semaine : +2.3%" |
| Grosse dépense détectée | Alerte : "Prélèvement de 450€ chez Amazon — inhabituel ?" |
| Fin de mois | Rapport Auto-Budget : "Vous avez économisé 180€ vs. votre objectif" |
| Frais cachés | Alerte : "Votre banque vous a prélevé 4.50€ de frais de tenue de compte" |
| Opportunité d'investissement | IA : "Avec 500€ d'épargne non investie, voici 3 scénarios…" |

---

## 4. Architecture technique

### 4.1 Vue d'ensemble (C4 — Context Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UTILISATEUR                                  │
│                    (Browser / PWA installée)                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS 14 (Frontend)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Dashboard│ │ Accounts │ │ Budget   │ │ Settings │ ...           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                    │                                                │
│         Server Components + API Route Handlers                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FASTAPI (Backend Python)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Auth API │ │ Accounts │ │ Woob     │ │ AI       │              │
│  │          │ │ API      │ │ Bridge   │ │ Engine   │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                    │              │              │                   │
└────────────────────┼──────────────┼──────────────┼──────────────────┘
                     │              │              │
          ┌──────────┼──────────────┼──────────────┘
          ▼          ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────────────────┐
│  PostgreSQL  │ │  Redis   │ │   Woob Workers       │
│  (Données)   │ │  (Cache) │ │   (Pool de scrapers) │
└──────────────┘ └──────────┘ └──────────┬────────────┘
                                         │
                              ┌──────────┼──────────┐
                              ▼          ▼          ▼
                         [Banques]  [Brokers]  [Crypto]
                         (SG, BRS)  (Degiro)  (Binance)
```

### 4.2 Architecture détaillée (Container Level)

```
┌─────────────────────── FRONTEND (Next.js 14) ──────────────────────┐
│                                                                     │
│  App Router                                                         │
│  ├── (auth)/           → Pages login, register, onboarding          │
│  ├── (dashboard)/      → Layout principal avec sidebar              │
│  │   ├── page.tsx      → Vue d'ensemble patrimoine                  │
│  │   ├── banks/        → Comptes bancaires                          │
│  │   ├── crypto/       → Portefeuille crypto                        │
│  │   ├── stocks/       → Portefeuille bourse                        │
│  │   ├── realestate/   → Biens immobiliers                          │
│  │   ├── debts/        → Crédits & dettes                           │
│  │   ├── budget/       → Auto-Budget & objectifs                    │
│  │   ├── insights/     → IA & prévisions                            │
│  │   └── settings/     → Paramètres, connexions, sécurité           │
│  │                                                                   │
│  State Management : Zustand (léger, performant)                      │
│  Data Fetching   : TanStack Query (React Query v5)                   │
│  Charts          : Recharts (simple) + Visx (custom avancé)         │
│  Animations      : Framer Motion                                     │
│  Forms           : React Hook Form + Zod                             │
│  Icons           : Lucide React                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────── BACKEND (FastAPI) ──────────────────────────┐
│                                                                     │
│  Modules                                                            │
│  ├── api/                                                           │
│  │   ├── v1/                                                        │
│  │   │   ├── auth.py         → JWT tokens, refresh, 2FA             │
│  │   │   ├── accounts.py     → CRUD comptes agrégés                 │
│  │   │   ├── transactions.py → Historique, catégorisation            │
│  │   │   ├── networth.py     → Calcul patrimoine temps réel         │
│  │   │   ├── crypto.py       → Wallets, tokens, DeFi positions      │
│  │   │   ├── stocks.py       → Portefeuilles, dividendes            │
│  │   │   ├── realestate.py   → Biens, estimations, rendements       │
│  │   │   ├── debts.py        → Crédits, amortissement               │
│  │   │   ├── budget.py       → Auto-budget, objectifs               │
│  │   │   ├── insights.py     → IA prédictions, alertes              │
│  │   │   └── settings.py     → Config utilisateur                   │
│  │   │                                                              │
│  ├── core/                                                          │
│  │   ├── security.py     → AES-256, hashing, JWT                    │
│  │   ├── config.py       → Settings (pydantic-settings)             │
│  │   ├── database.py     → SQLAlchemy async engine                  │
│  │   └── redis.py        → Redis connection pool                    │
│  │                                                                  │
│  ├── woob_engine/                                                   │
│  │   ├── manager.py      → Pool de workers Woob                     │
│  │   ├── worker.py       → Worker unitaire (scraping session)       │
│  │   ├── normalizer.py   → Normalisation données hétérogènes        │
│  │   ├── scheduler.py    → Cron de refresh automatique              │
│  │   └── sca_handler.py  → Gestion Strong Customer Auth             │
│  │                                                                  │
│  ├── ai/                                                            │
│  │   ├── forecaster.py   → Prévisions trésorerie 30j                │
│  │   ├── categorizer.py  → Catégorisation IA des transactions        │
│  │   ├── anomaly.py      → Détection d'anomalies                    │
│  │   └── advisor.py      → Conseils personnalisés (LangChain)       │
│  │                                                                  │
│  ├── models/             → SQLAlchemy ORM models                     │
│  ├── schemas/            → Pydantic schemas (request/response)       │
│  └── services/           → Business logic layer                      │
│                                                                     │
│  ORM       : SQLAlchemy 2.0 (async)                                  │
│  Migrations: Alembic                                                 │
│  Tasks     : Celery + Redis (pour les jobs Woob longs)               │
│  WebSocket : FastAPI native (pour live updates)                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────── DATA LAYER ─────────────────────────────────┐
│                                                                     │
│  PostgreSQL 16                                                      │
│  ├── users              → Comptes utilisateurs                      │
│  ├── bank_connections   → Connexions Woob (credentials chiffrés)    │
│  ├── accounts           → Comptes agrégés (tous types)              │
│  ├── transactions       → Transactions normalisées                  │
│  ├── balances_history   → Historique des soldes (time-series)       │
│  ├── crypto_wallets     → Wallets crypto                            │
│  ├── crypto_positions   → Positions par token                       │
│  ├── stock_portfolios   → Portefeuilles bourse                     │
│  ├── stock_positions    → Lignes d'investissement                   │
│  ├── real_estate        → Biens immobiliers                         │
│  ├── debts              → Crédits & dettes                          │
│  ├── budgets            → Budgets & objectifs                       │
│  ├── categories         → Catégories de transactions                │
│  ├── ai_predictions     → Prédictions IA cachées                    │
│  └── audit_log          → Journal d'audit sécurité                  │
│                                                                     │
│  Redis 7                                                            │
│  ├── sessions:*         → Sessions JWT                              │
│  ├── woob:*             → Cache des sessions Woob                   │
│  ├── rates:forex:*      → Taux de change (TTL: 5min)               │
│  ├── rates:crypto:*     → Prix crypto (TTL: 30s)                   │
│  ├── networth:*         → Net Worth calculé (TTL: 1min)            │
│  └── locks:*            → Distributed locks pour workers            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Flux de données — Agrégation bancaire

```
Utilisateur clique "Ajouter une banque"
           │
           ▼
[Frontend] POST /api/v1/connections
  body: { bank_id: "boursorama", credentials: <encrypted_payload> }
           │
           ▼
[Backend] Déchiffre les credentials → Crée un Woob Worker
           │
           ▼
[Woob Worker] browser = Woob()
  → browser.load_backend('boursorama', credentials)
  → Si SCA requis :
      │
      ├── WebSocket → Frontend : "Validez sur votre app bancaire"
      │   (l'utilisateur valide sur son app mobile bancaire)
      ├── Worker attend le callback SCA (polling 30s max)
      │
  → browser.iter_accounts() → Normalisation
  → Pour chaque compte :
      browser.iter_history(account) → Normalisation
           │
           ▼
[Normalizer] Données hétérogènes → Schema OmniFlow unifié
  → Montants en centimes (éviter les float)
  → Catégorisation automatique (ML + règles)
  → Détection de doublons
           │
           ▼
[PostgreSQL] INSERT / UPSERT des comptes et transactions
[Redis] Cache invalidation → Net Worth recalcul
           │
           ▼
[WebSocket] → Frontend : "Synchronisation terminée ✓"
  → Mise à jour du dashboard en temps réel
```

---

## 5. Stack technique détaillée

### 5.1 Frontend

| Technologie | Version | Rôle | Justification |
|---|---|---|---|
| **Next.js** | 14.x | Framework React | App Router, RSC, streaming, SEO |
| **TypeScript** | 5.x | Typage | Sécurité du code, DX |
| **Tailwind CSS** | 3.x | Styling | Utility-first, design system rapide |
| **Framer Motion** | 11.x | Animations | Animations fluides 60fps, layout animations |
| **Lucide React** | latest | Icônes | Légères, consistantes, tree-shakeable |
| **Recharts** | 2.x | Graphiques simples | Courbes, barres, donuts |
| **Visx** | 3.x | Graphiques avancés | Visualisations custom (heatmaps patrimoine) |
| **Zustand** | 4.x | State management | Léger (1KB), performant, pas de boilerplate |
| **TanStack Query** | 5.x | Data fetching | Cache, revalidation, optimistic updates |
| **React Hook Form** | 7.x | Formulaires | Performance, validation |
| **Zod** | 3.x | Validation schemas | Shared avec le backend (via codegen) |
| **next-themes** | latest | Dark mode | Toggle fluide, respect préférences système |
| **date-fns** | 3.x | Dates | Tree-shakeable, immutable |
| **nuqs** | latest | URL state | Sync state avec l'URL (filtres, navigation) |

### 5.2 Backend

| Technologie | Version | Rôle | Justification |
|---|---|---|---|
| **FastAPI** | 0.110+ | Framework API | Async natif, OpenAPI auto, Python (Woob) |
| **Python** | 3.12+ | Runtime | Performance améliorée, Woob compatible |
| **Woob** | 3.x | Agrégation | Open-source, 80+ modules bancaires FR |
| **SQLAlchemy** | 2.0 | ORM | Async, modern mapping, performant |
| **Alembic** | 1.13+ | Migrations | Versionning schema DB |
| **Pydantic** | 2.x | Validation | Schemas partagés, serialization rapide |
| **Celery** | 5.x | Task queue | Jobs Woob asynchrones, scheduling |
| **Redis** | 7.x | Cache / Broker | Sessions, cache, Celery broker |
| **PostgreSQL** | 16 | Base de données | JSONB, time-series-like, fiable |
| **Passlib** | 1.7 | Hashing | Bcrypt pour les mots de passe |
| **python-jose** | 3.x | JWT | Tokens auth |
| **cryptography** | 41+ | Chiffrement | AES-256-GCM pour les credentials |
| **httpx** | 0.27+ | HTTP client | Async, pour les API externes |
| **LangChain** | 0.2+ | IA framework | Orchestration LLM, chains, agents |

### 5.3 Infrastructure

| Technologie | Rôle |
|---|---|
| **Docker** + **Docker Compose** | Conteneurisation locale |
| **Nginx** | Reverse proxy, SSL termination |
| **GitHub Actions** | CI/CD |
| **Sentry** | Error tracking (frontend + backend) |
| **Prometheus** + **Grafana** | Monitoring (optionnel Phase 5) |

---

## 6. Moteur Woob — Cœur de l'agrégation

### 6.1 Qu'est-ce que Woob ?

[Woob](https://woob.tech) (Web Outside Of Browsers) est un framework Python open-source qui permet d'interagir avec des sites web de manière programmatique. Il dispose de **80+ modules bancaires** pour les banques françaises et européennes, gérés par une communauté active.

### 6.2 Architecture du Woob Engine

```
┌────────────────────── WOOB ENGINE ──────────────────────┐
│                                                          │
│  ┌─────────────┐    ┌──────────────────────────────┐    │
│  │  Scheduler   │───▶│     Worker Pool Manager       │    │
│  │  (Celery     │    │                                │    │
│  │   Beat)      │    │  ┌────────┐ ┌────────┐        │    │
│  └─────────────┘    │  │Worker 1│ │Worker 2│ ...     │    │
│                      │  │(BRS)   │ │(SG)    │        │    │
│  ┌─────────────┐    │  └───┬────┘ └───┬────┘        │    │
│  │  SCA Handler │◄───│      │          │              │    │
│  │  (WebSocket) │    │      ▼          ▼              │    │
│  └─────────────┘    │  ┌──────────────────┐          │    │
│                      │  │   Normalizer      │          │    │
│                      │  │                    │          │    │
│                      │  │  input: raw Woob   │          │    │
│                      │  │  output: OmniFlow  │          │    │
│                      │  │          schema     │          │    │
│                      │  └────────┬───────────┘          │    │
│                      └───────────┼──────────────────────┘    │
│                                  │                            │
│                                  ▼                            │
│                      ┌──────────────────┐                    │
│                      │  Data Persistence │                    │
│                      │  (PostgreSQL)      │                    │
│                      └──────────────────┘                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Worker Lifecycle

```python
# Pseudo-code d'un Worker Woob

class WoobWorker:
    """
    Un worker = une session d'agrégation pour un utilisateur + une banque.
    Chaque worker est isolé (process séparé via Celery).
    """
    
    def __init__(self, user_id: str, bank_module: str, encrypted_credentials: bytes):
        self.user_id = user_id
        self.bank_module = bank_module
        self.credentials = decrypt_aes256(encrypted_credentials, user_master_key)
        self.woob = Woob()
        self.status = "initializing"
    
    async def connect(self) -> ConnectionResult:
        """
        Étape 1 : Établir la connexion avec la banque.
        Gère le SCA (Strong Customer Authentication).
        """
        backend = self.woob.load_backend(
            self.bank_module,
            params=self.credentials
        )
        
        try:
            # Test de connexion
            list(backend.iter_accounts())
            self.status = "connected"
            return ConnectionResult(success=True)
            
        except BrowserQuestion as q:
            # SCA requis ! 
            # Envoyer la question au frontend via WebSocket
            self.status = "awaiting_sca"
            await self.emit_sca_challenge(q)
            response = await self.wait_sca_response(timeout=120)
            backend.handle_sca(response)
            self.status = "connected"
            return ConnectionResult(success=True, sca_completed=True)
    
    async def sync_accounts(self) -> list[NormalizedAccount]:
        """
        Étape 2 : Récupérer et normaliser les comptes.
        """
        raw_accounts = list(self.woob.iter_accounts())
        return [self.normalizer.normalize_account(a) for a in raw_accounts]
    
    async def sync_transactions(self, account_id: str, days: int = 90) -> list[NormalizedTransaction]:
        """
        Étape 3 : Récupérer et normaliser les transactions.
        """
        raw_transactions = list(self.woob.iter_history(account_id))
        normalized = [self.normalizer.normalize_transaction(t) for t in raw_transactions]
        # Catégorisation IA en batch
        return await self.ai_categorizer.categorize_batch(normalized)
    
    async def full_sync(self) -> SyncResult:
        """
        Pipeline complet de synchronisation.
        """
        await self.connect()
        accounts = await self.sync_accounts()
        
        all_transactions = []
        for account in accounts:
            txns = await self.sync_transactions(account.id)
            all_transactions.extend(txns)
        
        # Persistance
        await self.persistence.upsert_accounts(self.user_id, accounts)
        await self.persistence.upsert_transactions(self.user_id, all_transactions)
        
        # Invalidation cache
        await self.cache.invalidate(f"networth:{self.user_id}")
        
        self.status = "completed"
        return SyncResult(
            accounts_synced=len(accounts),
            transactions_synced=len(all_transactions)
        )
```

### 6.4 Normalisation des données

Le Normalizer est critique car chaque module Woob retourne des données dans des formats différents :

```python
# Schema OmniFlow unifié pour les comptes
class NormalizedAccount:
    omniflow_id: UUID          # ID interne unique
    source: str                 # "woob:boursorama", "api:binance"
    external_id: str            # ID côté banque
    type: AccountType           # CHECKING, SAVINGS, INVESTMENT, LOAN, CRYPTO
    label: str                  # "Compte Courant", "Livret A"
    balance: int                # EN CENTIMES (ex: 154320 = 1543.20€)
    currency: str               # ISO 4217 (EUR, USD, BTC)
    bank_name: str              # Nom de la banque
    last_sync: datetime         # Dernière synchronisation
    metadata: dict              # Données spécifiques au type

# Schema OmniFlow unifié pour les transactions
class NormalizedTransaction:
    omniflow_id: UUID
    account_id: UUID
    date: date
    amount: int                 # EN CENTIMES, négatif = débit
    label: str                  # Libellé nettoyé
    raw_label: str              # Libellé brut de la banque
    category: Category          # Catégorie IA
    subcategory: str            # Sous-catégorie
    type: TransactionType       # CARD, TRANSFER, DIRECT_DEBIT, CHECK, FEE, INTEREST
    merchant: str | None        # Marchand détecté
    is_recurring: bool          # Détecté comme récurrent
    metadata: dict
```

### 6.5 Banques supportées (Phase 1 — France)

| Module Woob | Banque | Comptes | Transactions | SCA |
|---|---|---|---|---|
| `boursorama` | Boursorama | ✅ | ✅ | OTP SMS |
| `societegenerale` | Société Générale | ✅ | ✅ | App Mobile |
| `creditmutuel` | Crédit Mutuel | ✅ | ✅ | OTP/App |
| `bnporc` | BNP Paribas | ✅ | ✅ | Clé Digitale |
| `caissedepargne` | Caisse d'Épargne | ✅ | ✅ | SécuriPass |
| `lcl` | LCL | ✅ | ✅ | App Mobile |
| `hellobank` | Hello Bank | ✅ | ✅ | OTP SMS |
| `fortuneo` | Fortuneo | ✅ | ✅ | OTP SMS |

---

## 7. Design System — « OmniUI »

### 7.1 Philosophie

Le design d'OmniFlow s'inspire de **Trade Republic** (minimalisme, confiance) et **Finary** (richesse des données) avec une touche unique : des **micro-interactions qui rendent la finance addictive**.

Principes :
1. **Dark-first** : Le mode sombre OLED est le mode par défaut. Le blanc est l'alternative.
2. **Data density** : Beaucoup d'informations, mais jamais de surcharge visuelle.
3. **Motion with purpose** : Chaque animation a un but (feedback, orientation, délice).
4. **Glass morphism subtil** : Effets de verre dépoli pour les overlays et cards.

### 7.2 Palette de couleurs

```
DARK MODE (OLED — Défaut)
─────────────────────────
Background Primary   : #000000  (Noir pur OLED)
Background Secondary : #0A0A0A  (Noir légèrement relevé)
Background Tertiary  : #141414  (Cards, surfaces)
Background Elevated  : #1A1A1A  (Modals, dropdowns)

Surface              : #1E1E1E  (Inputs, chips)
Surface Hover        : #252525
Border               : #2A2A2A  (Subtil)
Border Active        : #3A3A3A

Text Primary         : #FAFAFA  (Blanc cassé)
Text Secondary       : #A0A0A0  (Gris moyen)
Text Tertiary        : #666666  (Gris faible)
Text Disabled        : #404040

LIGHT MODE
─────────────────────────
Background Primary   : #FFFFFF
Background Secondary : #F7F7F8
Background Tertiary  : #F0F0F2
Text Primary         : #0A0A0A
Text Secondary       : #6B6B6B


ACCENTS (Communs aux deux modes)
─────────────────────────
Brand Primary        : #6C5CE7  (Violet — identité OmniFlow)
Brand Light          : #A29BFE  (Violet clair)
Brand Dark           : #4A3AB5  (Violet foncé)

Success / Gain       : #00D68F  (Vert émeraude)
Success Background   : #00D68F1A  (10% opacity)

Danger / Perte       : #FF4757  (Rouge corail)
Danger Background    : #FF47571A

Warning              : #FECA57  (Jaune doré)
Warning Background   : #FECA571A

Info                 : #54A0FF  (Bleu ciel)
Info Background      : #54A0FF1A

CATÉGORIES FINANCIÈRES
─────────────────────────
Banque               : #54A0FF  (Bleu)
Crypto               : #FF9F43  (Orange)
Bourse               : #6C5CE7  (Violet)
Immobilier           : #00D68F  (Vert)
Dettes               : #FF4757  (Rouge)
```

### 7.3 Typographie

```
Font Family       : "Inter" (variable font)
                    Fallback: -apple-system, BlinkMacSystemFont, system-ui

Font Sizes (rem)  :
  xs    : 0.75rem   (12px)  — Labels, badges
  sm    : 0.875rem  (14px)  — Texte secondaire, metadata
  base  : 1rem      (16px)  — Texte courant
  lg    : 1.125rem  (18px)  — Sous-titres
  xl    : 1.25rem   (20px)  — Titres de section
  2xl   : 1.5rem    (24px)  — Titres de page
  3xl   : 1.875rem  (30px)  — Montants importants
  4xl   : 2.25rem   (36px)  — Net Worth total
  5xl   : 3rem      (48px)  — Splash / Hero

Font Weights :
  regular  : 400   — Corps de texte
  medium   : 500   — Labels, boutons
  semibold : 600   — Sous-titres, accents
  bold     : 700   — Montants financiers, titres

Tabular Nums : font-variant-numeric: tabular-nums;
               → Pour aligner les chiffres dans les tableaux financiers
```

### 7.4 Composants clés

#### Skeleton Loaders (OBLIGATOIRE partout)

```tsx
// Chaque composant qui fetch des données DOIT avoir un skeleton
// Le skeleton reflète EXACTEMENT la forme du contenu final

<AccountCardSkeleton />  // Même dimensions que <AccountCard />
<TransactionRowSkeleton /> // Même hauteur de ligne
<NetWorthChartSkeleton /> // Même zone graphique

// Animation : pulse shimmer (de gauche à droite)
// Durée : 1.5s, ease-in-out, infini
// Couleur : bg-surface → bg-surface-hover → bg-surface
```

#### Composants de base

```
Atoms (Primitives)
├── Button          → Primary, Secondary, Ghost, Danger, Icon-only
├── Input           → Text, Password, Number, Search, Currency
├── Badge           → Gain (+2.3%), Perte (-1.5%), Neutral, Status
├── Avatar          → Bank logos, user avatar, crypto icons
├── Tooltip         → Information contextuelle
├── Chip            → Tags de catégorie, filtres
├── Toggle          → Mode sombre, alertes
├── Spinner         → Loading states mineurs
└── Skeleton        → Loading states majeurs

Molecules (Composés)
├── AccountCard     → Logo banque + nom + solde + variation
├── TransactionRow  → Date + label + catégorie + montant
├── StatCard        → Titre + montant + variation + sparkline
├── CategoryBadge   → Icône + nom + couleur de la catégorie
├── SearchBar       → Input + autocomplétion + raccourcis
├── DateRangePicker → Sélection de période (custom ou presets)
├── CurrencyDisplay → Montant formaté + devise + variation animée
└── EmptyState      → Illustration + message + CTA

Organisms (Sections)
├── Sidebar         → Navigation principale + comptes rapides
├── NetWorthHero    → Montant total + donut + variations
├── AccountsList    → Liste groupée des comptes par type
├── TransactionsFeed→ Feed scrollable + filtres + search
├── ChartContainer  → Graphique interactif + légende + tooltip
├── BudgetProgress  → Barre de progression par catégorie
├── AlertsPanel     → Alertes IA en temps réel
└── AddAccountFlow  → Modal multi-step (banque → credentials → SCA → success)
```

### 7.5 Micro-interactions & Animations

```
TRANSITIONS GLOBALES
────────────────────
Page transition     : Framer Motion layoutId, fade + slide (200ms)
Card hover          : translateY(-2px) + shadow elevation (150ms, spring)
Button press        : scale(0.97) → scale(1) (100ms)
Tab switch          : Underline slide avec spring physics

ANIMATIONS DATA
────────────────────
Montant change      : CountUp animation (800ms, easeOut)
                      Vert si hausse, rouge si baisse
Solde refresh       : Subtle pulse glow sur le montant (300ms)
Chart appear        : Draw-in progressif de gauche à droite (600ms)
Transaction appear  : Staggered fade-in de haut en bas (50ms delay chacun)
Donut chart         : Rotation de 0° à position finale (800ms, spring)
                      Segments apparaissent un par un

SKELETON → CONTENU
────────────────────
Transition          : Crossfade (skeleton fade-out 200ms, content fade-in 300ms)
                      Layout stable (pas de layout shift)

FEEDBACK
────────────────────
Success             : Checkmark draw animation + confetti burst (léger)
Error               : Shake horizontal (3 oscillations, 300ms) + rouge flash
Loading             : Spinner → Progress bar (si le temps estimé est connu)
Pull to refresh     : Spring physics sur l'indicateur de refresh
```

### 7.6 Responsive Design

```
Breakpoints (Tailwind)
────────────────────
sm  : 640px   → Mobile landscape
md  : 768px   → Tablet portrait
lg  : 1024px  → Tablet landscape / Small desktop
xl  : 1280px  → Desktop standard
2xl : 1536px  → Large desktop

LAYOUT ADAPTATIF
────────────────────
Mobile (< 768px)  : Bottom navigation bar, cards full width, stacked layout
Tablet (768-1024) : Sidebar collapsible, 2 colonnes
Desktop (> 1024)  : Sidebar fixe, 3 colonnes, info dense

Le Dashboard en mobile :
  1. Net Worth (sticky top)
  2. Quick actions (horizontal scroll)
  3. Alertes IA (cards swipeable)
  4. Transaction feed (infinite scroll)
  5. Bottom nav : Dashboard | Comptes | Budget | Insights | Plus
```

---

## 8. Fonctionnalités innovantes

### 8.1 Auto-Budget Intelligent

Un système de budget qui **s'adapte à vous**, pas l'inverse.

```
Fonctionnement :
1. Analyse des 3 derniers mois de transactions
2. Détection automatique des catégories (alimentation, transport, loisirs…)
3. Proposition d'un budget RÉALISTE (pas arbitraire)
4. Suivi en temps réel avec progress bars animées
5. Alertes proactives : "Attention, tu as déjà dépensé 80% de ton budget resto"
6. Ajustement automatique si changement de revenus détecté

Différence vs. concurrence :
- Finary : Catégorisation manuelle, pas de budget auto
- OmniFlow : Catégorisation IA + budget qui s'adapte au comportement
```

### 8.2 Simulation de scénarios d'investissement

```
"Et si…" — L'utilisateur peut simuler :

Scenario A : "Et si j'investissais 200€/mois en ETF World ?"
  → Projection à 5, 10, 20, 30 ans
  → Graphique interactif avec range (pessimiste ↔ optimiste)
  → Comparaison avec Livret A, Assurance-vie, Crypto

Scenario B : "Et si je remboursais mon crédit en anticipé ?"
  → Calcul des intérêts économisés
  → Impact sur le Net Worth
  → Recommandation (investir vs. rembourser)

Scenario C : "Et si j'achetais un bien locatif à 200k€ ?"
  → Simulation cashflow locatif
  → Rendement brut/net/net-net
  → Impact DeFi + fiscalité (approximative)

UI : 
  → Sliders interactifs pour ajuster les paramètres
  → Graphique temps réel qui se met à jour pendant le drag
  → Comparaison côte-à-côte des scénarios
```

### 8.3 Détection de frais cachés

```
Le "Fee Hunter" — Analyse automatique des frais :

1. Frais de tenue de compte
2. Commissions de mouvement
3. Frais de carte (domestiques + internationaux)
4. Agios (découvert)
5. Frais de courtage (bourse)
6. Spreads cachés (crypto)
7. Frais de gestion (assurance-vie, PEA)

Fonctionnement :
  → Pattern matching sur les transactions (regex + ML)
  → Comparaison avec les grilles tarifaires connues
  → Alerte : "En 2025, vous avez payé 247€ de frais bancaires. 
             Avec [Banque X], vous auriez payé 12€."
  → Suggestion de switch avec lien direct
```

### 8.4 Flux de trésorerie prédictif

```
"Prévision à 30 jours" — Powered by IA

1. Analyse des revenus récurrents (salaire, loyers, dividendes)
2. Analyse des charges récurrentes (loyer, abonnements, crédits)
3. Estimation des dépenses variables (basée sur l'historique)
4. Intégration des événements connus (prélèvement annuel, impôts…)

UI :
  → Graphique en aire avec zone de confiance (bande grisée)
  → Ligne verte : scénario optimiste
  → Ligne rouge : scénario pessimiste  
  → Ligne blanche : scénario le plus probable
  → Marqueurs pour les événements prévus
  → Alerte si risque de découvert détecté
```

### 8.5 Patrimoine en temps réel multi-devises

```
Net Worth en live :

Banques    : Soldes → EUR (déjà en EUR)
Crypto     : Prix CoinGecko API → conversion EUR (refresh 30s)
Bourse     : Prix Yahoo Finance / Alpha Vantage → conversion EUR
Immobilier : Estimation annuelle (DVF + indices INSEE)
Dettes     : Capital restant dû → négatif

Conversion :
  → Forex : ECB API (gratuit, refresh 5min)
  → Crypto : CoinGecko API (gratuit tier, refresh 30s)
  → Cache Redis avec TTL adapté

Affichage :
  → Montant en EUR par défaut
  → Toggle pour voir en USD, BTC, ou devise native
  → Animation de compteur (CountUp) à chaque refresh
```

### 8.6 Score de santé financière

```
Le "OmniScore" — Note de 0 à 100

Calcul basé sur :
  ── Epargne de précaution (vs. 3 mois de charges)     : 25 points
  ── Taux d'endettement (vs. 33% max)                  : 20 points
  ── Diversification du patrimoine                       : 20 points
  ── Régularité de l'épargne                             : 15 points
  ── Croissance du Net Worth (tendance 6 mois)          : 10 points
  ── Frais bancaires (vs. médiane)                       : 10 points

UI :
  → Gauge animée circulaire (vert/orange/rouge)
  → Breakdown par critère
  → Historique du score
  → Recommandations personnalisées pour améliorer chaque critère
```

---

## 9. Algorithmes & Calculs financiers

### 9.1 Calcul du Net Worth

```python
def calculate_net_worth(user_id: str) -> NetWorth:
    """
    Net Worth = ACTIFS - PASSIFS
    Tout est converti en centimes EUR pour éviter les erreurs de float.
    """
    accounts = get_all_accounts(user_id)
    
    assets = 0       # Actifs (positifs)
    liabilities = 0  # Passifs (négatifs)
    
    for account in accounts:
        amount_eur = convert_to_eur_cents(
            amount=account.balance,
            currency=account.currency,
            rates=get_current_rates()
        )
        
        if account.type in (CHECKING, SAVINGS, INVESTMENT, CRYPTO):
            assets += amount_eur
        elif account.type in (LOAN, CREDIT_CARD_DEBT):
            liabilities += abs(amount_eur)
    
    # Ajouter l'immobilier (estimation)
    properties = get_real_estate(user_id)
    for prop in properties:
        assets += prop.estimated_value_cents
        if prop.remaining_mortgage:
            liabilities += prop.remaining_mortgage_cents
    
    return NetWorth(
        total=assets - liabilities,
        assets=assets,
        liabilities=liabilities,
        breakdown={
            "bank": sum_by_type(accounts, [CHECKING, SAVINGS]),
            "crypto": sum_by_type(accounts, [CRYPTO]),
            "stocks": sum_by_type(accounts, [INVESTMENT]),
            "real_estate": sum(p.estimated_value_cents for p in properties),
            "debts": -liabilities,
        },
        currency="EUR",
        computed_at=datetime.utcnow()
    )
```

### 9.2 Conversion de devises

```python
class CurrencyConverter:
    """
    Convertisseur multi-source avec cache Redis.
    """
    
    async def get_forex_rate(self, from_currency: str, to_currency: str) -> Decimal:
        """Taux ECB, cache 5 minutes."""
        cache_key = f"rates:forex:{from_currency}:{to_currency}"
        cached = await redis.get(cache_key)
        if cached:
            return Decimal(cached)
        
        rate = await ecb_api.get_rate(from_currency, to_currency)
        await redis.setex(cache_key, 300, str(rate))  # TTL 5 min
        return rate
    
    async def get_crypto_rate(self, crypto_id: str, vs_currency: str = "eur") -> Decimal:
        """Prix CoinGecko, cache 30 secondes."""
        cache_key = f"rates:crypto:{crypto_id}:{vs_currency}"
        cached = await redis.get(cache_key)
        if cached:
            return Decimal(cached)
        
        price = await coingecko_api.get_price(crypto_id, vs_currency)
        await redis.setex(cache_key, 30, str(price))  # TTL 30s
        return price
    
    async def convert(self, amount_cents: int, from_currency: str, to_currency: str = "EUR") -> int:
        """Convertir un montant en centimes."""
        if from_currency == to_currency:
            return amount_cents
        
        if from_currency in CRYPTO_CURRENCIES:
            rate = await self.get_crypto_rate(from_currency, to_currency.lower())
        else:
            rate = await self.get_forex_rate(from_currency, to_currency)
        
        return int(Decimal(amount_cents) * rate)
```

### 9.3 Détection de transactions récurrentes

```python
class RecurrenceDetector:
    """
    Détecte les transactions récurrentes (abonnements, salaire, loyer…).
    
    Algorithme :
    1. Grouper les transactions par marchand/label normalisé
    2. Pour chaque groupe, analyser la fréquence (hebdo, mensuel, annuel)
    3. Vérifier la régularité (écart-type des intervalles < seuil)
    4. Vérifier la stabilité des montants (variation < 20%)
    """
    
    def detect(self, transactions: list[Transaction]) -> list[RecurringTransaction]:
        groups = self._group_by_merchant(transactions)
        recurring = []
        
        for merchant, txns in groups.items():
            if len(txns) < 3:  # Minimum 3 occurrences
                continue
            
            intervals = self._calculate_intervals(txns)
            frequency = self._detect_frequency(intervals)
            
            if frequency and self._is_regular(intervals, frequency):
                amounts = [t.amount for t in txns]
                avg_amount = statistics.mean(amounts)
                
                recurring.append(RecurringTransaction(
                    merchant=merchant,
                    frequency=frequency,        # WEEKLY, MONTHLY, YEARLY
                    average_amount=avg_amount,
                    next_expected=self._predict_next(txns[-1].date, frequency),
                    confidence=self._calculate_confidence(intervals, amounts),
                ))
        
        return recurring
```

---

## 10. Sécurité & Privacy-first

### 10.1 Principes de sécurité

```
1. ZERO KNOWLEDGE (pour les credentials bancaires)
   → Les identifiants bancaires sont chiffrés côté client avant envoi
   → Le serveur ne peut PAS lire les credentials en clair
   → Seul l'utilisateur (avec son Master Password) peut déchiffrer

2. CHIFFREMENT AES-256-GCM
   → Chaque utilisateur a une Master Key dérivée de son password
   → Key Derivation : Argon2id (résistant aux attaques GPU)
   → Les credentials sont chiffrés dans PostgreSQL avec cette clé
   → Le serveur stocke uniquement le blob chiffré

3. AUTHENTIFICATION
   → JWT avec refresh tokens (access: 15min, refresh: 7 jours)
   → Rotation automatique des refresh tokens
   → Support 2FA (TOTP) pour les opérations sensibles
   → Rate limiting strict sur les endpoints auth

4. TRANSPORT
   → HTTPS obligatoire (HSTS)
   → Certificate pinning en mode PWA
   → CSP headers stricts

5. SESSION WOOB
   → Sessions éphémères (détruites après sync)
   → Aucun cookie bancaire persisté
   → Workers isolés (process séparé, pas de mémoire partagée)
```

### 10.2 Flow de chiffrement des credentials

```
[Client]                                [Serveur]
    │                                        │
    │  1. User entre son Master Password      │
    │  ────────────────────────────────       │
    │  master_key = Argon2id(password, salt)  │
    │                                        │
    │  2. User entre ses credentials banque   │
    │  ────────────────────────────────       │
    │  encrypted = AES-256-GCM(              │
    │    key=master_key,                      │
    │    plaintext=credentials,               │
    │    aad=user_id + bank_id               │
    │  )                                      │
    │                                        │
    │  3. Envoi du blob chiffré               │
    │  ───────────────────────────────────▶  │
    │                                        │
    │               [Le serveur ne peut PAS   │
    │                déchiffrer le blob]       │
    │                                        │
    │  4. Pour sync : le client envoie        │
    │     master_key (en TLS) + blob          │
    │  ───────────────────────────────────▶  │
    │                                        │
    │              [Worker déchiffre           │
    │               en mémoire, sync,         │
    │               puis efface la clé]       │
    │                                        │
    │  5. Résultat                            │
    │  ◀───────────────────────────────────  │
    │                                        │
```

### 10.3 Audit & Compliance

```
Audit Log :
  → Chaque connexion bancaire est logguée (sans credentials)
  → Chaque accès aux données est tracé
  → Log des tentatives de connexion échouées
  → Alertes sur les comportements suspects

RGPD :
  → Export complet des données (JSON)
  → Suppression totale du compte (hard delete)
  → Consentement explicite pour chaque connexion bancaire
  → Aucune donnée vendue ou partagée (jamais)
```

---

## 11. Intelligence Artificielle

### 11.1 Architecture IA

```
┌──────────────────── AI ENGINE ────────────────────────┐
│                                                        │
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Categorizer     │  │  Forecaster      │             │
│  │  (Classification │  │  (Prédiction     │             │
│  │   transactions)  │  │   trésorerie)    │             │
│  └────────┬────────┘  └────────┬────────┘             │
│           │                     │                       │
│  ┌────────┴────────┐  ┌────────┴────────┐             │
│  │  Anomaly         │  │  Advisor         │             │
│  │  Detector        │  │  (LangChain)     │             │
│  │  (Frais, fraude) │  │  Conseils perso  │             │
│  └─────────────────┘  └─────────────────┘             │
│                                                        │
│  Models :                                              │
│  ├── Categorizer  : Fine-tuned SentenceTransformer     │
│  │                  + règles métier                     │
│  ├── Forecaster   : Prophet (Meta) + features custom   │
│  ├── Anomaly      : Isolation Forest + rules engine    │
│  └── Advisor      : LangChain + Claude/GPT-4 API      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 11.2 Catégorisation des transactions

```python
class TransactionCategorizer:
    """
    Pipeline de catégorisation en 3 niveaux :
    
    Niveau 1 — Rules Engine (gratuit, instantané)
      → Regex sur les labels connus (SNCF → Transport, Carrefour → Alimentation)
      → 70% des transactions matchées
    
    Niveau 2 — ML Local (gratuit, rapide)
      → SentenceTransformer fine-tuned sur les transactions françaises  
      → Embedding du label → classification KNN
      → 25% des transactions restantes
    
    Niveau 3 — LLM Fallback (coûteux, dernier recours)
      → Pour les 5% de transactions ambiguës
      → Batch processing (pas en temps réel)
    """
    
    CATEGORIES = [
        "alimentation", "restaurant", "transport", "logement",
        "energie", "telecom", "assurance", "sante", "loisirs",
        "shopping", "education", "voyage", "epargne", "investissement",
        "revenu_salaire", "revenu_autre", "transfert", "frais_bancaires",
        "impots", "abonnement", "autre"
    ]
```

### 11.3 Prévision de trésorerie (30 jours)

```python
class CashFlowForecaster:
    """
    Modèle Prophet (Meta) + features financières custom.
    
    Features :
    - Solde quotidien historique (180 jours min)
    - Jour du mois (salaire le 28, loyer le 5, etc.)
    - Jour de la semaine (dépenses week-end vs. semaine)
    - Mois (variations saisonnières : vacances, impôts)
    - Indicateur de jours fériés
    - Transactions récurrentes connues (comme regresseurs)
    
    Output :
    - Prédiction point (le plus probable)
    - Intervalle de confiance 80%
    - Intervalle de confiance 95%
    - Alertes si découvert prévu dans les 30 jours
    """
    
    def forecast(self, user_id: str, days: int = 30) -> Forecast:
        history = self.get_daily_balances(user_id, lookback_days=180)
        recurring = self.get_recurring_transactions(user_id)
        
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )
        
        # Ajouter les transactions récurrentes comme regresseurs
        for txn in recurring:
            model.add_regressor(f"recurring_{txn.merchant}")
        
        model.fit(history)
        future = model.make_future_dataframe(periods=days)
        forecast = model.predict(future)
        
        return Forecast(
            predictions=[
                DailyPrediction(
                    date=row.ds,
                    amount=int(row.yhat),
                    lower_80=int(row.yhat_lower),
                    upper_80=int(row.yhat_upper),
                )
                for _, row in forecast.tail(days).iterrows()
            ],
            overdraft_risk=self._check_overdraft_risk(forecast),
        )
```

### 11.4 Conseiller IA (LangChain)

```python
class FinancialAdvisor:
    """
    Conseiller personnel basé sur LangChain.
    
    Utilise le contexte financier de l'utilisateur pour donner
    des conseils personnalisés et actionnables.
    
    IMPORTANT : 
    - Pas de conseil en investissement réglementé
    - Toujours mentionner "à titre informatif"
    - Données anonymisées pour les appels LLM
    """
    
    SYSTEM_PROMPT = """
    Tu es un conseiller financier personnel bienveillant.
    Tu analyses les données financières de l'utilisateur et donnes
    des conseils pratiques, concrets et personnalisés.
    Tu ne donnes JAMAIS de conseils d'investissement spécifiques.
    Tu mentionnes toujours que tes analyses sont à titre informatif.
    Tu parles en français, de manière claire et accessible.
    """
    
    def get_monthly_insights(self, user_context: UserFinancialContext) -> list[Insight]:
        """
        Génère des insights mensuels personnalisés.
        
        Exemples de insights :
        - "Vos dépenses restauration ont augmenté de 35% ce mois. 
           Voici comment les optimiser..."
        - "Vous avez 5000€ non investis sur votre compte courant. 
           À 2% d'inflation, vous perdez ~100€/an de pouvoir d'achat."
        - "Votre crédit immo à 2.5% pourrait être renégocié. 
           Les taux actuels sont à 1.8%, économie potentielle : 12 000€."
        """
```

---

## 12. PWA & Performance

### 12.1 Configuration PWA

```json
// manifest.json
{
  "name": "OmniFlow — Votre patrimoine unifié",
  "short_name": "OmniFlow",
  "description": "Agrégez banques, crypto, bourse, immobilier et dettes en une seule app.",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#000000",
  "background_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screenshots/dashboard.png", "sizes": "1080x1920", "type": "image/png" }
  ],
  "categories": ["finance", "productivity"],
  "shortcuts": [
    { "name": "Mon patrimoine", "url": "/dashboard", "icons": [{"src": "/icons/shortcut-networth.png"}] },
    { "name": "Mes comptes", "url": "/dashboard/banks", "icons": [{"src": "/icons/shortcut-accounts.png"}] }
  ]
}
```

### 12.2 Service Worker Strategy

```
STRATÉGIES DE CACHE
────────────────────

1. App Shell (Cache First)
   → Layout, CSS, JS bundles
   → Mis à jour en background après chaque visite
   → L'app se charge TOUJOURS instantanément

2. API Data (Stale While Revalidate)
   → Données financières (comptes, transactions)
   → Affiche le cache immédiatement
   → Fetch les nouvelles données en background
   → Met à jour l'UI si les données changent

3. Images & Fonts (Cache First, 30 jours)
   → Logos de banques, icônes
   → Rechargement uniquement si le hash change

4. API Rates (Network First, fallback cache)
   → Taux de change, prix crypto
   → Toujours tenter le réseau d'abord
   → Fallback sur le dernier prix connu

OFFLINE MODE
────────────────
→ Dashboard accessible avec les dernières données cachées
→ Badge "Hors ligne — dernière mise à jour il y a X min"
→ Les actions de modification sont mises en queue
→ Sync automatique au retour de la connexion
```

### 12.3 Objectifs de Performance

```
Core Web Vitals (Objectifs)
────────────────────────────
LCP  (Largest Contentful Paint) : < 1.5s  (Good: < 2.5s)
FID  (First Input Delay)        : < 50ms  (Good: < 100ms)
CLS  (Cumulative Layout Shift)  : < 0.05  (Good: < 0.1)
INP  (Interaction to Next Paint): < 100ms (Good: < 200ms)
TTFB (Time to First Byte)       : < 200ms
TTI  (Time to Interactive)       : < 2.0s

BUNDLE SIZE (Objectifs)
────────────────────────────
First Load JS  : < 80KB (gzipped)
Route chunks   : < 30KB chacun
Total app      : < 250KB (gzipped)

OPTIMISATIONS
────────────────────────────
1. React Server Components (RSC) pour le rendu initial
2. Dynamic imports pour les graphiques (lazy load Recharts/Visx)
3. Image optimization via next/image (WebP/AVIF)
4. Font optimization : Inter en variable font, font-display: swap
5. Prefetch des routes probables (next/link)
6. Streaming SSR avec Suspense boundaries
7. Edge Runtime pour les API routes non-Python
```

---

## 13. Phases d'implémentation

### Phase 1 — Infrastructure, Auth & Bridge Woob (Semaines 1-3)

> **Statut** : � Phase 1A TERMINÉE — Code backend + frontend + infra implémenté
> Phase 1B en attente de démarrage

Cette phase est découpée en **deux sous-étapes** pour garantir la qualité Pixel-Perfect
et une base technique irréprochable avant l'ajout de fonctionnalités.

---

#### Phase 1A — Fondations & Design System (Semaine 1)

```
OBJECTIF : Monorepo fonctionnel, backend opérationnel avec auth JWT,
           frontend avec Design System OLED complet et pages auth Pixel-Perfect.

━━━━━━━━━━━━━━━ BACKEND (FastAPI) ━━━━━━━━━━━━━━━

1. Projet FastAPI structuré (Clean Architecture)
   ✅ Entry point main.py avec lifespan (startup/shutdown hooks)
   ✅ Pydantic Settings v2 (config.py) — env-driven, validé au démarrage
   ✅ Structured logging (JSON) avec correlation_id par requête
   ✅ CORS middleware configurable (origines, méthodes, headers)
   ✅ Global exception handler avec réponses normalisées

2. PostgreSQL + SQLAlchemy 2.0 Async
   ✅ Async engine + async sessionmaker (pool_size=5, max_overflow=10)
   ✅ Base model avec UUID pk, created_at, updated_at auto-gérés
   ✅ Modèle User : email (unique, indexé), password_hash, name,
      master_key_salt (BYTEA), is_active, is_verified
   ✅ Alembic configuré avec async driver (asyncpg)
   ✅ Migration initiale auto-générée

3. Redis
   ✅ Connection pool async (aioredis via redis-py)
   ✅ Health check endpoint (/health → DB + Redis status)
   ✅ Namespace keys : "omniflow:{resource}:{id}"

4. Système d'authentification (Zero-Trust)
   ✅ POST /api/v1/auth/register
      → Validation Pydantic stricte (email normalisé, password 8+ chars, 
        1 majuscule, 1 chiffre, 1 spécial)
      → Hash bcrypt (12 rounds) via passlib
      → Génération salt aléatoire 32 bytes pour la future Master Key
      → Retourne access_token + refresh_token + user
   ✅ POST /api/v1/auth/login
      → Vérification bcrypt constant-time
      → Rate limiting : 5 tentatives / 15min par email (Redis counter)
      → Retourne JWT (access 15min, refresh 7 jours)
   ✅ POST /api/v1/auth/refresh
      → Rotation du refresh token (single-use, invalidation de l'ancien)
      → Stockage des refresh tokens actifs dans Redis (SET)
   ✅ GET /api/v1/auth/me — profil utilisateur courant
   ✅ JWT avec claims : sub (user_id), exp, iat, jti (unique token id)
   ✅ Middleware d'authentification injectable (Depends)
   ✅ Audit log sur chaque action auth (register, login, failed_login)

5. Infrastructure
   ✅ Docker Compose : api + db + redis (health checks, depends_on)
   ✅ Dockerfile multi-stage (builder + runtime slim)
   ✅ .env.example avec toutes les variables documentées
   ✅ Makefile avec commandes : dev, build, migrate, test, lint

━━━━━━━━━━━━━━━ FRONTEND (Next.js 14) ━━━━━━━━━━━━━━━

1. Setup Next.js 14 App Router
   ✅ TypeScript strict mode (noUncheckedIndexedAccess, exactOptionalPropertyTypes)
   ✅ Tailwind CSS avec le design system OmniUI intégré :
      → Palette OLED complète (background, surface, text, accents)
      → Semantic tokens : --color-gain, --color-loss, --color-brand
      → Font Inter variable (Google Fonts optimisé par Next.js)
      → Tabular nums activé globalement pour les chiffres financiers
   ✅ next-themes pour le toggle Dark/Light (défaut : dark)
   ✅ Framer Motion installé et configuré
   ✅ Lucide React pour les icônes

2. Design System "OmniUI" — Composants Pixel-Perfect
   ✅ <Button> : variants (primary, secondary, ghost, danger), sizes (sm, md, lg),
      loading state avec spinner inline, ripple effect au click
   ✅ <Input> : variants (default, error), label flottant animé,
      icône optionnelle (left/right), password toggle eye icon
   ✅ <Card> : glassmorphism subtil, hover elevation avec spring physics
   ✅ <Skeleton> : shimmer animation (gradient slide 1.5s ease-in-out infinite)
   ✅ <Logo> : composant SVG animé (draw-in effect au premier render)
   ✅ cn() utility (clsx + tailwind-merge) pour la composition de classes

3. Pages Auth — UX Premium
   ✅ Layout auth : split-screen (gauche = form, droite = illustration animée)
   ✅ /login : 
      → Email + Password avec validation inline (React Hook Form + Zod)
      → "Mot de passe oublié" link
      → Animations : form fade-in (staggered 50ms/champ), button press scale
      → Error shake animation (3 oscillations, 300ms)
      → Success : redirect avec page transition (Framer Motion)
   ✅ /register :
      → Name + Email + Password + Confirm Password
      → Password strength meter animé (4 niveaux, couleurs dynamiques)
      → Checkbox "J'accepte les CGU et la Politique de Confidentialité"
      → Animation success : confetti burst + redirect
   ✅ Skeleton loaders sur les pages auth (même pendant le hydrate)

4. API Client (lib/api-client.ts)
   ✅ Fetch wrapper typé avec intercepteurs
   ✅ Auto-refresh du token (intercepteur 401 → refresh → retry)
   ✅ Gestion centralisée des erreurs
   ✅ Types partagés (request/response)

5. State Management
   ✅ Zustand auth store (user, tokens, login, logout, refresh)
   ✅ Persistence du token dans httpOnly cookie (via API route Next.js)
   ✅ Provider pattern (QueryProvider, ThemeProvider, AuthProvider)

LIVRABLE Phase 1A : 
  → Backend : API auth fonctionnelle, DB migrée, Redis opérationnel
  → Frontend : Pages login/register Pixel-Perfect, thème OLED, Design System
  → Infra : Docker Compose one-command startup
  → TEST : Un utilisateur peut s'inscrire, se connecter, voir son profil
```

---

#### Phase 1B — Bridge Woob & Onboarding bancaire (Semaines 2-3)

```
OBJECTIF : Intégrer Woob dans le backend, gérer la SCA via WebSocket,
           et offrir un onboarding bancaire fluide et rassurant.

━━━━━━━━━━━━━━━ BACKEND ━━━━━━━━━━━━━━━

1. Woob Engine v1
   ✅ Installation de Woob dans le container Docker (apt + pip)
   ✅ WoobManager : singleton qui gère le pool de workers
      → Max 3 workers concurrents par utilisateur
      → Timeout global de 120s par sync
      → Retry automatique (3 tentatives, backoff exponentiel)
   ✅ WoobWorker : connexion unitaire à une banque
      → Chargement dynamique du module Woob (load_backend)
      → iter_accounts() → NormalizedAccount[]
      → iter_history() → NormalizedTransaction[]
      → Gestion des exceptions Woob (BrowserIncorrectPassword, 
        BrowserUnavailable, NeedInteractiveFor2FA)
   ✅ SCA Handler via WebSocket :
      → ws://localhost:8000/ws/sync/{connection_id}
      → Événements : sca_required, sca_response, progress, completed, error
      → Timeout SCA : 120s avec message de relance à 60s
   ✅ Normalizer v1 :
      → Mapping des types de comptes Woob → AccountType OmniFlow
      → Montants convertis en centimes (int, jamais de float)
      → Labels nettoyés (trim, normalisation des espaces, capitalisation)
      → Déduplication par external_id

2. Modèles de données (SQLAlchemy)
   ✅ BankConnection : user_id, bank_module, bank_name, 
     encrypted_credentials (BYTEA), status, last_sync_at, last_error
   ✅ Account : connection_id, external_id, type, label, balance (BIGINT),
     currency, metadata (JSONB)
   ✅ Transaction : account_id, external_id, date, amount (BIGINT), 
     label, raw_label, type, category (nullable)
   ✅ Migrations Alembic pour ces 3 tables

3. Chiffrement des credentials (AES-256-GCM)
   ✅ Endpoint POST /api/v1/connections — reçoit le blob chiffré
   ✅ Déchiffrement en mémoire uniquement pendant le sync
   ✅ Nonce unique par opération de chiffrement
   ✅ AAD (Additional Authenticated Data) = user_id + bank_module

4. API Endpoints
   ✅ GET    /api/v1/connections — liste les connexions de l'utilisateur
   ✅ POST   /api/v1/connections — crée une nouvelle connexion bancaire
   ✅ DELETE /api/v1/connections/{id} — supprime connexion + données
   ✅ POST   /api/v1/connections/{id}/sync — force une re-sync
   ✅ GET    /api/v1/accounts — liste les comptes agrégés
   ✅ GET    /api/v1/accounts/{id}/transactions — transactions paginées
   ✅ GET    /api/v1/banks — liste des banques supportées (modules Woob)

5. Celery Tasks
   ✅ Task sync_bank_connection : exécute un WoobWorker en background
   ✅ Celery Beat : re-sync automatique toutes les 6h
   ✅ Dead letter queue pour les syncs échouées

━━━━━━━━━━━━━━━ FRONTEND ━━━━━━━━━━━━━━━

1. Onboarding Flow (modal multi-step avec animations)
   ✅ Step 1 — Sélection de banque :
      → Search bar avec autocomplétion (fuzzy match)
      → Grid de banques populaires (logos SVG, hover glow)
      → Animation : cards fade-in staggered
   ✅ Step 2 — Credentials :
      → Formulaire dynamique selon la banque (identifiant + mot de passe)
      → Chiffrement AES-256 côté client (Web Crypto API)
      → Explication Privacy-first avec icône bouclier animée
   ✅ Step 3 — Synchronisation :
      → Progress bar temps réel (WebSocket)
      → Si SCA requis : instructions claires avec illustration
      → Input OTP avec auto-focus entre les chiffres
   ✅ Step 4 — Succès :
      → Confetti animation
      → Aperçu des comptes détectés (mini-cards)
      → CTA "Voir mon dashboard" / "Ajouter une autre banque"

2. Dashboard Layout (structure prête, contenu Phase 2+)  
   ✅ Sidebar responsive :
      → Desktop : fixe 260px, icônes + labels
      → Tablet : collapsée 60px, icônes seules, expand on hover
      → Mobile : hidden, remplacée par bottom nav
   ✅ Bottom Navigation (mobile) :
      → 5 items avec icônes Lucide + label
      → Active state : icône filled + couleur brand
      → Animation : tap bounce (scale 0.9 → 1.0, spring)
   ✅ Page Dashboard placeholder avec skeletons élégants

3. Page Comptes (vue basique)
   ✅ Liste des comptes groupés par banque
   ✅ AccountCard : logo + nom + solde (CountUp animation)
   ✅ Pull-to-refresh sur mobile
   ✅ Empty state si aucun compte ("Connectez votre première banque")

4. WebSocket Client
   ✅ Hook useWebSocket(url) avec auto-reconnect
   ✅ Gestion des événements sync (progress, sca, completed)
   ✅ Toast notifications pour les événements importants

LIVRABLE Phase 1B :
  → Un utilisateur peut connecter sa banque (Woob), gérer la SCA
  → Les comptes et transactions sont synchronisés et affichés
  → L'onboarding est fluide, rassurant, et visuellement impressionnant
  → TEST : Flow complet register → onboarding → voir ses comptes
```

### Phase 2 --- Core Engine & Transaction Intelligence (Semaines 4-6)

> **Statut** : Phase 2A TERMINEE --- Woob Production Engine + Transaction Intelligence

Phase decoupee en **deux sous-etapes** pour une qualite industrielle.

---

#### Phase 2A --- Woob Production Engine & Intelligence Financiere (Semaines 4-5)

```
OBJECTIF : Woob production-ready (zero mock), categorisation intelligente
           des transactions, calcul du Net Worth, sync periodique, sidebar
           navigation et pages detaillees comptes/transactions.

BACKEND :
1. Woob Production Install (zero demo, zero mock)
   [x] Docker : git + pip install woob + dependances systeme bancaires FR
   [x] Suppression totale de demo.py et tout code mock/fallback
   [x] WoobWorker : connexions reelles uniquement via load_backend()
       -> Retry : 3 tentatives, backoff exponentiel (2s -> 4s -> 8s)
       -> Timeout : 120s par sync, annulation gracieuse
       -> Error handling : BrowserIncorrectPassword, NeedInteractiveFor2FA,
          BrowserQuestion, BrowserUnavailable -> messages FR localises
   [x] Normalizer production :
       -> NormalizedAccount / NormalizedTransaction (dataclasses typees)
       -> Mapping types Woob -> AccountType/TransactionType OmniFlow
       -> Montants convertis en centimes (int, JAMAIS float)
       -> Labels nettoyes : trim, normalisation espaces, capitalisation
       -> Deduplication par external_id (UPSERT ON CONFLICT)

2. Transaction Categorizer v1 (Rules Engine)
   [x] 150+ regex patterns pour les marchands FR :
       -> Grandes surfaces, Transport, Abonnements, Banque, etc.
   [x] 15 categories principales + 50+ sous-categories fines
   [x] Detection de merchant depuis raw_label
   [x] Detection de transactions recurrentes (pattern matching)
   [x] Categorisation automatique a chaque sync

3. Net Worth Engine
   [x] Modele BalanceSnapshot : account_id, balance, captured_at
   [x] Capture automatique : snapshots apres chaque sync
   [x] Calcul Net Worth : SUM(accounts.balance) avec groupement par type
       -> Breakdown : Liquidites, Epargne, Investissements, Dettes
       -> Variation : absolue + pourcentage vs periode precedente
   [x] Time-series : 7j, 30j, 90j, 1an, tout

4. Background Sync (APScheduler)
   [x] Sync periodique : toutes les 6h par connexion active
   [x] Re-categorisation automatique post-sync
   [x] Capture de snapshots apres chaque sync reussie
   [x] Logging structure de chaque sync

5. API Endpoints Phase 2A
   [x] GET  /api/v1/networth --- patrimoine courant + breakdown par type
   [x] GET  /api/v1/networth/history?period=30d --- time-series
   [x] GET  /api/v1/transactions/search?q=&category=&from=&to= --- recherche
   [x] GET  /api/v1/categories --- liste categories avec stats

6. Migration 003 --- Production Ready
   [x] Suppression colonne is_demo de bank_connections
   [x] Purge des donnees demo existantes
   [x] Table balance_snapshots (account_id, balance, captured_at, index)
   [x] Index composites pour les requetes de recherche transactions

FRONTEND :
1. Dashboard Layout (Sidebar + Bottom Nav)
   [x] Sidebar responsive : Desktop 260px, Tablet 64px, Mobile hidden
   [x] Bottom Navigation mobile : 5 items avec animations
   [x] Layout avec sidebar pour toutes les pages dashboard

2. Net Worth Hero (composant vedette du dashboard)
   [x] Compteur anime CountUp (0 -> valeur reelle, 1.2s, ease-out)
   [x] Badge variation : +X.X% ou -X.X% vs mois dernier
   [x] Breakdown horizontal avec barre de proportion coloree

3. Page Banques (/banks)
   [x] Comptes groupes par banque (sections depliables)
   [x] Indicateur de statut connexion (vert/orange/rouge)
   [x] Bouton Sync par connexion + dernier sync timestamp
   [x] AccountCard ameliore : icone type + solde
   [x] Empty state : CTA "Connecter votre premiere banque"

4. Page Detail Compte (/banks/[accountId])
   [x] Header : solde + type + nom banque + badge categorie
   [x] Transaction list avec infinite scroll (IntersectionObserver)
   [x] Barre de recherche/filtres : texte libre, categorie multi-select
   [x] Category badge colore (icone + label)

5. Transaction Row ameliore
   [x] Category badge colore (icone + label)
   [x] Merchant extrait et mis en avant
   [x] Indicateur recurrent (icone)
   [x] Amount color-coded : vert (credit) / rouge (debit)

6. Modal Connexion (production)
   [x] Plus de flag demo=true : envoi direct des credentials
   [x] Sync en temps reel via progress bar

LIVRABLE Phase 2A :
  -> Woob 100% production (aucun mock), sync reelle avec banques FR
  -> Transactions categorisees automatiquement (150+ patterns)
  -> Net Worth calcule avec historique (snapshots)
  -> Dashboard avec sidebar responsive + pages banques/comptes detaillees
```

---

#### Phase 2B --- Multi-Assets & Visualisation Avancee (Semaine 6)

```
OBJECTIF : Agregation crypto/bourse/immobilier, charts interactifs,
           multi-devises, cash flow analysis.

BACKEND :
1. Module Crypto v1
   [x] Binance API : portefeuille spot + earn + staking
   [x] Kraken API : portefeuille spot + staking
   [x] On-chain : Etherscan API pour ETH/ERC-20 (adresse publique)
   [x] Prix temps reel : CoinGecko API (cache Redis 60s)
   [x] P&L par token : prix d'achat moyen vs prix actuel

2. Module Bourse v1
   [x] Yahoo Finance API : positions, cours, dividendes
   [x] Import CSV : Degiro, Trade Republic, Boursorama
   [x] Performance TWR (Time-Weighted Return) par position

3. Module Immobilier v1
   [x] Saisie manuelle : adresse, prix achat, estimation actuelle
   [x] DVF API (Demandes de Valeurs Foncieres) pour estimation locale
   [x] Rendement locatif : loyers - charges - credit

4. Multi-Currency Engine
   [x] ECB daily rates API (cache Redis 24h)
   [x] Conversion automatique en devise de base (EUR)

5. Cash Flow Engine
   [x] Calcul revenus vs depenses par periode (semaine/mois/trimestre)
   [x] Detection tendances (moyenne mobile 3 mois)
   [x] API : GET /api/v1/cashflow?period=monthly&months=6

FRONTEND :
1. Page Crypto (/crypto)
   [x] Portfolio overview : valeur totale + P&L global + variation 24h
   [x] Token list : sparkline 7j, P&L individuel, allocation %

2. Page Bourse (/stocks)
   [x] Positions table : triable, performance %, dividendes
   [x] Import CSV wizard (drag & drop)

3. Page Immobilier (/realestate)
   [x] Fiche bien : rendement, plus-value latente, cash-flow
   [x] Formulaire ajout/edition

4. Charts Interactifs (Recharts)
   [x] Evolution patrimoine (Line chart, 3M/6M/1A/All toggle)
   [x] Cash Flow (Area chart, revenus vs depenses superposes)
   [x] Repartition (Donut interactif, drill-down par categorie)
   [x] Depenses (Bar chart horizontal, top 10 categories)

LIVRABLE Phase 2B : ✅ COMPLETED
  -> Multi-assets : banques + crypto + bourse + immobilier agreges
  -> Charts interactifs avec animations fluides
  -> Cash flow analysis avec tendances
  -> Multi-devises (EUR/USD) avec conversion automatique

IMPLEMENTATION NOTES Phase 2B :
  Backend (apps/api/) :
    - 5 new models : crypto_wallets, crypto_holdings, stock_portfolios, stock_positions, real_estate_properties
    - Migration 004_multi_assets applied (11 DB tables total)
    - 7 services : crypto_service, stock_service, realestate_service, cashflow_service, currency_service, dvf_service, encryption_service
    - 4 route files : crypto.py, stocks.py, realestate.py, cashflow.py
    - Real APIs : CoinGecko, Binance (HMAC-SHA256), Kraken (HMAC-SHA512), Etherscan, Yahoo Finance, DVF/CQuest, ECB
    - AES-256-GCM encryption for API keys, Redis caching (60s-24h TTL)
    - APScheduler hourly price refresh jobs
  Frontend (apps/web/) :
    - 3 Zustand stores : crypto-store, stock-store, realestate-store
    - 3 pages : /crypto, /stocks, /realestate with full CRUD modals
    - 4 Recharts components : patrimoine-chart, cashflow-chart, allocation-donut, expenses-bar-chart
    - Dashboard updated : multi-asset aggregation, charts grid, quick links
    - Sidebar/bottom-nav updated with Bourse + Immobilier routes
  Verified Endpoints (7/7) :
    - GET /crypto, GET /stocks, GET /realestate, GET /cashflow
    - GET /currencies/rates, POST /currencies/convert, GET /networth
  Frontend Build : ✅ 13 pages compiled successfully (incl. /budget, /settings)
```

### Phase 3 — Dashboard Pixel-Perfect & UX Excellence (Semaines 7-9)

> **Statut** : ✅ Phase 3A TERMINÉE — Dashboard Overhaul & Composants Premium implémentés
> Build vérifié : 13 pages compilées avec succès (dont /budget, /settings, /dashboard refactoré)

Phase découpée en **deux sous-étapes** pour garantir une qualité Pixel-Perfect
et une UX qui surpasse Finary et Trade Republic.

---

#### Phase 3A — Dashboard Overhaul & Composants Pixel-Perfect (Semaines 7-8)

```
OBJECTIF : Refactoring complet du dashboard monolithique (469 lignes) en 
           composants modulaires, réutilisables et animés. Suppression du header
           redondant, intégration du NetWorthHero existant (inutilisé), ajout de
           composants premium (StatCard, Sparkline, ActivityFeed, QuickActions),
           page Settings fonctionnelle, page Budget (analyse auto), et redirection
           racine. Objectif : que chaque pixel respire la confiance financière.

PRINCIPES UX PHASE 3 (Supériorité sur Finary/Trade Republic) :
  → "Glanceable Dashboard" : en 2 secondes, l'utilisateur sait si son patrimoine
    va bien (inspiration Apple Watch complications)
  → "Progressive Disclosure" : les données détaillées se révèlent au clic,
    pas en surcharge initiale
  → "Micro-Delight" : chaque interaction produit un feedback subtil mais satisfaisant
    (hover glow, press scale, count-up, stagger)
  → "Zero Layout Shift" : skeletons identiques aux composants finaux (CLS = 0)
  → "Responsive-First" : mobile ≠ desktop rétréci, c'est une UX repensée
  → "Temps réel perçu" : les données stale s'affichent instantanément avec
    un badge "Mis à jour il y a X min" + refresh subtle en background

━━━━━━━━━━━━━━━ FRONTEND — Nouveaux composants ━━━━━━━━━━━━━━━

1. <DashboardHeader /> — Barre contextuelle premium
   [x] Greeting dynamique (Bonjour/Bonsoir + prénom) avec heure locale
   [x] Badge "Dernière sync il y a X min" (temps relatif, mise à jour live)
   [x] Bouton "Ajouter un actif" avec dropdown (Banque, Crypto, Bourse, Immobilier)
   [x] Bouton refresh global avec animation rotation pendant le sync
   [x] Responsive : salutation + boutons sur mobile, full info sur desktop

2. <StatCard /> — Tuile métrique polyvalente
   [x] Icône + Titre + Montant (CountUp animation, ease-out, 800ms)
   [x] Variation vs période précédente (badge coloré vert/rouge)
   [x] Mini-sparkline intégrée (7 derniers jours, dessinée en 600ms)
   [x] Hover : elevation + glow subtil (box-shadow brand/10, 150ms spring)
   [x] Loading state : skeleton exact-match (même dimensions, shimmer)
   [x] Props : title, amount, change, icon, color, sparklineData, onClick
   [x] Utilisé pour : Liquidités, Crypto, Bourse, Immobilier

3. <Sparkline /> — Mini-graphique inline
   [x] SVG pur (aucune dépendance Recharts) — 60x24px par défaut
   [x] Polyline smooth (Catmull-Rom interpolation pour courbe naturelle)
   [x] Gradient fill sous la courbe (couleur → transparent)
   [x] Animation draw-in (strokeDasharray + strokeDashoffset, 600ms)
   [x] Props : data: number[], color, width, height, animated

4. <ActivityFeed /> — Flux d'activité intelligent
   [x] Dernières 15 transactions tous comptes confondus (triées par date)
   [x] Transaction row amélioré : icône catégorie, merchant highlight, montant coloré
   [x] Badge "récurrent" (icône repeat) si is_recurring = true
   [x] Staggered fade-in (50ms delay entre chaque row)
   [x] Lien "Voir tout" → /banks
   [x] Empty state élégant si aucune transaction
   [x] Skeleton : 5 rows fantômes pendant le chargement

5. <QuickActions /> — Actions rapides contextuelle
   [x] Grille horizontale scrollable (mobile) / grille fixe (desktop)
   [x] Actions : Ajouter banque, Ajouter crypto, Ajouter action, Ajouter bien
   [x] Chaque action : icône dans cercle coloré + label
   [x] Hover : scale(1.05) + border brand/30
   [x] Animation : staggered slide-up au premier render

6. Intégration de <NetWorthHero /> existant (composant déjà codé mais inutilisé !)
   [x] Remplacement du bloc Net Worth inline par le composant dédié
   [x] Props alimentées par les données netWorth API : total, change, breakdown
   [x] Breakdown adapté : Liquidités, Crypto, Bourse, Immobilier, Dettes

━━━━━━━━━━━━━━━ FRONTEND — Dashboard rewrite ━━━━━━━━━━━━━━━

7. Dashboard Page refactorisé (de 469 → ~120 lignes)
   [x] Suppression du <header> redondant (le layout a déjà la sidebar)
   [x] Composition propre : DashboardHeader + NetWorthHero + StatCards grid
       + Charts grid + ActivityFeed + QuickActions
   [x] Framer Motion AnimatePresence pour les transitions entre états
   [x] Layout responsive :
       → Desktop (xl+) : 4 colonnes stat cards, 2 colonnes charts, feed latéral
       → Tablet (md-lg) : 2 colonnes stat cards, charts empilés
       → Mobile (<md) : 1 colonne, cards horizontaux scrollables
   [x] Tous les fetches déclenchés en parallèle au mount
   [x] Chaque section a son skeleton dédié (zéro layout shift)

8. Page Settings (/settings) — Première version fonctionnelle
   [x] Profil : nom, email (lecture seule), avatar initial
   [x] Connexions : liste des connexions bancaires + crypto + bourse
       → Statut temps réel, bouton sync, bouton supprimer
   [x] Préférences : devise de base (EUR/USD), dark mode toggle
   [x] Sécurité : changement de mot de passe, dernières connexions
   [x] Danger zone : supprimer le compte (avec confirmation double)
   [x] Layout : sidebar de sections (desktop) / accordéon (mobile)
   [x] Animations : section switch avec fade crossfade

9. Page Budget (/budget) — Vue analytique auto-générée
   [x] Analyse automatique des dépenses sur la période sélectionnée (1M/3M/6M)
   [x] Répartition par catégorie : barre de progression colorée + montant + %
   [x] Top 5 marchands par montant
   [x] Revenus vs dépenses : barre comparative (vert/rouge)
   [x] Taux d'épargne : gauge circulaire (épargne / revenus × 100)
   [x] Tendance : flèche up/down vs période précédente
   [x] Empty state si pas assez de données
   [x] Skeleton complet pendant le chargement

10. Infrastructure & Navigation
    [x] Root redirect : / → /dashboard (middleware Next.js ou page.tsx redirect)
    [x] Sidebar : retrait du badge "Bientôt" sur Budget (page maintenant active)
    [x] Sidebar : ajout entrée "Réglages" dans la section navigation
    [x] AnimatePresence sur le layout pour transitions entre pages

━━━━━━━━━━━━━━━ BACKEND — Optimisations Phase 3A ━━━━━━━━━━━━━━━

11. Endpoint GET /api/v1/dashboard/summary (nouveau — agrégation optimisée)
    [x] Retourne en UNE requête : netWorth + breakdown + last 15 transactions
        + sparkline data (7 derniers jours par asset class) + dernière sync
    [x] Cache Redis 60s (clé: dashboard:summary:{user_id})
    [x] Invalidation automatique à chaque sync Woob
    [x] Réduit les appels frontend de 5+ à 1 seul au chargement du dashboard

12. Endpoint GET /api/v1/budget/analysis (nouveau — analyse auto)
    [x] Agrège les transactions par catégorie sur la période demandée
    [x] Calcule : total par catégorie, top marchands, taux d'épargne
    [x] Compare avec la période précédente (tendance up/down/stable)
    [x] Cache Redis 5min

LIVRABLE Phase 3A :
  → Dashboard Pixel-Perfect, modulaire, animé, responsive
  → NetWorthHero intégré avec CountUp + breakdown
  → StatCards avec sparklines et variations temps réel
  → ActivityFeed avec dernières transactions multi-comptes
  → Page Settings fonctionnelle (profil, connexions, préférences)
  → Page Budget avec analyse automatique des dépenses
  → Redirection racine / → /dashboard
  → Sidebar mise à jour (Budget actif, Settings accessible)
  → Backend : 2 nouveaux endpoints optimisés (summary + budget analysis)
  → TEST : Flow complet login → dashboard animé → naviguer pages → settings
```

---

> **Statut** : ✅ Phase 3B TERMINÉE — Animations cinématiques, Dark/Light toggle, OmniScore, Notifications, Dezoom global

#### Phase 3B — Animations Cinématiques, Thème Dynamique & OmniScore (Semaine 9)

```
OBJECTIF : Pousser les animations au niveau cinématique (type Linear/Stripe),
           ajouter le dark/light mode toggle dynamique, l'OmniScore (score de
           santé financière), les notifications intelligentes, et le polish final
           pour une démo FinTech "wow effect". Chaque interaction doit être aussi
           satisfaisante qu'un swipe sur Trade Republic.

━━━━━━━━━━━━━━━ FRONTEND — Animations & Interactions ━━━━━━━━━━━━━━━

1. Page Transition System (Framer Motion layoutId + AnimatePresence)
   □ Crossfade 200ms entre pages (opacity + subtle scale 0.98→1.0)
   □ Shared layout animations : les cartes du dashboard "volent" vers
     la page détail quand on clique (layoutId partagé)
   □ Back navigation : reverse animation (détail → dashboard)
   □ Mobile : slide-in horizontale (push/pop stack style natif)

2. Chart Animations Cinématiques
   □ PatrimoineChart : line draw-in progressif gauche→droite (800ms, ease-out)
     + gradient area reveal en même temps + tooltip qui apparaît au survol
     avec crosshair vertical animé
   □ AllocationDonut : segments apparaissent un par un (stagger 100ms)
     avec rotation initiale 0°→360° (spring, stiffness: 100)
   □ CashFlowChart : barres grow-up de la baseline (stagger 50ms)
   □ Sparklines : stroke draw-in identique au PatrimoineChart (600ms)

3. Glassmorphism Cards (style premium)
   □ Net Worth Hero : fond glassmorphism (backdrop-blur-xl + gradient overlay)
   □ Modal overlays : glass effect (background rgba(0,0,0,0.6) + blur)
   □ Dropdown menus : glass card effect
   □ Hover glow : radial gradient qui suit le curseur (comme Stripe)

4. Dark/Light Mode Toggle
   □ Bouton toggle dans la sidebar (icône Sun/Moon avec animation rotation)
   □ Transition fluide (CSS transition sur les custom properties)
   □ Respect de la préférence système au premier chargement
   □ Persistance du choix en localStorage

5. Pull-to-Refresh (mobile)  
   □ Gesture natif : swipe-down depuis le haut du scroll
   □ Indicateur spring (overshoot puis release)
   □ Refresh de toutes les données (networth + accounts + transactions)
   □ Haptic feedback (si supporté par le device)

━━━━━━━━━━━━━━━ FRONTEND — OmniScore & Notifications ━━━━━━━━━━━━━━━

6. OmniScore — Score de santé financière (0-100)
   □ Gauge SVG circulaire animée (arc coloré : rouge→orange→vert)
   □ Score central en grand (CountUp animation)
   □ 6 critères avec progress bars individuelles :
     → Épargne de précaution (25 pts), Taux d'endettement (20 pts),
       Diversification (20 pts), Régularité épargne (15 pts),
       Croissance patrimoine (10 pts), Frais bancaires (10 pts)
   □ Historique du score (sparkline 6 derniers mois)
   □ Recommandations personnalisées (IA-ready) sous forme de cards actionnables
   □ Accessible depuis un widget dans le dashboard (mini gauge)

7. Notification Center (in-app)
   □ Icône cloche dans le header avec badge compteur (non lus)
   □ Dropdown avec liste des alertes :
     → Sync terminée, Frais détectés, Patrimoine en hausse/baisse,
       Budget dépassé, Anomalie détectée
   □ Toast notifications pour les événements temps réel (Woob sync)
   □ Mark as read / dismiss all
   □ Animations : slide-in du dropdown, fade-in staggered des items

8. Composants "Delight"
   □ Confetti burst léger au franchissement de seuils patrimoine
     (ex: patrimoine passe de 99K à 100K€)
   □ Smooth number transitions partout (pas de saut brutal des montants)
   □ Hover states magnétiques sur les cartes (tilt 3D subtil via CSS perspective)
   □ Loading states : skeleton shimmer IDENTIQUE à la forme du composant final

━━━━━━━━━━━━━━━ BACKEND — OmniScore & Notifications ━━━━━━━━━━━━━━━

9. Endpoint GET /api/v1/insights/score
   □ Calcul du score basé sur :
     → Épargne vs 3 mois de charges (query balance_snapshots + transactions)
     → Taux d'endettement : dettes / revenus mensuels
     → Nombre de classes d'actifs (banque, crypto, bourse, immo)
     → Régularité de l'épargne (mois avec épargne positive / 12)
     → Croissance Net Worth sur 6 mois (balance_snapshots time series)
     → Frais bancaires annuels vs médiane estimée
   □ Cache Redis 24h (recalcul quotidien ou à chaque sync)

10. Endpoint GET /api/v1/notifications
    □ Liste des notifications in-app (type, title, body, created_at, is_read)
    □ Génération automatique après chaque sync :
      → "3 comptes synchronisés avec succès"
      → "Frais de X€ détectés sur [banque]"
      → "Votre patrimoine a augmenté de X% ce mois-ci"
    □ PATCH /api/v1/notifications/{id}/read — marquer comme lue

LIVRABLE Phase 3B :
  → Animations cinématiques (transitions, chart draw-in, stagger)
  → Dark/Light mode toggle fonctionnel
  → OmniScore avec gauge circulaire + critères détaillés
  → Centre de notifications in-app
  → Pull-to-refresh mobile
  → Polish final : glassmorphism, hover glow, confetti milestones
  → UX qui rivalise avec Linear/Stripe/Finary
  → TEST : Navigation fluide entre toutes les pages, toggle theme,
           OmniScore affiché, notifications après sync
```

### Phase 4 — Intelligence Artificielle & Auto-Budget (Semaines 10-12)

> **Statut** : ✅ Phase 4A TERMINÉE — Moteur IA Local + Auto-Budget + Anomalies + Prévisions + Insights
> ✅ Phase 4B TERMINÉE — Nova AI Advisor (LLM) + Simulateur Monte-Carlo + Chat SSE

Phase découpée en **deux sous-étapes** pour une intelligence financière qui surpasse
Finary (insights basiques) et Trade Republic (zéro IA). L'objectif : que l'app ANTICIPE
les besoins de l'utilisateur avant qu'il n'y pense lui-même.

**Philosophie IA OmniFlow** : "Local-First Intelligence"
  → AUCUNE dépendance à un LLM cloud pour les features critiques (Phase 4A)
  → Algorithmes statistiques embarqués : rapides, gratuits, offline-capable
  → LLM optionnel en Phase 4B pour le conseil personnalisé (advisor chat)

---

#### Phase 4A — Moteur IA Local, Auto-Budget & Détection d'Anomalies (Semaines 10-11)

```
OBJECTIF : Construire un moteur d'intelligence financière 100% local (zéro API
           externe) qui analyse les transactions, génère des budgets automatiques,
           détecte les anomalies de dépenses, prédit le cash-flow à 30 jours, et
           présente tout ça dans une page Insights Pixel-Perfect avec des cartes
           actionnables. Chaque insight doit être personnalisé ET compréhensible
           par un non-expert financier.

INNOVATION vs CONCURRENCE :
  → Finary : insights manuels, pas de forecast, pas d'anomalies
  → Trade Republic : zéro intelligence, juste un historique
  → OmniFlow : prédictions statistiques, auto-budget ML-free, anomalies en
    temps réel, recommandations contextuelles, tout en local

━━━━━━━━━━━━━━━ BACKEND — Moteur IA ━━━━━━━━━━━━━━━

1. Auto-Budget Engine (app/ai/auto_budget.py) — Zéro ML, 100% Statistique
   □ Analyse des 3 derniers mois de transactions catégorisées
   □ Calcul par catégorie : médiane (robuste aux outliers), percentile 75 (plafond)
   □ Génération automatique de budgets mensuels avec 3 niveaux :
     → "Confortable" : médiane + 20% (réaliste)
     → "Optimisé" : médiane (effort modéré)
     → "Agressif" : médiane - 15% (épargne maximale)
   □ Détection des catégories à risque (variation > 30% vs moyenne)
   □ Calcul du gain potentiel : si chaque catégorie respectait le budget "Optimisé"
   □ Suivi en temps réel : dépenses du mois en cours vs budget
   □ Progression jour par jour : courbe de dépenses réelle vs budget linéaire
   □ Alertes automatiques : 50%, 80%, 100%, 120% du budget atteint
   □ Historique mensuel : comparaison budget vs réel sur 6 mois glissants

   ALGORITHME AUTO-BUDGET :
   ┌─────────────────────────────────────────────────────────┐
   │ Pour chaque catégorie C :                               │
   │   1. Extraire montants mensuels M[1..N] (N=3 mois min) │
   │   2. Exclure les outliers via IQR (Q1-1.5*IQR, Q3+1.5) │
   │   3. budget_confort = median(M_clean) * 1.20            │
   │   4. budget_opti    = median(M_clean)                   │
   │   5. budget_aggro   = median(M_clean) * 0.85            │
   │   6. volatility     = std(M_clean) / mean(M_clean)      │
   │   7. Si volatility > 0.30 → flag "catégorie instable"  │
   └─────────────────────────────────────────────────────────┘

2. Anomaly Detector (app/ai/anomaly_detector.py) — Statistique + Rules
   □ Détection en temps réel à chaque sync (post-categorization hook)
   □ 4 types d'anomalies détectées :
     → UNUSUAL_AMOUNT : transaction > 3σ de la moyenne de sa catégorie
     → DUPLICATE_SUSPICION : même montant + même merchant < 48h
     → NEW_RECURRING : nouveau prélèvement récurrent détecté (3+ occurrences)
     → HIDDEN_FEE : frais bancaires inhabituels (pattern matching amélioré)
   □ Score de confiance (0.0-1.0) pour chaque anomalie
   □ Contexte enrichi : "Ce prélèvement X est 340% supérieur à votre moyenne
     habituelle de Y€ pour la catégorie Z"
   □ Stockage en DB : table `ai_insights` (type, severity, data JSONB, is_read)
   □ Déduplication : pas d'alerte doublon pour la même transaction
   □ Seuils adaptatifs : les seuils se calibrent sur l'historique utilisateur

   ALGORITHME ANOMALY DETECTION :
   ┌─────────────────────────────────────────────────────────┐
   │ Pour chaque nouvelle transaction T :                    │
   │   1. Calculer stats catégorie : μ, σ, Q3 sur 90 jours  │
   │   2. Z-score = |T.amount - μ| / σ                      │
   │   3. Si Z-score > 3.0 → UNUSUAL_AMOUNT (confidence=0.9)│
   │   4. Si Z-score > 2.0 → UNUSUAL_AMOUNT (confidence=0.6)│
   │   5. Chercher doublons : same merchant ± same amount    │
   │      dans les 48h → DUPLICATE_SUSPICION                 │
   │   6. Pattern recurring : 3+ transactions same merchant  │
   │      à intervalles réguliers (± 3 jours) → NEW_RECURRING│
   │   7. Fee patterns : "frais" in label AND amount < -1€   │
   │      AND fréquence < 1/mois → HIDDEN_FEE               │
   └─────────────────────────────────────────────────────────┘

3. Cash-Flow Forecaster (app/ai/forecaster.py) — Régression Pondérée
   □ Prédiction des 30 prochains jours de solde
   □ Algorithme : Weighted Moving Average + récurrences détectées
     → Composante tendancielle : régression linéaire pondérée (poids exponentiels
       décroissants, λ=0.95, fenêtre 90 jours)
     → Composante récurrente : injection des transactions récurrentes connues
       (salaire, loyer, abonnements) aux dates prévues
     → Composante saisonnière : débit moyen par jour de la semaine (lun-dim)
   □ Intervalle de confiance : ±1σ (68%) et ±2σ (95%)
   □ Alerte découvert : si le forecast croise 0€, alerte avec date estimée
   □ Retourne : [{date, predicted_balance, lower_bound, upper_bound}]

   ALGORITHME FORECAST :
   ┌─────────────────────────────────────────────────────────┐
   │ 1. Aggréger flux nets quotidiens sur 90 jours          │
   │ 2. Calculer trend : WLS (Weighted Least Squares)       │
   │    → poids = 0.95^(days_ago), bias vers les données    │
   │      récentes                                            │
   │ 3. Calculer saisonnalité hebdo : moyenne par dow       │
   │ 4. Identifier récurrences : montants fixes ± 5%,       │
   │    même intervalle ± 3 jours                             │
   │ 5. Pour chaque jour J+1..J+30 :                        │
   │    → predicted = last_balance + Σ(trend + seasonal +   │
   │      recurring) sur les jours écoulés                    │
   │    → bounds = ± sqrt(Σ daily_residual_variance)         │
   │ 6. Si predicted < 0 → flag alerte découvert            │
   └─────────────────────────────────────────────────────────┘

4. Insights Generator (app/ai/insights_generator.py) — Synthèse Intelligente
   □ Génère des "Financial Tips" personnalisés sans LLM :
     → Templates paramétrés avec 40+ phrases en français
     → Variables dynamiques : montants, %, catégories, dates
     → Ex: "Vos dépenses Restaurants ont augmenté de 45% ce mois.
            En revenant à votre moyenne, vous économiseriez 87€/mois."
   □ 5 types d'insights :
     → SPENDING_TREND : hausse/baisse significative d'une catégorie
     → SAVINGS_OPPORTUNITY : catégorie où la réduction est possible
     → ACHIEVEMENT : objectif atteint, patrimoine en hausse
     → WARNING : alerte découvert, budget dépassé
     → TIP : conseil contextuel (ex: "mois prochain = impôts")
   □ Prioritisation : severity × recency × actionability
   □ Maximum 5 insights actifs par utilisateur (éviter la surcharge)
   □ Régénération à chaque sync + vérification journalière (APScheduler)

5. Modèle de données (Migration 005_ai_intelligence)
   □ Table `budgets` :
     → id, user_id, category, month (YYYY-MM), amount_limit (centimes),
       amount_spent (centimes, mis à jour par trigger), level (enum),
       created_at, updated_at
   □ Table `ai_insights` :
     → id, user_id, type (enum), severity (enum: info/warning/critical),
       title, description, data (JSONB), is_read, is_dismissed,
       related_transaction_id (nullable FK), valid_until, created_at
   □ Index composites : (user_id, month) sur budgets,
     (user_id, is_read, created_at DESC) sur ai_insights

6. API Endpoints Phase 4A
   □ GET    /api/v1/budget/auto-generate?months=3&level=optimized
     → Génère et retourne les budgets auto-calculés
   □ GET    /api/v1/budget/current
     → Budgets du mois en cours avec progression (spent/limit)
   □ PUT    /api/v1/budget/{category}
     → Ajustement manuel d'un budget par l'utilisateur
   □ GET    /api/v1/budget/history?months=6
     → Historique mensuel budget vs réel par catégorie
   □ GET    /api/v1/insights/anomalies
     → Liste des anomalies détectées (filtrables par type/severity)
   □ GET    /api/v1/insights/forecast?days=30
     → Prévision de solde sur N jours + bounds + alerte découvert
   □ GET    /api/v1/insights/tips
     → Top 5 insights/recommandations personnalisés
   □ PATCH  /api/v1/insights/{id}/dismiss
     → Dismiss une insight (l'utilisateur l'a vue/ignorée)

━━━━━━━━━━━━━━━ FRONTEND — Page Insights Pixel-Perfect ━━━━━━━━━━━━━━━

8. Page Insights (/insights) — Hub d'Intelligence Financière
   □ Layout : Hero forecast chart + grille de cartes sous-jacentes
   □ Responsive : Desktop 3 colonnes / Tablet 2 / Mobile 1
   □ Skeleton loader dédié (même forme que le contenu final)

9. <ForecastChart /> — Prévision de trésorerie interactive
   □ Recharts AreaChart : passé (90j, trait plein) + futur (30j, trait pointillé)
   □ Bande de confiance : zone colorée semi-transparente (±1σ en bleu, ±2σ en gris)
   □ Ligne de danger rouge à y=0 (découvert)
   □ Tooltip enrichi : date + solde prévu + fourchette
   □ Toggle période : 7j / 14j / 30j de prévision
   □ Annotation automatique : points clés (salaire prévu, loyer prévu)
   □ Animation draw-in progressive (800ms passé, puis 600ms futur)
   □ Alerte visuelle si découvert prévu : badge rouge pulsant avec date

10. <AnomalyCard /> — Alertes d'anomalies
    □ Card avec bordure colorée selon severity (info=bleu, warning=orange, critical=rouge)
    □ Icône animée (shake pour critical, pulse pour warning)
    □ Titre + description contextuelle en français
    □ Montant en évidence (mis en surbrillance)
    □ Boutons actions : "Voir la transaction" / "Ignorer" / "Normal pour moi"
    □ Staggered fade-in au chargement
    □ Empty state : "Aucune anomalie détectée 🎉 — Vos finances sont saines"

11. <BudgetProgress /> — Suivi des budgets auto-générés
    □ Liste de catégories avec barre de progression circulaire
    □ Couleur dynamique : vert (<80%) → orange (80-100%) → rouge (>100%)
    □ Animation fill de 0% → valeur actuelle (800ms, spring)
    □ Montant dépensé / budget total + jours restants dans le mois
    □ Sparkline historique (6 derniers mois, même catégorie)
    □ Bouton "Ajuster" → inline edit du montant budget
    □ Toggle entre les 3 niveaux (Confortable/Optimisé/Agressif)
    □ Résumé en haut : "X€ économisés si vous maintenez le cap"

12. <InsightCard /> — Recommandations actionnables
    □ 5 types visuels distincts (icône + couleur par type d'insight)
    □ SPENDING_TREND : graphique mini inline (montant mois N vs N-1)
    □ SAVINGS_OPPORTUNITY : montant économisable mis en valeur
    □ ACHIEVEMENT : confetti animation au premier affichage
    □ WARNING : pulsating border rouge
    □ TIP : icône ampoule + texte conseil
    □ Action CTA par carte : "Voir détails" / "Créer un budget" / "Ignorer"
    □ Dismiss avec animation scale-down + fade-out

13. Zustand Store — insights-store.ts
    □ State : forecast, anomalies, tips, budgets, loading states
    □ Actions : fetchForecast(), fetchAnomalies(), fetchTips(),
      fetchBudgets(), dismissInsight(), updateBudget()
    □ Optimistic updates sur dismiss (UI instantanée, sync background)

14. Types TypeScript — types/insights.ts
    □ ForecastPoint { date, predicted, lower_68, upper_68, lower_95, upper_95 }
    □ Anomaly { id, type, severity, title, description, amount, transaction_id,
      confidence, created_at, is_read }
    □ Insight { id, type, severity, title, description, data, is_dismissed }
    □ Budget { category, month, limit, spent, level, progress_pct }
    □ BudgetSummary { total_limit, total_spent, savings_potential, categories }

━━━━━━━━━━━━━━━ INTÉGRATION DASHBOARD ━━━━━━━━━━━━━━━

15. Dashboard Widgets (ajouts Phase 4A)
    □ Mini forecast sparkline dans le NetWorthHero (7 jours, trait pointillé)
    □ Badge alerte dans la sidebar : compteur d'anomalies non lues
    □ Widget "Budget du mois" : 3 top catégories + barre de progression
    □ Widget "Conseil du jour" : 1 insight prioritaire rotatif

LIVRABLE Phase 4A : ✅ IMPLÉMENTÉ
  → Auto-Budget en 3 niveaux, généré automatiquement depuis l'historique
  → Anomalies détectées en temps réel (4 types, scoring de confiance)
  → Prévision de trésorerie 30j avec intervalles de confiance
  → Insights personnalisés (5 types, templates FR, priorisés)
  → Page Insights avec graphique forecast Recharts interactif
  → Budget tracking avec progression en temps réel
  → Zéro dépendance externe (100% local, offline-capable)
  → Zustand store + types TypeScript complets
  → Navigation sidebar + bottom-nav "Intelligence"
  → Migration 005_ai_intelligence (tables budgets + ai_insights)
  → 8 endpoints API fonctionnels (testés OK)
  → TEST : Sync → voir anomalies détectées → consulter forecast →
           vérifier budgets auto-générés → dismisser un insight
```

---

#### Phase 4B — LLM Financial Advisor & ML Categorizer (Semaine 12)

```
OBJECTIF : Ajouter l'intelligence "conversationnelle" via LLM (optionnel,
           nécessite une clé API OpenAI/Anthropic) et un catégoriseur ML
           qui apprend des corrections utilisateur. Phase premium.

━━━━━━━━━━━━━━━ BACKEND — LLM & ML ━━━━━━━━━━━━━━━

1. Financial Advisor Chat (app/ai/advisor.py — LangChain + OpenAI)
   □ Chat contextuel : l'utilisateur pose des questions sur ses finances
   □ Context window : dernières transactions, budgets, patrimoine, forecast
   □ Prompts structurés avec garde-fous (pas de conseil d'investissement réglementé)
   □ Templates de questions suggérées :
     → "Comment réduire mes dépenses ?"
     → "Suis-je prêt pour acheter un appartement ?"
     → "Combien puis-je investir ce mois-ci ?"
   □ "Et si ?" simulator : projection patrimoine avec scénarios
     → "Et si j'investis 200€/mois pendant 10 ans à 7%/an ?"
     → Formule intérêts composés + inflation + graphique projection
   □ Streaming response (SSE) pour une UX fluide
   □ Rate limiting : 20 questions/jour/user (anti-spam, maîtrise coûts)
   □ Fallback local : si pas de clé API, conseils pré-générés (Phase 4A tips)

2. ML Categorizer v2 (app/ai/ml_categorizer.py — SentenceTransformer)
   □ Modèle : all-MiniLM-L6-v2 (22M params, ~50MB, ultra-rapide)
   □ Embedding des raw_labels → cosine similarity vs centroïdes catégories
   □ Fine-tuning sur les corrections utilisateur (feedback loop)
   □ Endpoint : POST /api/v1/transactions/{id}/recategorize
   □ Batch recatégorisation des "Autres" existants

3. Investment Simulator (app/ai/simulator.py)
   □ Intérêts composés avec contribution mensuelle
   □ Monte-Carlo simulation (1000 paths, distribution log-normale)
   □ Scénarios prédéfinis : conservateur (3%), modéré (7%), agressif (12%)
   □ Impact inflation configurable (2% par défaut)
   □ Projection graphique interactive avec bandes de confiance

━━━━━━━━━━━━━━━ FRONTEND — Chat & Simulator ━━━━━━━━━━━━━━━

4. <AdvisorChat /> — Assistant financier IA
   □ Widget de chat flottant (bottom-right, expand/collapse)
   □ Streaming messages (typing indicator + token-by-token reveal)
   □ Markdown rendering dans les réponses
   □ Questions suggérées (chips cliquables)
   □ Historique de conversation (session-based, pas persisté)

5. <InvestmentSimulator /> — "Et si ?" interactif
   □ Sliders : montant initial, contribution mensuelle, durée, rendement
   □ Recharts AreaChart avec bandes Monte-Carlo (P10-P90)
   □ Résumé : capital final estimé, gains vs contributions
   □ Comparaison 3 scénarios côte à côte

6. ML Recategorization UI
   □ Dropdown de catégorie sur chaque transaction
   □ "Appliquer à toutes les transactions similaires" (bulk recategorize)
   □ Badge "IA" sur les catégories auto-détectées par ML

LIVRABLE Phase 4B :
  → Chat financier IA (LLM, optionnel, streaming)
  → ML categorizer auto-apprenant
  → Simulateur d'investissement interactif Monte-Carlo
  → Dépendances optionnelles (openai, sentence-transformers)
  → TEST : Poser une question au chat → recatégoriser une transaction →
           simuler un plan d'investissement sur 10 ans

✅ PHASE 4B IMPLÉMENTÉE — Détail des fichiers créés/modifiés :

  Backend :
    ✅ app/core/config.py — Ajout OPENAI_API_KEY, OPENAI_MODEL, AI_DAILY_LIMIT
    ✅ pyproject.toml — Ajout openai>=1.0.0, numpy>=1.26.0, sse-starlette>=2.0.0
    ✅ .env — Ajout OPENAI_API_KEY, OPENAI_MODEL, AI_DAILY_LIMIT
    ✅ app/ai/context_aggregator.py — Agrège TOUTES les données financières utilisateur
       (comptes, transactions, budgets, crypto, stocks, immobilier, anomalies, patrimoine)
       en un contexte structuré pour le LLM
    ✅ app/ai/advisor.py — Service Nova LLM : streaming SSE OpenAI, rate limiting Redis
       (20/jour/user), fallback intelligent quand pas d'API key, système de prompts
       personnalisé avec contexte financier complet
    ✅ app/ai/simulator.py — Simulateur d'investissement : intérêts composés mensuels,
       Monte-Carlo (1000 chemins, distribution log-normale), 3 scénarios (prudent 3%,
       équilibré 7%, dynamique 12%), ajustement inflation 2%
    ✅ app/models/chat.py — ChatConversation + ChatMessage (rôles user/assistant/system)
    ✅ app/models/__init__.py — Enregistrement ChatConversation, ChatMessage
    ✅ alembic/versions/006_ai_advisor.py — Migration tables chat
    ✅ app/api/v1/advisor.py — 6 endpoints :
       POST /advisor/chat (SSE streaming), GET /advisor/conversations,
       GET /advisor/conversations/{id}, DELETE /advisor/conversations/{id},
       POST /advisor/simulate, GET /advisor/suggestions, GET /advisor/status
    ✅ app/api/v1/router.py — Ajout advisor_router

  Frontend :
    ✅ types/api.ts — Types Phase 4B (ChatMessage, Conversation, Simulation, etc.)
    ✅ stores/advisor-store.ts — Zustand store : chat SSE streaming, conversations,
       simulation, UI state
    ✅ components/ai/nova-chat.tsx — Widget flottant Nova :
       Orbe animée (conic-gradient rotating), particules, glassmorphism,
       SSE streaming avec rendu markdown, suggestions, historique conversations,
       animations Framer Motion, responsive (full-screen mobile, floating desktop)
    ✅ components/ai/investment-simulator.tsx — Simulateur Monte-Carlo :
       Sliders réactifs, sélecteur de scénarios, graphique AreaChart Recharts
       (bandes percentiles p10-p90), comparaison 3 scénarios, statistiques probabilistes
    ✅ app/(dashboard)/nova/page.tsx — Page Nova avec hero, quick actions, simulateur
    ✅ app/(dashboard)/layout.tsx — Intégration NovaChatWidget global
    ✅ components/layout/sidebar.tsx — Ajout "Nova IA" (icône Sparkles)

  Tests API (tous ✅) :
    GET /advisor/status → 200 {name:"Nova", available:false, rate_limit:{remaining:20}}
    GET /advisor/suggestions → 200 (8 suggestions)
    POST /advisor/simulate → 200 (Monte-Carlo 1000 chemins, 3 scénarios)
    POST /advisor/chat → 200 SSE stream (fallback mode sans API key)
    GET /advisor/conversations → 200 (liste conversations)
    GET /advisor/conversations/{id} → 200 (messages complets)
```

### Phase 5 — PWA, SEO & Optimisation (Semaines 13-15)

```
OBJECTIF : App installable, rapide, offline-capable, SEO-ready.

PWA :
  □ Service Worker (next-pwa ou custom)
      □ App shell caching
      □ Data caching (stale-while-revalidate)
      □ Offline mode
      □ Background sync
  □ Web App Manifest
  □ Install prompt custom
  □ Push notifications (optionnel)
      □ Alertes de solde
      □ Rapport hebdomadaire
      □ Alerte de frais

Performance :
  □ Bundle analysis et tree shaking
  □ Lazy loading des graphiques (dynamic import)
  □ Image optimization (next/image, WebP/AVIF)
  □ Font optimization (Inter variable, preload)
  □ Critical CSS inlining
  □ Streaming SSR avec Suspense
  □ Core Web Vitals audit (Lighthouse > 95)

SEO technique :
  □ Metadata dynamiques (next/head → generateMetadata)
  □ OpenGraph + Twitter cards
  □ Structured data (JSON-LD)
  □ Sitemap dynamique
  □ robots.txt
  □ Landing page optimisée (pré-auth)

Sécurité production :
  □ CSP headers stricts
  □ CORS configuration
  □ Rate limiting par IP et par user
  □ Audit de sécurité (OWASP top 10)
  □ Penetration testing basique

Documentation :
  □ API docs (auto-generées par FastAPI)
  □ README complet
  □ Contributing guide
  □ Architecture Decision Records (ADR)

LIVRABLE : App installable en PWA, offline-capable, Lighthouse > 95,
           prête pour une beta publique.
```

---

## 14. Structure du Monorepo

```
omniflow/
│
├── 📄 README.md                     # Documentation principale
├── 📄 LICENSE                       # MIT License
├── 📄 context.md                    # CE FICHIER — Source de vérité
├── 📄 .gitignore
├── 📄 .env.example                  # Template variables d'env
├── 📄 docker-compose.yml            # Orchestration locale
├── 📄 docker-compose.prod.yml       # Orchestration production
├── 📄 Makefile                      # Commandes raccourcies
│
├── 📁 apps/
│   │
│   ├── 📁 web/                      # ═══ FRONTEND (Next.js 14) ═══
│   │   ├── 📄 next.config.mjs
│   │   ├── 📄 tailwind.config.ts
│   │   ├── 📄 tsconfig.json
│   │   ├── 📄 package.json
│   │   │
│   │   ├── 📁 public/
│   │   │   ├── 📁 icons/            # PWA icons
│   │   │   ├── 📁 images/           # Assets statiques
│   │   │   ├── 📄 manifest.json     # PWA manifest
│   │   │   └── 📄 sw.js             # Service Worker
│   │   │
│   │   └── 📁 src/
│   │       ├── 📁 app/              # ═══ APP ROUTER ═══
│   │       │   ├── 📄 layout.tsx    # Root layout (providers, fonts)
│   │       │   ├── 📄 page.tsx      # Landing page
│   │       │   ├── 📄 globals.css   # Tailwind + custom CSS
│   │       │   │
│   │       │   ├── 📁 (auth)/       # Groupe de routes auth
│   │       │   │   ├── 📁 login/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   ├── 📁 register/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   └── 📁 onboarding/
│   │       │   │       └── 📄 page.tsx
│   │       │   │
│   │       │   ├── 📁 (dashboard)/  # Groupe de routes dashboard
│   │       │   │   ├── 📄 layout.tsx # Dashboard layout (sidebar)
│   │       │   │   ├── 📄 page.tsx   # Vue d'ensemble patrimoine
│   │       │   │   ├── 📁 banks/
│   │       │   │   │   ├── 📄 page.tsx
│   │       │   │   │   └── 📁 [accountId]/
│   │       │   │   │       └── 📄 page.tsx
│   │       │   │   ├── 📁 crypto/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   ├── 📁 stocks/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   ├── 📁 realestate/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   ├── 📁 debts/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   ├── 📁 budget/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   ├── 📁 insights/
│   │       │   │   │   └── 📄 page.tsx
│   │       │   │   └── 📁 settings/
│   │       │   │       ├── 📄 page.tsx
│   │       │   │       ├── 📁 connections/
│   │       │   │       │   └── 📄 page.tsx
│   │       │   │       └── 📁 security/
│   │       │   │           └── 📄 page.tsx
│   │       │   │
│   │       │   └── 📁 api/          # API Route Handlers (BFF)
│   │       │       └── 📁 proxy/    # Proxy vers FastAPI
│   │       │           └── 📁 [...path]/
│   │       │               └── 📄 route.ts
│   │       │
│   │       ├── 📁 components/       # ═══ COMPOSANTS UI ═══
│   │       │   ├── 📁 ui/           # Composants atomiques (shadcn-like)
│   │       │   │   ├── 📄 button.tsx
│   │       │   │   ├── 📄 input.tsx
│   │       │   │   ├── 📄 badge.tsx
│   │       │   │   ├── 📄 card.tsx
│   │       │   │   ├── 📄 dialog.tsx
│   │       │   │   ├── 📄 dropdown.tsx
│   │       │   │   ├── 📄 skeleton.tsx
│   │       │   │   ├── 📄 toast.tsx
│   │       │   │   ├── 📄 tooltip.tsx
│   │       │   │   └── 📄 toggle.tsx
│   │       │   │
│   │       │   ├── 📁 finance/      # Composants métier finance
│   │       │   │   ├── 📄 account-card.tsx
│   │       │   │   ├── 📄 transaction-row.tsx
│   │       │   │   ├── 📄 currency-display.tsx
│   │       │   │   ├── 📄 net-worth-hero.tsx
│   │       │   │   ├── 📄 budget-progress.tsx
│   │       │   │   ├── 📄 omni-score.tsx
│   │       │   │   └── 📄 category-badge.tsx
│   │       │   │
│   │       │   ├── 📁 charts/       # Composants graphiques
│   │       │   │   ├── 📄 patrimony-chart.tsx
│   │       │   │   ├── 📄 cash-flow-chart.tsx
│   │       │   │   ├── 📄 allocation-donut.tsx
│   │       │   │   ├── 📄 expense-bars.tsx
│   │       │   │   └── 📄 sparkline.tsx
│   │       │   │
│   │       │   ├── 📁 layout/       # Composants de layout
│   │       │   │   ├── 📄 sidebar.tsx
│   │       │   │   ├── 📄 bottom-nav.tsx
│   │       │   │   ├── 📄 header.tsx
│   │       │   │   └── 📄 page-container.tsx
│   │       │   │
│   │       │   ├── 📁 flows/        # Flows multi-étapes
│   │       │   │   ├── 📄 add-bank-flow.tsx
│   │       │   │   ├── 📄 add-crypto-flow.tsx
│   │       │   │   └── 📄 onboarding-flow.tsx
│   │       │   │
│   │       │   └── 📁 skeletons/    # Skeleton loaders
│   │       │       ├── 📄 dashboard-skeleton.tsx
│   │       │       ├── 📄 account-card-skeleton.tsx
│   │       │       ├── 📄 transaction-skeleton.tsx
│   │       │       └── 📄 chart-skeleton.tsx
│   │       │
│   │       ├── 📁 lib/              # ═══ UTILITAIRES ═══
│   │       │   ├── 📄 api-client.ts  # Client HTTP (fetch wrapper)
│   │       │   ├── 📄 crypto.ts      # AES-256 côté client
│   │       │   ├── 📄 format.ts      # Formatage monétaire, dates
│   │       │   ├── 📄 utils.ts       # cn() et helpers
│   │       │   └── 📄 constants.ts   # Constantes globales
│   │       │
│   │       ├── 📁 hooks/            # ═══ CUSTOM HOOKS ═══
│   │       │   ├── 📄 use-accounts.ts
│   │       │   ├── 📄 use-transactions.ts
│   │       │   ├── 📄 use-net-worth.ts
│   │       │   ├── 📄 use-websocket.ts
│   │       │   └── 📄 use-media-query.ts
│   │       │
│   │       ├── 📁 stores/           # ═══ ZUSTAND STORES ═══
│   │       │   ├── 📄 auth-store.ts
│   │       │   ├── 📄 accounts-store.ts
│   │       │   ├── 📄 ui-store.ts
│   │       │   └── 📄 sync-store.ts
│   │       │
│   │       ├── 📁 types/            # ═══ TYPES TYPESCRIPT ═══
│   │       │   ├── 📄 accounts.ts
│   │       │   ├── 📄 transactions.ts
│   │       │   ├── 📄 networth.ts
│   │       │   ├── 📄 budget.ts
│   │       │   ├── 📄 insights.ts
│   │       │   └── 📄 api.ts
│   │       │
│   │       └── 📁 providers/        # ═══ CONTEXT PROVIDERS ═══
│   │           ├── 📄 query-provider.tsx   # TanStack Query
│   │           ├── 📄 theme-provider.tsx   # next-themes
│   │           └── 📄 auth-provider.tsx    # Auth context
│   │
│   └── 📁 api/                      # ═══ BACKEND (FastAPI) ═══
│       ├── 📄 pyproject.toml        # Dependencies (Poetry/uv)
│       ├── 📄 Dockerfile
│       ├── 📄 alembic.ini
│       │
│       ├── 📁 alembic/
│       │   ├── 📄 env.py
│       │   └── 📁 versions/         # Migration files
│       │
│       └── 📁 app/
│           ├── 📄 main.py           # FastAPI app entry point
│           ├── 📄 __init__.py
│           │
│           ├── 📁 api/
│           │   ├── 📄 __init__.py
│           │   ├── 📄 deps.py       # Dépendances injectées (DB, auth)
│           │   └── 📁 v1/
│           │       ├── 📄 __init__.py
│           │       ├── 📄 router.py  # Router principal v1
│           │       ├── 📄 auth.py
│           │       ├── 📄 accounts.py
│           │       ├── 📄 transactions.py
│           │       ├── 📄 networth.py
│           │       ├── 📄 crypto.py
│           │       ├── 📄 stocks.py
│           │       ├── 📄 realestate.py
│           │       ├── 📄 debts.py
│           │       ├── 📄 budget.py
│           │       ├── 📄 insights.py
│           │       ├── 📄 connections.py
│           │       └── 📄 settings.py
│           │
│           ├── 📁 core/
│           │   ├── 📄 __init__.py
│           │   ├── 📄 config.py      # Pydantic Settings
│           │   ├── 📄 security.py    # AES-256, JWT, hashing
│           │   ├── 📄 database.py    # SQLAlchemy async engine
│           │   └── 📄 redis.py       # Redis connection
│           │
│           ├── 📁 models/            # SQLAlchemy ORM models
│           │   ├── 📄 __init__.py
│           │   ├── 📄 base.py        # Base model
│           │   ├── 📄 user.py
│           │   ├── 📄 connection.py
│           │   ├── 📄 account.py
│           │   ├── 📄 transaction.py
│           │   ├── 📄 crypto.py
│           │   ├── 📄 stock.py
│           │   ├── 📄 realestate.py
│           │   ├── 📄 debt.py
│           │   ├── 📄 budget.py
│           │   └── 📄 audit.py
│           │
│           ├── 📁 schemas/           # Pydantic schemas
│           │   ├── 📄 __init__.py
│           │   ├── 📄 auth.py
│           │   ├── 📄 account.py
│           │   ├── 📄 transaction.py
│           │   ├── 📄 networth.py
│           │   ├── 📄 crypto.py
│           │   ├── 📄 stock.py
│           │   ├── 📄 budget.py
│           │   └── 📄 insight.py
│           │
│           ├── 📁 services/          # Business logic
│           │   ├── 📄 __init__.py
│           │   ├── 📄 auth_service.py
│           │   ├── 📄 account_service.py
│           │   ├── 📄 networth_service.py
│           │   ├── 📄 currency_service.py
│           │   ├── 📄 budget_service.py
│           │   └── 📄 sync_service.py
│           │
│           ├── 📁 woob_engine/       # Woob integration
│           │   ├── 📄 __init__.py
│           │   ├── 📄 manager.py     # Worker pool manager
│           │   ├── 📄 worker.py      # Individual worker
│           │   ├── 📄 normalizer.py  # Data normalization
│           │   ├── 📄 scheduler.py   # Celery beat schedules
│           │   ├── 📄 sca_handler.py # SCA/2FA bridge
│           │   └── 📁 modules/       # Bank-specific overrides
│           │       ├── 📄 __init__.py
│           │       └── 📄 french_banks.py
│           │
│           ├── 📁 ai/               # AI/ML models
│           │   ├── 📄 __init__.py
│           │   ├── 📄 categorizer.py
│           │   ├── 📄 forecaster.py
│           │   ├── 📄 anomaly.py
│           │   ├── 📄 advisor.py
│           │   └── 📁 models/       # Trained model files
│           │       └── 📄 .gitkeep
│           │
│           └── 📁 tasks/            # Celery tasks
│               ├── 📄 __init__.py
│               ├── 📄 celery_app.py
│               ├── 📄 sync_tasks.py
│               └── 📄 ai_tasks.py
│
├── 📁 packages/                     # ═══ PACKAGES PARTAGÉS ═══
│   └── 📁 shared/
│       ├── 📄 package.json
│       └── 📁 src/
│           ├── 📄 categories.ts     # Mapping catégories (shared FE/BE)
│           ├── 📄 currencies.ts     # Devises supportées
│           └── 📄 constants.ts      # Constantes partagées
│
├── 📁 infra/                        # ═══ INFRASTRUCTURE ═══
│   ├── 📁 docker/
│   │   ├── 📄 Dockerfile.web       # Multi-stage Next.js
│   │   ├── 📄 Dockerfile.api       # Python + Woob
│   │   └── 📄 nginx.conf           # Reverse proxy config
│   │
│   └── 📁 scripts/
│       ├── 📄 setup.sh             # Script d'installation initiale
│       ├── 📄 seed.py              # Seed data pour dev
│       └── 📄 backup.sh            # Script de backup DB
│
└── 📁 docs/                         # ═══ DOCUMENTATION ═══
    ├── 📄 architecture.md           # Détails architecture
    ├── 📄 api-reference.md          # Référence API (auto-gen link)
    ├── 📄 contributing.md           # Guide de contribution
    ├── 📄 security.md              # Politique de sécurité
    └── 📁 adr/                      # Architecture Decision Records
        ├── 📄 001-monorepo.md
        ├── 📄 002-woob-vs-budget-insight.md
        └── 📄 003-fastapi-vs-nestjs.md
```

---

## 15. Conventions & Standards

### 15.1 Git

```
BRANCHES
────────
main          → Production (protégée)
develop       → Développement (base des PRs)
feature/*     → Nouvelles fonctionnalités
fix/*         → Corrections de bugs
refactor/*    → Refactoring
docs/*        → Documentation

COMMITS (Conventional Commits)
────────
feat(scope): description      → Nouvelle fonctionnalité
fix(scope): description       → Bug fix
refactor(scope): description  → Refactoring sans changement de comportement
docs(scope): description      → Documentation
style(scope): description     → Formatting, missing semicolons…
test(scope): description      → Ajout/modification de tests
chore(scope): description     → Maintenance (deps, config…)
perf(scope): description      → Amélioration de performance

Scopes : web, api, woob, ai, infra, shared

Exemples :
  feat(woob): add Boursorama SCA handler
  fix(web): fix Net Worth animation flicker on mobile
  refactor(api): extract currency conversion to service
```

### 15.2 Code Style

```
FRONTEND (TypeScript / React)
────────
- ESLint : @typescript-eslint + next/core-web-vitals
- Prettier : semi: false, singleQuote: true, printWidth: 100
- Naming : 
    Components : PascalCase (AccountCard.tsx)
    Hooks      : camelCase, préfixe use- (useAccounts.ts)
    Utils      : camelCase (formatCurrency.ts)
    Types      : PascalCase, suffixe si besoin (AccountResponse)
    Constants  : UPPER_SNAKE_CASE
- Exports : Named exports uniquement (pas de default export)
- Composants : Function components + arrow functions
- Props : Interface dédiée, suffixe Props (AccountCardProps)

BACKEND (Python)
────────
- Ruff : Linter + formatter (remplace Black + isort + flake8)
- Naming :
    Modules  : snake_case
    Classes  : PascalCase
    Functions: snake_case
    Constants: UPPER_SNAKE_CASE
- Type hints : Obligatoires sur toutes les fonctions publiques
- Docstrings : Google style
- Tests : pytest + pytest-asyncio
```

### 15.3 Tests

```
FRONTEND
────────
- Unit tests : Vitest (composants, hooks, utils)
- Integration : Testing Library (React)
- E2E : Playwright (critical paths)
- Coverage cible : > 70% (services), > 50% (composants)

BACKEND
────────
- Unit tests : pytest (services, utils, normalizer)
- Integration : pytest + httpx (API endpoints)
- Woob tests : Mock des backends bancaires
- Coverage cible : > 80% (services), > 60% (API)
```

---

## 16. API Contract (Backend ↔ Frontend)

### 16.1 Authentication

```
POST   /api/v1/auth/register
  Request  : { email, password, name }
  Response : { user, access_token, refresh_token }

POST   /api/v1/auth/login
  Request  : { email, password }
  Response : { user, access_token, refresh_token }

POST   /api/v1/auth/refresh
  Request  : { refresh_token }
  Response : { access_token, refresh_token }

POST   /api/v1/auth/logout
  Headers  : Authorization: Bearer <token>
  Response : { success: true }
```

### 16.2 Connections (Woob)

```
GET    /api/v1/connections
  → Liste des connexions bancaires de l'utilisateur

POST   /api/v1/connections
  Request  : { bank_module, encrypted_credentials }
  Response : { connection_id, status: "connecting" }
  WebSocket: ws://…/ws/sync/{connection_id}
    Events : { type: "sca_required", challenge: "…" }
             { type: "progress", step: "accounts", progress: 60 }
             { type: "completed", accounts_count: 3 }
             { type: "error", message: "…" }

POST   /api/v1/connections/{id}/sca
  Request  : { response: "123456" }
  Response : { success: true }

DELETE /api/v1/connections/{id}
  → Supprime la connexion et les données associées

POST   /api/v1/connections/{id}/sync
  → Force une resynchronisation
```

### 16.3 Accounts

```
GET    /api/v1/accounts
  Query  : ?type=checking,savings&currency=EUR
  Response : {
    accounts: [
      {
        id: "uuid",
        source: "woob:boursorama",
        type: "checking",
        label: "Compte Courant",
        balance: 154320,       // centimes
        currency: "EUR",
        bank_name: "Boursorama",
        bank_logo: "/logos/boursorama.svg",
        variation_1d: 2500,    // centimes
        variation_1d_pct: 1.65,
        last_sync: "2026-03-01T10:30:00Z"
      }
    ],
    total_balance_eur: 5842100
  }

GET    /api/v1/accounts/{id}
  → Détail d'un compte

GET    /api/v1/accounts/{id}/transactions
  Query  : ?page=1&limit=50&category=alimentation&from=2026-01-01&to=2026-03-01
  Response : {
    transactions: [...],
    pagination: { page: 1, limit: 50, total: 342 }
  }
```

### 16.4 Net Worth

```
GET    /api/v1/networth
  Response : {
    total: 18542300,          // centimes EUR
    assets: 21042300,
    liabilities: 2500000,
    breakdown: {
      bank: 5842100,
      crypto: 3200000,
      stocks: 8000000,
      real_estate: 4000200,
      debts: -2500000
    },
    variations: {
      "1d": { amount: 12500, pct: 0.07 },
      "1w": { amount: -35000, pct: -0.19 },
      "1m": { amount: 285000, pct: 1.56 },
      "1y": { amount: 2150000, pct: 13.1 }
    },
    computed_at: "2026-03-01T10:30:00Z"
  }

GET    /api/v1/networth/history
  Query  : ?period=1y&interval=daily
  Response : {
    data_points: [
      { date: "2025-03-01", total: 16392300 },
      { date: "2025-03-02", total: 16405000 },
      ...
    ]
  }
```

### 16.5 Insights (IA)

```
GET    /api/v1/insights/forecast
  Query  : ?days=30
  Response : {
    predictions: [
      { date: "2026-03-02", amount: 154000, lower_80: 148000, upper_80: 160000 },
      ...
    ],
    overdraft_risk: false,
    next_big_expense: { label: "Loyer", amount: -85000, date: "2026-03-05" }
  }

GET    /api/v1/insights/alerts
  Response : {
    alerts: [
      {
        type: "hidden_fee",
        severity: "warning",
        title: "Frais de tenue de compte détectés",
        description: "4.50€ prélevés par Société Générale le 01/03",
        action: { label: "Voir le détail", url: "/dashboard/banks?tx=uuid" }
      },
      {
        type: "anomaly",
        severity: "info",
        title: "Dépense inhabituelle",
        description: "450€ chez Amazon — 3x votre moyenne mensuelle",
        action: { label: "Catégoriser", url: "/dashboard/banks?tx=uuid" }
      }
    ]
  }

GET    /api/v1/insights/score
  Response : {
    score: 72,
    breakdown: {
      emergency_fund: { score: 18, max: 25, detail: "3200€ / 4500€ recommandés" },
      debt_ratio: { score: 20, max: 20, detail: "22% (< 33% recommandé)" },
      diversification: { score: 14, max: 20, detail: "3 classes d'actifs sur 5" },
      savings_regularity: { score: 10, max: 15, detail: "Épargne régulière 8/12 mois" },
      growth: { score: 6, max: 10, detail: "+8.5% sur 6 mois" },
      fees: { score: 4, max: 10, detail: "247€/an (médiane: 150€)" }
    },
    recommendations: [
      "Augmentez votre épargne de précaution de 1300€ pour atteindre 3 mois de charges.",
      "Diversifiez vers l'immobilier ou les obligations pour équilibrer votre portefeuille."
    ]
  }
```

### 16.6 Budget

```
GET    /api/v1/budget
  Query  : ?month=2026-03
  Response : {
    month: "2026-03",
    total_income: 320000,
    total_expenses: 215000,
    total_savings: 105000,
    categories: [
      {
        name: "alimentation",
        budget: 40000,
        spent: 28500,
        remaining: 11500,
        pct: 71.25,
        trend: "stable"      // up, down, stable
      },
      ...
    ],
    auto_adjusted: true,
    adjustment_reason: "Budget ajusté suite à une augmentation de revenus détectée"
  }
```

---

## 17. Modèle de données

### 17.1 Schéma PostgreSQL (simplifié)

```sql
-- Utilisateurs
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    master_key_salt BYTEA NOT NULL,          -- Salt pour dériver la master key
    totp_secret BYTEA,                        -- 2FA (chiffré)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connexions bancaires (Woob)
CREATE TABLE bank_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    bank_module VARCHAR(50) NOT NULL,         -- "boursorama", "societegenerale"
    bank_name VARCHAR(100) NOT NULL,
    encrypted_credentials BYTEA NOT NULL,     -- AES-256-GCM blob
    status VARCHAR(20) DEFAULT 'active',      -- active, error, sca_required, disabled
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comptes agrégés (tous types)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
    external_id VARCHAR(255),                 -- ID côté source
    type VARCHAR(20) NOT NULL,                -- checking, savings, investment, loan, crypto
    label VARCHAR(255) NOT NULL,
    balance BIGINT NOT NULL,                  -- EN CENTIMES
    currency VARCHAR(10) DEFAULT 'EUR',
    bank_name VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(connection_id, external_id)
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    date DATE NOT NULL,
    amount BIGINT NOT NULL,                   -- EN CENTIMES (négatif = débit)
    label VARCHAR(500) NOT NULL,
    raw_label VARCHAR(500),
    category VARCHAR(50),
    subcategory VARCHAR(50),
    type VARCHAR(30),                         -- card, transfer, direct_debit, etc.
    merchant VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(account_id, external_id)
);

-- Historique des soldes (time-series)
CREATE TABLE balance_history (
    id BIGSERIAL PRIMARY KEY,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    balance BIGINT NOT NULL,                  -- EN CENTIMES
    
    UNIQUE(account_id, date)
);

-- Wallets Crypto
CREATE TABLE crypto_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,              -- binance, kraken, metamask, manual
    address VARCHAR(255),                     -- Adresse on-chain (optionnel)
    encrypted_api_key BYTEA,                  -- API key chiffrée (exchanges)
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Positions Crypto
CREATE TABLE crypto_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES crypto_wallets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_id VARCHAR(50) NOT NULL,            -- coingecko id (bitcoin, ethereum…)
    symbol VARCHAR(20) NOT NULL,              -- BTC, ETH…
    amount NUMERIC(30, 18) NOT NULL,          -- Quantité (precision crypto)
    avg_buy_price BIGINT,                     -- Prix moyen d'achat (centimes EUR)
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portefeuilles Bourse
CREATE TABLE stock_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,              -- degiro, boursorama, manual
    ticker VARCHAR(20) NOT NULL,              -- AAPL, MSFT, CW8.PA…
    isin VARCHAR(12),
    name VARCHAR(255) NOT NULL,
    quantity NUMERIC(20, 6) NOT NULL,
    avg_buy_price BIGINT,                     -- centimes
    currency VARCHAR(10) DEFAULT 'EUR',
    account_type VARCHAR(20),                 -- pea, cto, assurance_vie
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Biens Immobiliers
CREATE TABLE real_estate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,              -- "Appartement Paris 11e"
    type VARCHAR(30) NOT NULL,                -- apartment, house, parking, other
    address TEXT,
    purchase_price BIGINT,                    -- centimes
    purchase_date DATE,
    estimated_value BIGINT,                   -- centimes (estimation courante)
    surface_m2 NUMERIC(10, 2),
    is_rental BOOLEAN DEFAULT FALSE,
    monthly_rent BIGINT,                      -- centimes (si locatif)
    monthly_charges BIGINT,                   -- centimes
    remaining_mortgage BIGINT,                -- centimes
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dettes & Crédits
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    type VARCHAR(30) NOT NULL,                -- mortgage, consumer, student, other
    creditor VARCHAR(255),
    initial_amount BIGINT NOT NULL,           -- centimes
    remaining_amount BIGINT NOT NULL,         -- centimes
    interest_rate NUMERIC(5, 3),              -- en % (ex: 2.500)
    monthly_payment BIGINT,                   -- centimes
    start_date DATE,
    end_date DATE,
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,                -- "2026-03"
    category VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,                   -- centimes (budget alloué)
    is_auto BOOLEAN DEFAULT TRUE,             -- Auto-généré par l'IA
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, month, category)
);

-- Prédictions IA (cache)
CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,                -- forecast, anomaly, score
    data JSONB NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal d'audit
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(30),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEX OPTIMISÉS
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category);
CREATE INDEX idx_balance_history_account_date ON balance_history(account_id, date DESC);
CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
```

---

## 18. Déploiement & Infrastructure

### 18.1 Environnements

```
LOCAL (Docker Compose)
────────────────────
- Next.js : hot reload (port 3000)
- FastAPI : hot reload (port 8000)
- PostgreSQL : port 5432
- Redis : port 6379
- Celery Worker : 1 worker, 2 concurrency
- Celery Beat : 1 scheduler

STAGING
────────
- VPS ou Railway/Render
- PostgreSQL managé (Supabase / Neon)
- Redis managé (Upstash / Railway)
- GitHub Actions : deploy on push to develop

PRODUCTION (self-hosted ou cloud)
────────
Option A — Self-hosted (VPS) :
  - Docker Compose sur un VPS (Hetzner, OVH)
  - Nginx reverse proxy + Let's Encrypt SSL
  - Backup PostgreSQL quotidien (S3/MinIO)

Option B — Cloud :
  - Frontend : Vercel (gratis pour les projets perso)
  - Backend : Railway / Fly.io
  - DB : Neon (PostgreSQL serverless)
  - Redis : Upstash (serverless)
```

### 18.2 Docker Compose (développement)

```yaml
# docker-compose.yml (structure)
version: '3.9'

services:
  web:
    build: ./apps/web
    ports: ['3000:3000']
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on: [api]

  api:
    build: ./apps/api
    ports: ['8000:8000']
    environment:
      - DATABASE_URL=postgresql+asyncpg://omniflow:password@db:5432/omniflow
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
    depends_on: [db, redis]

  worker:
    build: ./apps/api
    command: celery -A app.tasks.celery_app worker -l info -c 2
    depends_on: [api, redis]

  beat:
    build: ./apps/api
    command: celery -A app.tasks.celery_app beat -l info
    depends_on: [worker]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: omniflow
      POSTGRES_USER: omniflow
      POSTGRES_PASSWORD: password
    volumes: ['pgdata:/var/lib/postgresql/data']
    ports: ['5432:5432']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

volumes:
  pgdata:
```

---

## 19. KPIs & Métriques de succès

### 19.1 Métriques produit

| KPI | Objectif (M6) | Mesure |
|---|---|---|
| Utilisateurs actifs (WAU) | 100+ | Analytics |
| Comptes connectés par user | 3+ | DB |
| Taux de rétention J30 | > 40% | Analytics |
| NPS | > 50 | Survey |
| Temps moyen de session | > 3min | Analytics |
| PWA installs | > 30% des users | Analytics |

### 19.2 Métriques techniques

| KPI | Objectif | Mesure |
|---|---|---|
| Lighthouse Performance | > 95 | CI/CD |
| LCP | < 1.5s | RUM |
| API latency (p95) | < 200ms | Prometheus |
| Woob sync success rate | > 90% | Logs |
| Uptime | > 99.5% | Monitoring |
| Error rate | < 0.1% | Sentry |

---

## 20. Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Woob modules cassés** (banque change son site) | Élevée | Élevé | Monitoring des syncs, alertes, fallback manual input, contribuer aux fixes upstream |
| **SCA bloquante** (l'utilisateur ne peut pas valider) | Moyenne | Élevé | UX claire d'explication, timeout avec retry, mode "sync à la demande" plutôt qu'auto |
| **Rate limiting bancaire** (trop de requêtes Woob) | Moyenne | Moyen | Scheduler intelligent, respect des intervalles, cache agressif |
| **Sécurité** (fuite de credentials) | Faible | Critique | Chiffrement E2E, audits réguliers, bug bounty futur, isolation des workers |
| **Coût API IA** (LLM trop cher en scale) | Moyenne | Moyen | Modèles locaux pour catégorisation, LLM uniquement pour l'advisor, cache des réponses |
| **Complexité du monorepo** | Faible | Faible | Bonne documentation, conventions strictes, CI/CD robuste |
| **Réglementation** (DSP2, RGPD) | Moyenne | Élevé | Pas d'agrément nécessaire en self-hosted, conformité RGPD dès le design, pas de conseil réglementé |

---

## Annexe A — Glossaire

| Terme | Définition |
|---|---|
| **Net Worth** | Patrimoine net = Actifs - Passifs |
| **Woob** | Web Outside Of Browsers — framework Python d'agrégation web |
| **SCA** | Strong Customer Authentication — double authentification bancaire (DSP2) |
| **Skeleton Loader** | Placeholder animé qui reflète la forme du contenu en chargement |
| **TTI** | Time To Interactive — temps jusqu'à ce que l'app soit interactive |
| **LCP** | Largest Contentful Paint — métrique Core Web Vitals |
| **RSC** | React Server Components — composants rendus côté serveur |
| **PWA** | Progressive Web App — app web installable |
| **DVF** | Demandes de Valeurs Foncières — données immobilières open data françaises |
| **OmniScore** | Score propriétaire de santé financière (0-100) |

---

## Annexe B — Références & Inspirations

- [Woob Documentation](https://woob.tech)
- [Woob GitHub](https://gitlab.com/woob/woob)
- [Finary](https://finary.com) — Inspiration UX
- [Trade Republic](https://traderepublic.com) — Inspiration design minimaliste
- [Linear App](https://linear.app) — Inspiration UX/animations
- [Vercel Dashboard](https://vercel.com) — Inspiration design système
- [Stripe Dashboard](https://dashboard.stripe.com) — Inspiration data density
- [Prophet (Meta)](https://facebook.github.io/prophet/) — Modèle de prévision
- [LangChain](https://langchain.com) — Framework IA

---

> **Ce document est vivant.** Il doit être mis à jour à chaque décision majeure.
> Dernière mise à jour : 1er mars 2026.
