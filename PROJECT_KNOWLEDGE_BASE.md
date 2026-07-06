# Creator Radar — Project Knowledge Base

> Purpose of this document: give any developer or AI assistant a complete, accurate
> mental model of how Creator Radar is built, so they can understand issues, suggest
> fixes, and make **safe, targeted, approved** changes without needing the original author.
>
> This document contains **no secret values**. It names *where* secrets live (env var
> names) but never the keys themselves. Keep it that way — see "Security Rules" below.

---

## 1. What Creator Radar is

Creator Radar is an AI-powered content-intelligence platform for content creators and
local service businesses (any niche). Users log in, pick a niche, and the app:

- scans trending keywords/topics for their niche (live, in the browser),
- generates content hooks, captions, ideas, and a daily content plan,
- reads their analytics screenshots with a vision AI and produces a performance audit,
- tracks streaks / XP / weekly scorecards,
- (business mode) generates customer-facing marketing content for local businesses,
- (commerce mode) adds TikTok Shop / affiliate product tooling.

There are **two account modes**, which change tone and templates everywhere:
- **creator mode** — content is written first-person ("I tried X for 30 days").
- **business mode** — content speaks to the business's *own potential customers*, with
  the user positioned as the provider ("book with us", "our clients love…").
  It must **never** address other businesses ("grow your business", "secret weapon for
  local businesses") — that framing is a known bug class; see §10.

---

## 2. High-level architecture

```
                 ┌──────────────────────────────────────────────┐
   Browser  ───▶ │  Static front-end (index.html + JS modules)  │
   (user)        │  - all UI, templates, client-side logic       │
                 └───────────────┬───────────────┬──────────────┘
                                 │               │
                     Supabase JS │               │ fetch("/api/...")
                                 ▼               ▼
                 ┌───────────────────┐   ┌────────────────────────────┐
                 │ Supabase (auth +   │   │ Vercel serverless (api/)   │
                 │ a few tables)      │   │ - Groq/Gemini AI proxy     │
                 └───────────────────┘   │ - TikTok live-state / trends│
                                         │ - Apify TikTok scraping     │
                                         └─────────────┬──────────────┘
                                                       ▼
                                    Groq API / Gemini API / Apify API
```

The front-end is **host-agnostic**: it works on both hosts below. When the Vercel
`/api/*` backend is unreachable (e.g. on GitHub Pages), a fetch interceptor falls back
to calling Groq directly from the browser using a public config key.

---

## 3. Hosting & deployment

Two live hosts serve the **same repo** (`patriotradar/patriot-radar-dashboard`):

| Host | URL | Role |
|------|-----|------|
| Vercel | `creatorradar.co.uk` (custom domain) + `patriot-radar-dashboard.vercel.app` | **Primary.** Has the `/api/*` serverless backend. |
| GitHub Pages | `https://patriotradar.github.io/patriot-radar-dashboard/` | **Mirror / fallback.** Static only — no `/api`, AI features fall back to direct Groq. Same Supabase accounts. |

**Deploy flow:** push to `main` on GitHub → Vercel auto-builds and deploys.

**Important deployment facts / gotchas:**
- **Free-tier limit: 100 deploys/day (account-wide).** An external "auto-updater"
  process pushes commits titled `Update live trend results` roughly every 10 minutes
  (~144/day). Left unchecked this exhausts the daily deploy quota and **blocks genuine
  fixes from deploying for up to 24 hours.**
- **Mitigation in place:** `vercel.json` has an `ignoreCommand` that **skips** the build
  for any commit whose message contains `Update live trend results` (trends are scanned
  live client-side, so those commits don't need a redeploy). Genuine commits — including
  Cursor pushes — still deploy normally. This keeps the daily quota available for real changes.
- When the daily quota is already spent, **no** deploy method works (deploy hook or API
  both return `payment_required` / `api-deployments-free-per-day`). You must wait for the
  ~24h reset. The mirror can be used in the meantime.
- The GitHub Pages mirror updates within a minute or two of a push, independent of Vercel.

---

## 4. Codebase structure

### Front-end (repo root)
- **`index.html`** (~13,300 lines) — the entire single-page app: all UI, all templates
  (hooks, captions, ideas, niche seeds), all client-side logic, the audit engine, and
  the Supabase auth flow. This is where ~90% of feature work happens.
- **External JS modules** (loaded via `<script src>` from `index.html`), each guarded so
  a missing module can't crash the app:
  - `tiktok-live-state-client.js`, `tiktok-live-state.js`, `tiktok-live-state-integration.js`
    — RBAC / live entitlement state.
  - `tiktok-access-control.js` — **module/tab visibility (RBAC).** Controls which tabs a
    user sees, including the Admin tab. (See §6.)
  - `commerce-mode.js`, `commerce-dashboard.js`, `tiktok-shop-inventory-gate.js`,
    `tiktok-content-mode-resolver.js`, `tiktok-inventory-predictor.js`,
    `tiktok-orchestration-dashboard.js` — TikTok Shop / commerce mode.
  - `niche-comment-intelligence.js`, `niche-comment-virality-prediction.js`,
    `niche-comment-signals.js`, `virality-intelligence-dashboard.js`,
    `tiktok-insights-hardening.js` — comment intelligence & virality features.
- **`terms.html`, `privacy.html`, `audit.html`** — static pages (routed in `vercel.json`).
- **`analytics.html`** — internal analytics view (password-gated).

### Serverless backend (`api/`, Vercel functions)
- `api/chat/completions.js` — **main AI proxy.** Front-end calls `/api/chat/completions`;
  this forwards to Groq, with a Gemini fallback. Keeps API keys server-side.
- `api/chat/audit-prompts.js` — prompt templates for the creator audit.
- `api/health.js` — health check.
- `api/public-config.js` — serves non-secret front-end config (routed as `/api/public-config.js`).
- `api/tiktok-live-state.js`, `api/tiktok-live-state-assembler.js`,
  `api/tiktok-live-dashboard-state.js` — live entitlement/RBAC state endpoint.
- `api/tiktok-access-control.js` — server-side access control helpers.
- `api/trend-intelligence.js`, `api/trend-intelligence-providers.js` — trend data.
- `api/tiktok-insights.js`, `api/tiktok-content-approval.js` — insights & approvals.
- `api/tiktok-comments.js` — **Apify** TikTok comment scraping (needs Apify env vars set).

### Config
- **`vercel.json`** — routing (rewrites), function `maxDuration` settings, and the
  `ignoreCommand` deploy-skip rule (§3).

---

## 5. Data & storage model

### Supabase (project `kdwqnlgdanzigpdwyqbh.supabase.co`)
Used for **authentication** and a few tables. Tables referenced by the app:
- **`cr_support_tickets`** — support tickets **and** delivered audit reports
  (category `audit_report` rows are surfaced to a customer at their sign-in).
- **`cr_analytics`** — usage analytics events.
- **`cr_referrals`** — referral tracking.

`mailer_autoconfirm` is **on** — accounts created via signUp can log in immediately with
no email-confirmation step (this is what makes admin-created customer accounts work).

### User profile (Supabase `user_metadata`)
Per-user settings live in auth `user_metadata`, not a separate profiles table:
`niche`, `account_mode` (creator/business), `business_type`, `business_name`,
`business_location`, `success_goal`, `role`, `ambassador`, `paid`, `signup_date`,
`must_set_password` (forces first-login password setup), `audienceModel`,
`performance`, `streak`.

### Browser `localStorage` (device-local, not synced)
Caches and per-device UI state, e.g.: `cr_audits`, `cr_audit_applications`,
`cr_scan_cache_*` (trend scan caches), `cr_niche_history`, `cr_session_count`,
`cr_has_account`, `cr_groq_key` (public fallback key only), `cr_read_notifs`,
`cr_tour_done_*` / `cr_tour_dismissed_*` (guided tours), `patriot_active_tab`,
`patriot_audience`, `patriot_brightness`. **Never store secrets or PII here.**

---

## 6. Auth & roles (RBAC)

- Auth is Supabase (email/password). The Supabase **anon/publishable key is public by
  design** (it is embedded client-side and only permits what Row Level Security allows).
- **Admins** and **ambassadors** are identified by email allow-lists
  (`ADMIN_EMAILS` / `TIKTOK_ADMIN_EMAILS`, `AMBASSADOR_EMAILS`, configured in env / code).
- **Tab visibility** is driven by `tiktok-access-control.js` (`applyModuleVisibility`),
  fed by the live-state endpoint (`/api/tiktok-live-state`).
- **Known failure mode (already fixed, keep it fixed):** if the live-state endpoint
  returns null (e.g. blocked by Vercel's "Attack Challenge Mode"), RBAC must **not** hide
  the Admin tab from a known admin/ambassador. The Admin tab is revealed synchronously
  from the email match in `showDashboard`, and `applyModuleVisibility` only hides it when
  the user is **not** a known admin/ambassador. Don't regress this.

---

## 7. Integrations

| Integration | Used for | Where |
|-------------|----------|-------|
| **Supabase** | Auth + tables | `index.html` (client), `api/*` (server, service role) |
| **Groq API** | Primary LLM (hooks, captions, audit, vision) | `api/chat/completions.js`; direct fallback in browser |
| **Gemini API** | LLM fallback when Groq fails | `api/chat/completions.js` |
| **Apify** | TikTok comment/video scraping | `api/tiktok-comments.js` (planned: username→videos pipeline) |
| **Google Suggest** | Live trend keyword scanning | client-side in `index.html` |

**Vision model:** `meta-llama/llama-4-scout-17b-16e-instruct` (reads analytics screenshots).
Do not revert to `llama-3.2-11b-vision-preview` — it is decommissioned and breaks all
screenshot reading.

**Planned (roadmap):** a second audit input mode — user enters a TikTok username, Apify
pulls their latest videos + metrics, normalized into the **same** structured performance
format the screenshot flow produces, so the same audit engine handles both. Blocked on an
Apify API key being set in Vercel env.

---

## 8. Environment variables (names only — never commit values)

Set in **Vercel project env** (server-side, secret):
- `GROQ_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` — LLM access.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase
  (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public-safe variants).
- `APIFY_API_KEY` / `APIFY_API_TOKEN`, `APIFY_TIKTOK_ACTOR_ID`,
  `TIKTOK_APIFY_HASHTAGS`, `TIKTOK_APIFY_RESULTS_PER_PAGE` — Apify scraping.
- `ADMIN_EMAILS` / `TIKTOK_ADMIN_EMAILS` — admin allow-list.
- `ALLOWED_ORIGIN` — CORS origin for the API.
- `CRON_SECRET`, `TREND_INTELLIGENCE_CRON_SECRET` — protect cron endpoints.
- `RESULTS_JSON_URL`, `TRENDS_JSON_URL` — external data sources.

> **`SUPABASE_SERVICE_ROLE_KEY` is the most sensitive secret in the system.** It bypasses
> Row Level Security. It must only ever be used server-side in `api/*`, never sent to the
> browser, never logged, never committed.

---

## 9. Security rules (for humans and AI assistants)

1. **Never commit secrets.** No API keys, tokens, service-role keys, or passwords in the
   repo — not in code, not in this doc, not in commit messages. Use Vercel env vars.
2. **Service-role key stays server-side.** Only `api/*` may use `SUPABASE_SERVICE_ROLE_KEY`.
   The browser only ever gets the anon/publishable key.
3. **Treat all user input as untrusted.** Sanitize before rendering; never build SQL or
   shell strings from user input.
4. **Keep RLS as the source of truth** for what data a user can read/write. Client-side
   checks (like tab visibility) are UX, not security.
5. **CORS:** keep `ALLOWED_ORIGIN` scoped; don't open the API to `*` in production without
   reason.
6. **Don't weaken the admin allow-list** or add emails without approval.
7. **Guard external modules** with `typeof` checks so a missing/failed module can't brick
   the app.
8. **No secrets or PII in `localStorage`** or client logs.

---

## 10. Change-safety guide

### ✅ Safe to change without special approval (test first, then ship)
- Copy/wording of hooks, captions, ideas, tooltips, guided-tour text.
- Adding niches, keyword seeds, or template variants.
- Styling / layout / responsive fixes (test on mobile — the owner uses an iPhone).
- Bug fixes to client-side rendering logic that don't touch auth, RBAC, or secrets.
- Adjusting AI **prompt wording** to improve output quality/tone.

### ⚠️ Requires the owner's approval before shipping
- Anything touching **auth**, **RBAC / access control**, or the **admin allow-list**.
- Database schema / table changes, or new Supabase tables/columns.
- New third-party integrations or new outbound network calls.
- Changes to `vercel.json` (routing, the `ignoreCommand` deploy rule, function limits).
- Pricing, billing, or anything customer-facing that implies a commercial commitment.
- Anything that changes what data is stored about users.

### ⛔ Never do
- Commit or expose any secret / API key / service-role key.
- Send the service-role key to the browser or log it.
- Re-introduce business-mode content that addresses *other businesses* instead of the
  business's own customers (the "grow your business / secret weapon for local businesses"
  framing). Business content must always speak to the end customer.
- Revert the vision model to `llama-3.2-11b-vision-preview` (decommissioned).
- Delete or bulk-rewrite `index.html` without a backup and explicit approval.
- Disable Row Level Security.

---

## 11. Runbook (common operations)

- **Deploy a fix to production:** push to `main`. Vercel auto-deploys unless the daily
  quota is spent (then wait for the ~24h reset; use the GitHub Pages mirror meanwhile).
- **Verify a change instantly without waiting on Vercel:** check the GitHub Pages mirror
  (updates in ~1–2 min) — front-end behaviour is identical; only `/api`-backed features
  differ (they use the direct-Groq fallback there).
- **Onboard a customer:** Admin panel → "Set Up Customer Account" (email + niche + mode +
  goal). Creates the account via an ephemeral Supabase client (so the admin's own session
  is untouched) with `must_set_password=true`; the customer sets their password at first
  login. `mailer_autoconfirm` means no email confirmation is needed.
- **Deliver an audit to a customer:** run the audit with the admin "Deliver to Customer
  Account" email set; the report is written to `cr_support_tickets` (category
  `audit_report`) and appears at that customer's next sign-in.
- **If AI features stop working:** check Groq status/quota first (primary), then the
  Gemini fallback, then confirm `api/chat/completions.js` env vars are set in Vercel.
- **If the Admin tab disappears:** it's an RBAC race (see §6) — the email-based reveal in
  `showDashboard` + `applyModuleVisibility` guard should prevent it; don't regress those.

---

*Maintained alongside the code. When architecture, data model, integrations, env vars, or
security rules change, update this file in the same commit.*
