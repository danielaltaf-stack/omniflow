# OmniFlow Frontend — Comprehensive Audit Report

**Date:** 2025  
**Scope:** All files under `apps/web/src/` plus configuration files  
**Stack:** Next.js 14.2 · React 18.3 · TypeScript 5.5 · Zustand 4.5 · Framer Motion 11 · Recharts 3.7 · Tailwind CSS 3.4 · TanStack React Query 5.50

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [TypeScript Quality](#2-typescript-quality)
3. [Error Boundaries](#3-error-boundaries)
4. [Loading States & Skeletons](#4-loading-states--skeletons)
5. [Framer Motion Usage](#5-framer-motion-usage)
6. [Recharts Usage](#6-recharts-usage)
7. [Zustand Store Architecture](#7-zustand-store-architecture)
8. [API Client Configuration](#8-api-client-configuration)
9. [Design System (OmniUI)](#9-design-system-omniui)
10. [Mobile Responsiveness](#10-mobile-responsiveness)
11. [Empty States](#11-empty-states)
12. [Missing Features & Dead Code](#12-missing-features--dead-code)
13. [Accessibility (a11y)](#13-accessibility-a11y)
14. [Security](#14-security)
15. [Dark Mode](#15-dark-mode)
16. [PWA & Service Worker](#16-pwa--service-worker)
17. [Onboarding Flow](#17-onboarding-flow)
18. [OmniScore](#18-omniscore)
19. [Notification Center](#19-notification-center)
20. [CountUp / AnimatedNumber](#20-countup--animatednumber)
21. [Recommendations (Ranked)](#21-recommendations-ranked)

---

## 1. Executive Summary

OmniFlow's frontend is a **feature-rich, visually polished** personal-finance dashboard. The design system is consistent, animations are smooth and thoughtful, and the component hierarchy is well-organized. However, several architectural gaps could become liabilities as the product grows:

| Area | Verdict |
|---|---|
| Visual quality & polish | ✅ Excellent |
| Animation & micro-interactions | ✅ Excellent |
| Design system consistency | ✅ Very good |
| Loading / skeleton states | ✅ Good (present everywhere) |
| Empty states | ✅ Good (all pages covered) |
| Dark mode | ✅ Complete |
| Mobile layout | ✅ Good (responsive grid, bottom nav) |
| TypeScript strictness | ⚠️ Moderate — `any` used in every store catch block |
| Error boundaries | ❌ **Missing entirely** |
| React Query integration | ⚠️ Configured but **unused** — all fetching is in Zustand |
| Route protection | ⚠️ Client-side only (middleware is a no-op) |
| Accessibility | ⚠️ Partial — some ARIA missing |
| Security posture | ⚠️ Tokens in localStorage |
| PWA / Service Worker | ❌ Not implemented |
| Onboarding | ❌ Not implemented |
| Testing | ❌ No test framework installed |

---

## 2. TypeScript Quality

### Strengths
- **Comprehensive type definitions** in `types/api.ts` (582 lines): Every API entity — User, Account, Transaction, CashFlow, Crypto, Stocks, RealEstate, Forecast, Anomaly, Insight, Budget, Nova AI, Investment Simulator, Profiles, Projects — has a named interface.
- **All components are `.tsx`** — no `.js` or `.jsx` files in the project.
- **ForwardRef & proper generics** used in `Button` and `Input`.
- **Discriminated union patterns** for toast types (`ToastType = 'success' | 'error' | 'warning' | 'info'`).

### Issues

| Severity | Issue | Location |
|---|---|---|
| 🔴 High | `catch (e: any)` pattern in **every Zustand store** (9 stores × multiple actions ≈ 40+ occurrences). The `any` swallows error typing completely. | All `*-store.ts` files |
| 🔴 High | `payload: any` in `PropertyFormModal.handleSubmit` | `realestate/page.tsx` |
| 🟡 Medium | `Record<string, any>` in `Anomaly.data`, `InsightTip.data` | `types/api.ts` |
| 🟡 Medium | `Record<string, any>` for `updateProject` data param | `project-store.ts` |
| 🟡 Medium | `conversations: any[]` prop in `ConversationSidebar` | `nova/page.tsx` |
| 🟢 Low | `set()` helper uses `key: string` instead of `keyof typeof form` | `realestate/page.tsx`, `add-bank-modal.tsx` |
| 🟢 Low | Some inline type assertions (`as string`, `as Period`) exist but are reasonable. | Various |

### Recommendation
```ts
// Replace all catch blocks with:
catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Erreur inconnue'
  set({ error: message })
}
```

---

## 3. Error Boundaries

### Status: ❌ **Not implemented**

- **No `error.tsx`** files exist anywhere in the `app/` directory.
- **No `not-found.tsx`** files exist.
- **No `global-error.tsx`** exists.
- **No React `ErrorBoundary` class component or wrapper** anywhere in the codebase.

### Impact
Any unhandled runtime error (e.g., accessing a property on `null`, a malformed API response) will crash the entire application with a blank white screen in production. Users have **zero recovery path** other than reloading.

### Recommendation
1. Add `app/error.tsx` (global error fallback with "Retour au tableau de bord" button)
2. Add `app/(dashboard)/error.tsx` (dashboard-specific fallback)
3. Add `app/not-found.tsx` (custom 404 page)
4. Consider wrapping chart/AI sections in fine-grained `<ErrorBoundary>` components since they depend on complex data shapes.

---

## 4. Loading States & Skeletons

### Status: ✅ Good

Every page has a loading skeleton or spinner:

| Page | Skeleton Type |
|---|---|
| Dashboard | Full skeleton layout (stat cards, charts, activity) |
| Banks | Connection cards with shimmer placeholders |
| Banks/[accountId] | Text "Chargement des transactions..." + spinner for infinite scroll |
| Crypto | Stat card skeletons + token row skeletons |
| Stocks | Portfolio cards with position row skeletons |
| Real Estate | Card-level skeletons |
| Budget | 3 summary card skeletons + 5 category bar skeletons |
| Insights | Full section-level skeletons (forecast chart, budget, tips) |
| Nova | Welcome screen doubles as initial state |
| Projects | 3 project card skeletons |
| Settings | Profile section skeletons |

The `Skeleton` component (`ui/skeleton.tsx`) uses CSS shimmer animation defined in `globals.css`.

### Gaps
- **Splash page** (`app/page.tsx`) has a hardcoded 600ms delay before redirect, even if auth state is already known. This feels sluggish on fast connections.
- **No Suspense boundaries** are used for route-level code splitting — all loading is imperative via `useState(isLoading)`.
- `PullToRefresh` component exists but is **not integrated** into any page.

---

## 5. Framer Motion Usage

### Status: ✅ Excellent — extensively and judiciously used

| Pattern | Usage |
|---|---|
| **Page transitions** | `PageTransition` wrapper with opacity + y + scale |
| **List stagger** | `transition={{ delay: index * 0.05-0.07 }}` in activity feed, category bars, transaction lists, token rows, project cards |
| **Layout animations** | `layoutId` on sidebar active indicator, bottom nav dot, settings nav |
| **AnimatePresence** | Modal open/close, filter panels, create forms, section transitions |
| **whileHover / whileTap** | Buttons (`active:scale-[0.97]`), quick actions, nav items |
| **Spring physics** | Pull-to-refresh, password strength bars, sidebar collapse, conversation sidebar |
| **SVG animation** | OmniScore gauge `strokeDashoffset`, progress bars, savings rate gauge |
| **Cursor-tracking** | `GlassCard` with 3D tilt + radial glow (Stripe-inspired) |
| **Streaming indicator** | Blinking cursor in Nova chat during SSE streaming |
| **Conic gradient orb** | Nova AI orb with continuous rotation + pulse |
| **Confetti** | 30-particle burst for milestone celebrations |

### Issues
- **No `MotionConfig` provider** to set `reducedMotion` globally. Users with `prefers-reduced-motion` get ALL animations.
- Some stagger `delay` values cap at `Math.min(index * 0.05, 0.3)` (good), but others don't cap (e.g., `realestate/page.tsx PropertyCard`).
- `PageTransition` wraps content but `mode="wait"` is not set on `AnimatePresence`, so exiting/entering animations can overlap.

### Recommendation
```tsx
// In providers.tsx, add:
import { MotionConfig } from 'framer-motion'
<MotionConfig reducedMotion="user">
  {children}
</MotionConfig>
```

---

## 6. Recharts Usage

### Status: ✅ Good — 4 chart types + 1 custom SVG

| Component | Recharts Type | Features |
|---|---|---|
| `PatrimoineChart` | `LineChart` | Period toggle (3M/6M/1A/All), custom tooltip, gradient stroke, responsive |
| `CashFlowChart` | `AreaChart` | Income/expenses areas with gradients, custom tooltip, negative area |
| `AllocationDonut` | `PieChart` | Active sector highlight, interactive legend, custom colors |
| `ExpensesBarChart` | `BarChart` | Horizontal layout, top 10 categories, custom bars |
| `Sparkline` | **Pure SVG** (custom) | Catmull-Rom interpolation, animated draw-in via `strokeDashoffset`, trend coloring |
| `ForecastChart` (insights) | `AreaChart` | Confidence bands (upper/lower), reference line, period selector |
| `InvestmentSimulator` | `AreaChart` | Monte Carlo percentile bands (P10/P50/P90) |

### Issues
- **`ResponsiveContainer` width/height 100%** is used correctly everywhere.
- **No `useId()`** for chart tooltip IDs — not a problem currently but could cause issues if multiple charts with same structure coexist.
- Charts are rendered **unconditionally inside motion divs** — no memoization via `React.memo` or `useMemo` for chart data transformation. Re-renders on any parent state change will re-render all charts.
- **Barrel export** in `charts/index.ts` is well-organized. ✅

### Recommendation
Wrap chart data transformations in `useMemo` and consider `React.memo` on chart components:
```tsx
const chartData = useMemo(() => points.map(p => ({ ... })), [points])
```

---

## 7. Zustand Store Architecture

### Status: ✅ Good structure, ⚠️ some patterns need improvement

**9 domain stores:**

| Store | Persist | Key State |
|---|---|---|
| `auth-store` | ✅ localStorage (`omniflow-auth`) | user, tokens |
| `bank-store` | ❌ | banks, connections, accounts, transactions (paginated Record) |
| `crypto-store` | ❌ | portfolio, wallets |
| `stock-store` | ❌ | summary, portfolios, positions |
| `realestate-store` | ❌ | summary, properties |
| `insights-store` | ❌ | forecast, anomalies, tips, budgetCurrent |
| `advisor-store` | ❌ | messages, conversations, suggestions, streaming state |
| `profile-store` | ❌ | profiles, jointAccounts |
| `project-store` | ❌ | projects |

### Strengths
- **Clean domain separation** — no god-store.
- **Auth store** uses `partialize` to only persist `user`, `accessToken`, `refreshToken` (not loading states). ✅
- **`hydrate()` method** on auth-store correctly syncs tokens to `apiClient` and registers callbacks on app start. ✅
- **SSE streaming** in `advisor-store` correctly handles `ReadableStream` with `TextDecoderStream` for real-time chat. ✅
- **Granular loading states** in `insights-store` (per-section: forecast, anomalies, tips, budget). ✅
- **Paginated transactions** stored by `accountId` as `Record<string, PaginatedTransactions>`. ✅

### Issues

| Severity | Issue | Impact |
|---|---|---|
| 🔴 High | **React Query is configured but completely unused.** All 9 stores use direct `apiClient` calls. This means no automatic cache invalidation, no background refetching, no deduplication of in-flight requests. | Wasted dependency (adds 25KB gzipped); manual reimplementation of caching logic |
| 🔴 High | **No request deduplication.** If a user navigates to Dashboard, triggers `fetchAccounts`, then navigates away and back, a duplicate request fires. | Unnecessary API calls |
| 🟡 Medium | **Error state is per-store, not per-action.** A single `error` string for the whole store means showing/clearing errors can cause UI flicker when multiple actions happen. | Error UI confusion |
| 🟡 Medium | **No optimistic updates** for any mutation (create/update/delete). All mutations `await` the API response before updating local state. | Sluggish perceived performance |
| 🟡 Medium | `advisor-store` uses raw `fetch()` for SSE streaming (can't use apiClient's retry/auth logic). If the token expires mid-stream, the stream will fail silently. | SSE stream breakage |
| 🟢 Low | Stock store's CSV import uses raw `fetch()` with `FormData` — necessary because `apiClient` doesn't support multipart. | Inconsistency |

### Recommendation
Either:
- **Option A:** Remove React Query, acknowledge imperative Zustand stores as the pattern.
- **Option B (preferred):** Migrate data fetching to React Query hooks (`useQuery`/`useMutation`), keep Zustand only for pure client state (modals, filters, selections).

---

## 8. API Client Configuration

### Status: ✅ Good core, ⚠️ missing robustness

**File:** `lib/api-client.ts` (~150 lines)

### Features
- Bearer token injection via `Authorization` header ✅
- **Token refresh with deduplication**: If multiple 401s fire concurrently, only one refresh request is made; others queue via a shared promise ✅
- 401 retry: Intercepts 401, refreshes token, retries original request once ✅
- Callbacks: `onTokenRefresh` and `onAuthFailure` hooks ✅
- Handles `204 No Content` (returns `undefined`) ✅
- Methods: `get`, `post`, `put`, `delete`, `patch` ✅
- Error extraction: Reads `detail` field from JSON error body ✅

### Issues

| Severity | Issue |
|---|---|
| 🔴 High | **No request timeout.** A hung backend will hang the UI indefinitely. |
| 🔴 High | **No AbortController support.** Navigating away from a page cannot cancel in-flight requests. |
| 🟡 Medium | **No retry for network failures** (only retries 401). A 500 or `TypeError: Failed to fetch` is terminal. |
| 🟡 Medium | **No request/response interceptor architecture.** Everyone who needs non-JSON bodies (SSE, FormData) must use raw `fetch`. |
| 🟡 Medium | **Base URL is baked as empty string** (relies on Next.js rewrite). This prevents using the client in different contexts (e.g., tests, SSR). |
| 🟢 Low | Error objects are plain `Error` — no custom error class with `status`, `code` fields. |

### Recommendation
```ts
// Add timeout support:
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30_000)
const res = await fetch(url, { ...options, signal: controller.signal })
clearTimeout(timeoutId)
```

---

## 9. Design System (OmniUI)

### Status: ✅ Very Good — cohesive token-based system

### Token Architecture (in `tailwind.config.ts`)

**Colors** (CSS variables → Tailwind tokens):
| Token | Light | Dark |
|---|---|---|
| `background` | `#ffffff` | `#000000` (OLED true black) |
| `background-secondary` | `#f8f9fa` | `#0a0a0a` |
| `background-tertiary` | `#f0f1f3` | `#111111` |
| `surface` | `#ffffff` | `#161616` |
| `surface-elevated` | `#f0f1f3` | `#1a1a1a` |
| `border` | `#e5e7eb` | `#222222` |
| `brand` | `#6366f1` | `#818cf8` |
| `brand-light` | `#818cf8` | `#a5b4fc` |
| `brand-dark` | `#4f46e5` | `#6366f1` |
| `gain` | `#10b981` | `#34d399` |
| `loss` | `#ef4444` | `#f87171` |
| `warning` | `#f59e0b` | `#fbbf24` |
| `info` | `#3b82f6` | `#60a5fa` |

**Finance category colors:** 12 mapped categories (alimentation, transport, logement, etc.) ✅

**Border radius tokens:** `omni` (12px), `omni-sm` (8px), `omni-lg` (16px) ✅

**Custom animations:** shimmer, fade-in, slide-up, shake, spin-slow, pulse-soft ✅

### UI Components (12 total)

| Component | Quality | Notes |
|---|---|---|
| `Button` | ✅ Excellent | 4 variants, 3 sizes, loading spinner, forwardRef, focus-visible ring |
| `Input` | ✅ Excellent | Label, error, icon, password toggle, forwardRef |
| `Card` | ✅ Good | Optional hover lift |
| `Skeleton` | ✅ Good | CSS shimmer |
| `Toast` | ✅ Excellent | Context-based, 4 types, AnimatePresence, auto-dismiss, max 5 |
| `AnimatedNumber` | ✅ Good | requestAnimationFrame-based CountUp |
| `NotificationCenter` | ✅ Good | Dropdown, polling, mark read |
| `GlassCard` | ✅ Excellent | Glassmorphism + cursor-tracking glow + 3D tilt |
| `PasswordStrength` | ✅ Good | 4-level strength meter with spring bars |
| `Confetti` | ✅ Good | 30-particle burst |
| `PullToRefresh` | ✅ Good | Touch event handling with spring |
| `Logo` | ✅ Good | SVG, 3 sizes, optional animation |

### Gaps
- **No `Select` component** — pages use raw `<select>` HTML with manually duplicated styling classes.
- **No `Modal`/`Dialog` component** — every modal is built from scratch with AnimatePresence + backdrop. There are 8+ modals across the app, each reimplementing the same pattern (~50 lines each).
- **No `Badge` component** — despite badges being used in 10+ places (status, severity, type labels).
- **No `Tabs` component** — period toggles (1m/3m/6m, 7j/14j/30j/60j) are reimplemented in 4 pages.
- **No `Tooltip` component** — `CategoryBadge` implements its own tooltip; others use `title` attribute.

### Recommendation
Extract these repeated patterns into reusable UI primitives:
- `<Select>` with design tokens
- `<Modal>` (backdrop, close on click-outside, AnimatePresence, escape key)
- `<Badge variant="success|warning|error|info">`
- `<ToggleGroup>` for period selectors
- `<Tooltip>` with Framer Motion

---

## 10. Mobile Responsiveness

### Status: ✅ Good

### Layout Strategy
- **Sidebar** (`sidebar.tsx`): `hidden md:flex` — desktop only ✅
- **BottomNav** (`bottom-nav.tsx`): `md:hidden` — mobile only, fixed bottom ✅
- **Dashboard layout**: `pb-16 lg:pb-0` accounts for bottom nav height ✅
- **Content**: `mx-auto max-w-5xl px-3 sm:px-5` — slight padding bump at `sm` breakpoint ✅

### Responsive Patterns Used
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for stat cards
- `hidden sm:table-cell` / `hidden md:table-cell` / `hidden lg:table-cell` for progressive table column disclosure (stocks page)
- `hidden sm:block` for secondary info in transaction lists
- `flex-col sm:flex-row` for page headers (title + actions)
- `overflow-x-auto` on table containers

### Issues
- **Nova chat**: Full-screen on mobile (good), fixed panel on desktop (good). However, the floating orb button has `bottom-6 right-6` which overlaps with `BottomNav` on mobile. The `bottom-nav` is `h-16` and the orb is at `bottom: 1.5rem` — these **overlap**.
- **Settings page**: Horizontal scrollable nav on mobile (`overflow-x-auto`) works but the UX is suboptimal — section tabs aren't visible without scrolling.
- **Stocks table**: On very narrow screens (`< 640px`), only Symbol, Value, and P&L columns remain — this is acceptable.
- **Modal scrolling**: Most modals use `overflow-y-auto py-8` on the backdrop — good for long forms.

### Recommendation
- Move Nova orb above BottomNav on mobile: `bottom-20 md:bottom-6`
- Consider a collapsible accordion for settings sections on mobile instead of horizontal scroll.

---

## 11. Empty States

### Status: ✅ Good — all pages covered

| Page | Empty State |
|---|---|
| Dashboard | Animated illustration + "Ajoutez un compte bancaire, un wallet crypto, ou un portefeuille boursier" + AddBankModal |
| Banks | Icon + "Connectez votre première banque" + AddBankModal trigger |
| Banks/[accountId] | "Aucune transaction trouvée pour ce compte" |
| Crypto | Icon + "Suivez vos crypto-actifs" + "Connecter un wallet" button |
| Crypto (wallets synced, no tokens) | "Synchronisez vos wallets pour voir vos holdings" |
| Stocks | Icon + "Suivez vos investissements boursiers" + Create portfolio button |
| Stocks (portfolio, no positions) | "Aucune position. Ajoutez-en manuellement ou importez un CSV." |
| Real Estate | Icon + "Ajoutez votre premier bien immobilier" + button |
| Budget | Icon + "Pas encore de données" + "Connectez un compte bancaire..." |
| Budget (no category data) | "Pas assez de données pour cette période" |
| Insights | Combined empty state when all sections empty |
| Nova | Welcome screen with animated orb + suggestion chips |
| Nova sidebar | "Aucune conversation" + "Commencez une discussion avec Nova" |
| Projects | Icon + "Aucun projet" + Create button |
| Settings/Profiles (no profiles) | Skeleton loading |
| Activity Feed | Inbox icon + "Aucune transaction récente" |

All empty states use consistent visual language: centered layout, muted icon in brand circle, descriptive text, CTA button with brand styling.

---

## 12. Missing Features & Dead Code

### Missing Features

| Feature | Status | Notes |
|---|---|---|
| **Error boundaries** | ❌ Missing | No `error.tsx`, `not-found.tsx`, or React ErrorBoundary |
| **PWA support** | ❌ Missing | No manifest.json, no service worker, no next-pwa |
| **Onboarding flow** | ❌ Missing | No guided first-run experience after registration |
| **Testing** | ❌ Missing | No test framework (no jest, vitest, playwright, cypress). no `__tests__` directories |
| **i18n** | ❌ Missing | All strings hardcoded in French. No i18n framework |
| **Profile edit** | ❌ Placeholder | Settings profile section shows disabled inputs + "sera disponible dans une prochaine mise à jour" |
| **Offline support** | ❌ Missing | No data caching, no offline detection |
| **Rate limiting UI** | ⚠️ Partial | Nova status shows rate limit, but no global rate limit handling |
| **Keyboard shortcuts** | ❌ Missing | No hotkeys for navigation or actions |
| **Data export** | ❌ Missing | No export to CSV/PDF for transactions, portfolio, etc. |

### Dead / Unused Code

| Item | Location | Issue |
|---|---|---|
| **React Query** | `providers.tsx`, `package.json` | `QueryClientProvider` is set up with `staleTime: 30_000` and `retry: 1`, but **no `useQuery` or `useMutation` hooks exist anywhere** in the codebase. 25KB gzipped wasted. |
| **`PullToRefresh` component** | `ui/pull-to-refresh.tsx` | Fully implemented but **not used on any page**. |
| **`Confetti` component** | `ui/confetti.tsx` | Fully implemented but **not used on any page**. (Likely intended for project goal completion.) |
| **`optimizePackageImports`** | `next.config.mjs` | Includes `framer-motion` — this is correct and helps with tree-shaking. ✅ |
| **Middleware** | `middleware.ts` | Returns `NextResponse.next()` — **complete no-op**. The `matcher` config is also empty (defaults). |

---

## 13. Accessibility (a11y)

### Status: ⚠️ Partial

### What's Done Right
- `<html lang="fr">` ✅
- `focus-visible:ring-2` on buttons and inputs ✅
- `sr-only` not used anywhere — but some icon-only buttons have `title` attributes ⚠️
- Form `<label>` elements present in all forms ✅
- `suppressHydrationWarning` on `<html>` for next-themes ✅
- Semantic heading hierarchy (h1 → h2 → h3) on most pages ✅

### Issues

| Severity | Issue | Location |
|---|---|---|
| 🔴 High | **No `aria-label` on icon-only buttons.** Sidebar toggle, delete buttons, sync buttons, close buttons across all pages use icons without text labels. Screen readers announce "" or "button". | All pages |
| 🔴 High | **Modals don't trap focus.** Tab key can escape modals and reach elements behind the backdrop. No `role="dialog"`, no `aria-modal="true"`. | All modal components (8+) |
| 🔴 High | **No skip-to-content link.** | `layout.tsx` |
| 🟡 Medium | **Charts are inaccessible.** No alt text, no data tables, no `role="img"` with `aria-label` on chart containers. Screen readers see nothing meaningful. | All chart components |
| 🟡 Medium | **`confirm()` used for delete actions.** Browser-native confirm dialogs are accessible but jarring and unstyled. | Stocks, Real Estate, Projects pages |
| 🟡 Medium | **Toast notifications** are positioned visually but not announced. No `role="alert"` or `aria-live="polite"` on the toast container. | `toast.tsx` |
| 🟡 Medium | **NotificationCenter dropdown** has no `role="menu"` or keyboard navigation (arrow keys). | `notification-center.tsx` |
| 🟢 Low | **Color-only indicators** (gain=green, loss=red) may be insufficient for color-blind users. Trend arrows help, but standalone color badges don't. | Various |

### Recommendation
Priority fixes:
1. Add `aria-label` to all icon-only buttons
2. Add `role="dialog"`, `aria-modal="true"`, focus trap to modals
3. Add `role="alert"` to toast container
4. Add `aria-label` describing chart content on chart wrappers

---

## 14. Security

### Status: ⚠️ Moderate concerns

| Severity | Issue | Details |
|---|---|---|
| 🔴 High | **Tokens stored in localStorage** via Zustand persist. Vulnerable to XSS — any injected script can read `localStorage.getItem('omniflow-auth')` and exfiltrate tokens. | `auth-store.ts` |
| 🔴 High | **Middleware is a no-op.** Route protection is entirely client-side (JS check in dashboard layout). A determined attacker can access the dashboard HTML/JS bundle without authentication. Server-side protection is absent. | `middleware.ts` |
| 🟡 Medium | **No CSP (Content-Security-Policy) headers.** | `next.config.mjs` |
| 🟡 Medium | **No CSRF protection.** API calls use Bearer tokens (which aren't automatically sent by browsers like cookies), so CSRF is less critical — but the raw `fetch()` calls for SSE and CSV import bypass the apiClient entirely. | `advisor-store.ts`, `stock-store.ts` |
| 🟡 Medium | **No rate limiting on client side** for auth endpoints (login/register). A brute-force could hammer `/api/v1/auth/login`. | `auth-store.ts` |
| 🟢 Low | **`suppressHydrationWarning`** is used appropriately (only on `<html>` for next-themes), not suppressing actual hydration bugs. ✅ | |
| 🟢 Low | **API proxy** via next.config rewrites hides backend URL from client. ✅ | |

### Recommendation
1. **Critical:** Migrate token storage to `httpOnly` cookies (set by the API). Or use a BFF (Backend For Frontend) pattern where Next.js API routes proxy auth.
2. **Critical:** Implement actual middleware route protection:
```ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
```
3. Add security headers in `next.config.mjs`.

---

## 15. Dark Mode

### Status: ✅ Fully Implemented

### Architecture
1. **CSS Variables** defined in `globals.css` for `:root` (light) and `.dark` (dark)
2. **Tailwind `darkMode: 'class'`** strategy — `.dark` class toggles all token values
3. **`next-themes`** `ThemeProvider` with `attribute="class"`, `defaultTheme="dark"`, `enableSystem: true`
4. **Theme toggle** in sidebar cycles: dark → light → system (3-state)

### Token Coverage
- All 20+ color tokens have light AND dark values ✅
- OLED true black (`#000000`) for `background` in dark mode ✅
- Elevated surface uses `#161616` → `#1a1a1a` for depth hierarchy ✅
- `transition-colors` applied globally via `globals.css`: `*, *::before, *::after { transition: background-color 0.2s, border-color 0.2s, color 0.2s }` ✅

### Issues
- **Bottom nav and sidebar** use `bg-background/80 backdrop-blur-lg` — correct for both modes ✅
- **Chart colors** use hardcoded hex values (e.g., `#818cf8`, `#34d399`) that are the **dark-mode variants** of brand/gain. These won't adapt to light mode. The charts will look fine in dark mode but may clash in light mode.
- **Confetti colors** and **Nova orb gradient** are hardcoded — acceptable since they're decorative.

---

## 16. PWA & Service Worker

### Status: ❌ Not Implemented

- **No `manifest.json`** in `public/` (only `banks/` directory with bank logo PNGs)
- **No service worker** file (no `sw.js`, `sw.ts`, `service-worker.js`)
- **No `next-pwa`** or `workbox` in dependencies
- **No `<link rel="manifest">`** in root layout
- **No install prompt handling**

### What Exists
- `<meta name="theme-color">` is set in viewport config (indirectly via `themeColor` in layout.tsx) ✅
- 38 bank logo PNGs in `public/banks/` — could be precached for offline

### Recommendation
Install `@ducanh2912/next-pwa` (modern fork) and create a minimal manifest:
```json
{
  "name": "OmniFlow",
  "short_name": "OmniFlow",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#6366f1"
}
```

---

## 17. Onboarding Flow

### Status: ❌ Not Implemented

After registration, the user is redirected to the splash screen → dashboard. The dashboard shows an **empty state** with a prompt to add a bank, but there is no:
- Step-by-step guided tour
- "What would you like to track?" wizard
- Tooltips pointing to key features
- Progress indicator ("2/5 steps completed")
- Welcome modal on first login

The empty dashboard state is functional and well-designed, but it doesn't guide the user through the multi-asset nature of the app (banks + crypto + stocks + real estate).

### Recommendation
A lightweight onboarding could be:
1. Welcome modal after first login (detect via `user.created_at` proximity)
2. Checklist widget: "Connect a bank ✓", "Add crypto wallet", "Set up a savings goal"
3. Pulsing hints on sidebar items

---

## 18. OmniScore

### Status: ✅ Well Implemented

**File:** `components/finance/omni-score.tsx` (301 lines)

### Features
- **Two variants:** `full` (detailed panel) and `widget` (compact for dashboard)  
- **Circular SVG gauge** with animated `strokeDashoffset` (spring transition)
- **CountUp animation** for the score number (requestAnimationFrame-based)
- **Color coding:** 0-40 red, 40-60 orange, 60-80 yellow, 80-100 green
- **Label mapping:** Critique → Faible → Moyen → Bon → Excellent
- **CriterionBar** sub-component: Individual criteria with animated progress bars
- **Recommendations list** with icon + description
- **MiniGauge** export for compact dashboard embedding
- **Loading skeleton** support

### Data Source
Fetched via `apiClient.get<OmniScoreData>('/api/v1/insights/omni-score')` — not from a Zustand store. Called directly in the component.

### Issues
- **No caching:** Score is re-fetched every time the component mounts. If the dashboard re-renders, it fetches again. This is a candidate for React Query.
- **CountUp implementation** uses `setInterval(16ms)` in `net-worth-hero.tsx` but `requestAnimationFrame` in `omni-score.tsx` — inconsistent animation strategy.

---

## 19. Notification Center

### Status: ✅ Good Implementation

**File:** `components/ui/notification-center.tsx` (235 lines)

### Features
- **Bell icon** in sidebar with unread count badge (red dot with number)
- **Dropdown panel** with notification list
- **Polling:** Fetches `/api/v1/notifications` every 60 seconds
- **Mark as read:** Individual and "mark all as read" actions  
- **8 notification types** with distinct icons and colors: `info`, `warning`, `error`, `success`, `sync_complete`, `sync_error`, `anomaly`, `tip`
- **Empty state:** Bell icon + "Aucune notification"
- **Outside-click-to-close** via `mousedown` event listener
- **Relative timestamps** via `formatRelativeDate`

### Issues
- **Direct API calls** (`apiClient.get/post`) instead of going through a Zustand store. This means notification state is isolated to the component instance — if notifications are shown elsewhere, they won't be in sync.
- **Polling only** — no WebSocket or SSE for real-time push. The 60s interval means up to 60s delay for new notifications.
- **No sound or browser notification** on new items.
- **Not connected to Service Worker** (which doesn't exist) for push notifications.

---

## 20. CountUp / AnimatedNumber

### Status: ✅ Implemented in 3 distinct ways (inconsistent)

| Implementation | Location | Technique | Duration |
|---|---|---|---|
| `AnimatedNumber` component | `ui/animated-number.tsx` | `requestAnimationFrame` + ease-out cubic | 600ms |
| `NetWorthHero` inline | `finance/net-worth-hero.tsx` | `setInterval(16ms)` | 1200ms |
| `OmniScore` inline | `finance/omni-score.tsx` | `requestAnimationFrame` + ease-out quadratic | 1500ms |
| `StatCard` inline | `finance/stat-card.tsx` | `setInterval(20ms)` | 800ms |

### Issues
- **3 different animation techniques** for the same visual effect.
- `setInterval` is less smooth than `requestAnimationFrame` — can jank on slower devices.
- Different easing curves (cubic vs quadratic).
- Different durations (600ms to 1500ms).

### Recommendation
Consolidate all CountUp animations into the `AnimatedNumber` component (which already uses the best technique: `requestAnimationFrame` with cubic easing). Make duration configurable:
```tsx
<AnimatedNumber value={totalValue} duration={1200} />
```

---

## 21. Recommendations (Ranked by Priority)

### 🔴 Critical

| # | Recommendation | Effort |
|---|---|---|
| 1 | **Add error boundaries** (`error.tsx`, `not-found.tsx`, `global-error.tsx`) | 2h |
| 2 | **Migrate tokens from localStorage to httpOnly cookies** or implement a BFF pattern | 1-2d |
| 3 | **Implement middleware route protection** (server-side auth guard) | 2h |
| 4 | **Add request timeouts + AbortController** to apiClient | 3h |
| 5 | **Fix `catch (e: any)` pattern** across all 9 stores (use `unknown`) | 2h |

### 🟡 Important

| # | Recommendation | Effort |
|---|---|---|
| 6 | **Decide on React Query** — either adopt it properly or remove it | 1-3d |
| 7 | **Add `MotionConfig reducedMotion="user"`** for accessibility | 15min |
| 8 | **Extract shared Modal, Select, Badge, ToggleGroup** components | 1d |
| 9 | **Add aria-labels** to all icon-only buttons and dialog roles to modals | 3h |
| 10 | **Add `role="alert"` to Toast** container | 15min |
| 11 | **Memoize chart data** transformations with `useMemo` | 2h |
| 12 | **Add security headers** (CSP, X-Frame-Options) in next.config | 1h |
| 13 | **Fix Nova orb overlap with BottomNav** on mobile | 15min |

### 🟢 Nice to Have

| # | Recommendation | Effort |
|---|---|---|
| 14 | **Consolidate CountUp** into a single `AnimatedNumber` component | 2h |
| 15 | **Add PWA manifest + service worker** | 0.5d |
| 16 | **Add onboarding flow** for new users | 1-2d |
| 17 | **Integrate `PullToRefresh` and `Confetti`** into actual pages | 2h |
| 18 | **Add testing** (Vitest for units, Playwright for E2E) | Ongoing |
| 19 | **Remove splash screen 600ms delay** — redirect immediately if auth state is known | 30min |
| 20 | **Make chart colors theme-aware** (use CSS variables instead of hex) | 2h |
| 21 | **Add keyboard shortcuts** for power users | 1d |

---

## Appendix: File Inventory

### Configuration (5 files)
- `package.json` — 14 deps, 9 devDeps
- `next.config.mjs` — API rewrite, optimizePackageImports
- `tailwind.config.ts` — 118 lines, full token system
- `tsconfig.json` — paths alias `@/` → `src/`
- `postcss.config.js` — tailwindcss + autoprefixer

### Pages (14 routes)
- `/` — Splash + redirect
- `/login` — Auth form
- `/register` — Auth form
- `/dashboard` — Main dashboard (322 lines)
- `/banks` — Connections list
- `/banks/[accountId]` — Transaction detail with infinite scroll (314 lines)
- `/crypto` — Wallets & holdings (456 lines)
- `/stocks` — Portfolios & positions (697 lines)
- `/realestate` — Properties (571 lines)
- `/budget` — Cash flow analysis (427 lines)
- `/insights` — AI forecasts, anomalies, tips, budget (905 lines)
- `/nova` — Full-screen AI chat (941 lines)
- `/projects` — Savings goals (671 lines)
- `/settings` — Profile, connections, preferences, security (756 lines)

### Components (25 files)
- **Layout (3):** sidebar, bottom-nav, page-transition
- **UI (12):** button, card, input, logo, skeleton, toast, animated-number, notification-center, glass-card, password-strength, confetti, pull-to-refresh
- **Finance (7):** net-worth-hero, stat-card, omni-score, dashboard-header, activity-feed, quick-actions, category-badge
- **Charts (5+1):** patrimoine-chart, cashflow-chart, allocation-donut, expenses-bar-chart, sparkline, index.ts
- **Bank (3):** add-bank-modal, account-card, transaction-list
- **AI (2):** nova-chat, investment-simulator

### Stores (9 files)
auth, bank, crypto, stock, realestate, insights, advisor, profile, project

### Lib (3 files)
api-client, format, utils

### Types (1 file)
api.ts (582 lines)

### Public Assets
38 bank logo PNGs in `public/banks/`

---

*End of audit report.*
