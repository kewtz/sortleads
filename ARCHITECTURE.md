# SortLeads — Project Documentation

> **Audience:** Junior to mid-level engineers joining the project. This doc explains what SortLeads is, how it's built, where it runs, and what state the migration is in.

---

## 1. What SortLeads Is

SortLeads is an **AI-powered lead prioritization tool** for B2B sales teams — specifically aimed at industrial and manufacturing companies.

### The user problem
A sales rep (we call the persona "Spreadsheet Steve") comes back from a trade show with a CSV of a few hundred leads. They need to know which ones to call first. Manually scanning the list is slow and subjective.

### What the product does
1. User uploads a CSV or Excel file of leads.
2. User writes a plain-English description of their ideal customer (e.g., "Mid-size manufacturers in the Midwest evaluating CRM software").
3. The backend sends each lead to Anthropic's Claude AI with that description as context.
4. Claude returns a priority score (1–10), a Hot/Warm/Cold label, reasoning, and a suggested next action for every lead.
5. User downloads a prioritized CSV, sorted with Hot leads at the top.

### Business model
- **Free tier:** First 50 leads per email address are free, no credit card required.
- **Paid:** Flat $0.08/lead after the free allowance. Minimum charge $1.00 (covers Stripe processing fees).
- **Payment:** Stripe Checkout (one-time payment, not subscription).

---

## 2. Current Status

The project was originally built on **Replit**. It was recently migrated off Replit onto a production stack. Migration is in phases:

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Decouple code from Replit-specific APIs and packages | Done |
| 2 | Move database to Supabase, push schema | Done |
| 3 | Deploy backend to Railway, deploy frontend to Vercel | Done |
| 4 | Production hardening: auth, persistent job storage, email | Not started |

**Known open items** (see Section 10 for details):
- Supabase DB connection from Railway needs final verification after password rotation.
- No user authentication — anyone can upload and process leads.
- Jobs are stored in-memory on the backend, so they're lost if the Railway service restarts.
- Stripe webhook endpoint needs to be registered in the Stripe Dashboard.

---

## 3. Platform Stack

Each external service has one clear job. Do not confuse them.

| Service | Purpose | Hosted URL |
|---------|---------|------------|
| **Vercel** | Hosts the React frontend (static files + CDN). Serves the UI a user interacts with. | `sortleads.vercel.app` (and eventually `sortleads.io`) |
| **Railway** | Hosts the Node.js/Express backend (API server). Runs the AI processing, file parsing, Stripe calls. | `sortleads-production.up.railway.app` |
| **Supabase** | Managed PostgreSQL database. Stores free tier usage and payment records. | Project ref: `xtbtvkzgauxtrdepimgo` |
| **Anthropic** | AI model provider. We use `claude-haiku-4-5` for lead scoring. | API only |
| **Stripe** | Payment processing. Checkout sessions + webhooks for payment confirmation. | API only |
| **GitHub** | Source control. Railway auto-deploys from `main`. | `github.com/kewtz/sortleads` |
| **Resend** *(planned, not yet integrated)* | Transactional email (receipts, free tier welcome). | Not yet deployed |

### Why this split?
- **Frontend on Vercel, backend on Railway** — Vercel is optimized for static sites and edge delivery. Railway runs long-lived Node processes well (which we need for Server-Sent Events during AI processing).
- **Database on Supabase** — managed Postgres with a generous free tier and built-in auth (which we'll use in Phase 4).
- The frontend and backend are on **different domains**, which means CORS must be configured on the backend (it is — see `server/index.ts`).

---

## 4. Architecture Overview

```
 ┌─────────────────┐        ┌──────────────────────┐
 │   User Browser  │        │     Stripe API       │
 │  (sortleads.io) │        └──────────────────────┘
 └────────┬────────┘                   ▲
          │ 1. Loads UI                 │ 4. Creates checkout
          ▼                             │    session, sends
 ┌─────────────────┐                    │    webhook
 │     Vercel      │                    │
 │ (React frontend)│                    │
 └────────┬────────┘                    │
          │ 2. API calls                │
          │ (relative /api/*, proxied)  │
          ▼                             │
 ┌─────────────────┐      3. Calls      │
 │    Railway      │ ─────────────────► │
 │ (Express API)   │ ─────┐             │
 └────────┬────────┘      │             │
          │ 5. Reads/     │ 6. Scores   │
          │  writes       │  leads      │
          ▼               ▼             │
 ┌─────────────────┐  ┌──────────┐     │
 │    Supabase     │  │Anthropic │     │
 │   (Postgres)    │  │ Claude   │     │
 └─────────────────┘  └──────────┘     │
          ▲                             │
          └─────────────────────────────┘
                  7. Webhook writes
                     payment record
```

### How a request flows (concrete example: a paid job)
1. User visits the site → Vercel serves the React app.
2. User uploads `leads.csv` and types an ICP description → frontend `POST /api/jobs` to Railway (via Vercel rewrite).
3. Railway parses the file, checks free tier usage (Supabase query), reserves free leads atomically, returns a `jobId` and a pricing quote.
4. Frontend calls `POST /api/checkout` → Railway creates a Stripe Checkout session and returns a URL.
5. User enters card details on Stripe's hosted page → Stripe charges the card.
6. Stripe redirects back to `/processing/{jobId}?paid=true`, and in parallel calls our webhook at `/api/stripe/webhook` → Railway verifies the signature and writes a row to `checkout_sessions` in Supabase.
7. Frontend calls `POST /api/jobs/{id}/start` → Railway verifies the Stripe session status, then begins AI processing.
8. Railway processes leads in batches of 10, sending each to Claude. Progress is streamed back via Server-Sent Events (`GET /api/jobs/{id}/stream`).
9. When complete, the user downloads the sorted CSV from `GET /api/jobs/{id}/download`.

---

## 5. Repository Layout

```
sortleads-export/
├── client/                    React frontend (built by Vite)
│   ├── index.html             HTML shell + analytics tags
│   ├── public/                Static assets (favicon, robots.txt, sitemap.xml)
│   └── src/
│       ├── main.tsx           React entry point
│       ├── App.tsx            Router setup (uses wouter)
│       ├── index.css          Global styles (Tailwind)
│       ├── components/
│       │   ├── header.tsx
│       │   ├── theme-toggle.tsx
│       │   └── ui/            shadcn/ui components (~56 files)
│       ├── pages/
│       │   ├── home.tsx
│       │   ├── upload.tsx
│       │   ├── processing.tsx
│       │   ├── results.tsx
│       │   ├── privacy.tsx
│       │   ├── terms.tsx
│       │   └── not-found.tsx
│       ├── hooks/             Custom React hooks
│       └── lib/
│           ├── analytics.ts   GA4, PostHog, Clarity wrappers
│           ├── queryClient.ts TanStack Query config
│           ├── types.ts       Shared TypeScript types
│           └── utils.ts
│
├── server/                    Express backend
│   ├── index.ts               App entry: middleware, CORS, webhook, listen
│   ├── routes.ts              All API endpoints (~890 lines)
│   ├── storage.ts             Job state (in-memory) + Supabase free tier queries
│   ├── stripeClient.ts        Stripe SDK initialization
│   ├── webhookHandlers.ts     Stripe webhook signature verification + DB write
│   ├── static.ts              Serves built frontend in production
│   └── vite.ts                Vite dev server integration (dev only)
│
├── shared/
│   └── schema.ts              Zod schemas + Drizzle pgTable definitions
│                              (shared between client and server)
│
├── script/
│   ├── build.ts               Custom build script (vite + esbuild for server)
│   └── test-supabase.ts       Standalone DB connection test
│
├── drizzle.config.ts          Drizzle ORM config (for migrations)
├── vite.config.ts             Vite frontend config
├── tailwind.config.ts         Tailwind theme
├── tsconfig.json
├── package.json
└── ARCHITECTURE.md            (this file)
```

### Key design points
- **Shared schema:** `shared/schema.ts` is imported by both `client/` and `server/` so request/response shapes stay in sync. It also holds the Drizzle `pgTable` declarations used to generate migrations.
- **Relative API URLs:** The frontend always calls `/api/...` (never an absolute URL). In production, Vercel rewrites these to the Railway backend. This makes it easy to run everything locally on one port.
- **No auth code:** Despite `passport` being in old dependency lists, there is currently no login or user accounts. This is a Phase 4 item.

---

## 6. Tech Stack (Dependencies)

### Frontend
- **React 18** + **TypeScript 5.6** — UI framework and type system
- **Vite 7** — dev server and production bundler
- **Wouter** — a tiny client-side router (not React Router)
- **TanStack Query** — data fetching and caching
- **shadcn/ui + Radix** — accessible component primitives
- **Tailwind CSS** — utility-first styling
- **xlsx** — client-side Excel/CSV parsing before upload

### Backend
- **Express 5** — HTTP server framework
- **Anthropic SDK** — calls Claude Haiku 4.5
- **Stripe SDK** — payment processing
- **pg** — PostgreSQL client (raw queries for free tier)
- **Drizzle ORM** — used only for schema/migrations, not queries (yet)
- **multer** — multipart file uploads
- **p-limit, p-retry** — batch processing with rate-limit handling

### Shared
- **Zod** — runtime validation for request/response data

---

## 7. Environment Variables

These are set in the respective platform's dashboard (Vercel for frontend, Railway for backend). They are **not** committed to the repo.

### Backend (Railway)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Supabase pooler connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key (starts with `sk-ant-...`) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (`pk_test_...` or `pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret (`whsec_...`) |
| `NODE_ENV` | Yes | `production` on Railway |
| `PORT` | Auto | Railway sets this automatically |

**The correct DATABASE_URL format** is Supabase's shared pooler:
```
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```
Any special characters in the password (`#`, `^`, `*`, `@`, `/`, `:`, `?`, `&`) must be URL-encoded.

### Frontend (Vercel)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_GA4_MEASUREMENT_ID` | Optional | Google Analytics 4 ID |
| `VITE_POSTHOG_API_KEY` | Optional | PostHog product analytics |
| `VITE_POSTHOG_HOST` | Optional | Defaults to `https://us.i.posthog.com` |
| `VITE_CLARITY_PROJECT_ID` | Optional | Microsoft Clarity session replay |

The `VITE_` prefix is required — Vite only exposes variables with that prefix to the browser.

---

## 8. Running Locally

### Prerequisites
- Node.js 20+
- npm
- A copy of the environment variables in a `.env` file at the project root (not committed)

### Commands

```bash
# Install dependencies
npm install

# Start the dev server (frontend + backend on port 5000)
npm run dev

# Type-check without building
npm run check

# Production build
npm run build

# Run the production build locally
npm start

# Push schema changes to Supabase
DATABASE_URL="..." npm run db:push

# Verify Supabase connection works
DATABASE_URL="..." npx tsx script/test-supabase.ts
```

### How the dev server works
`npm run dev` runs `tsx server/index.ts`, which:
1. Starts the Express server on port 5000.
2. Mounts Vite as middleware (via `server/vite.ts`) — this means HMR-enabled React and API requests are served from the **same port**, identical to production. No CORS issues locally.

---

## 9. Deployment Workflow

```
Developer pushes to main
          │
          ▼
┌────────────────────┐        ┌────────────────────┐
│      GitHub        │───────►│     Railway        │
│  (github.com/      │        │  Rebuilds server   │
│   kewtz/sortleads) │        │  Restarts service  │
└────────────────────┘        └────────────────────┘
          │
          ▼
┌────────────────────┐
│      Vercel        │
│  Rebuilds frontend │
│  Invalidates CDN   │
└────────────────────┘
```

Both Railway and Vercel are connected to the GitHub repo and auto-deploy on push to `main`. There is no staging environment yet — every commit to `main` goes to production.

### Build commands
- **Vercel (frontend):** `npx vite build`. Outputs to `dist/public/`.
- **Railway (backend):** `npm run build`, which runs `script/build.ts`. Outputs to `dist/index.cjs`.
- **Railway start:** `npm start` → `node dist/index.cjs`.

### CORS
The backend allows requests from:
- `https://sortleads.io`
- `https://www.sortleads.io`
- `https://sortleads-production.up.railway.app`
- Any `*.vercel.app` subdomain (for preview deployments)
- `localhost:5173` and `localhost:5000` (development only)

CORS config lives in `server/index.ts`. Update it if the production domain changes.

---

## 10. Migration History (Why Some Things Look Odd)

This project used to run on **Replit** and relied on Replit-specific APIs (`@replit/*` packages, `stripe-replit-sync`, Replit Connectors for managing Stripe credentials, Replit AI Integrations for proxying Anthropic calls). All of that has been removed.

### What changed in Phase 1
- `server/stripeClient.ts` was rewritten to use `STRIPE_SECRET_KEY` directly instead of fetching credentials from the Replit Connectors API.
- `server/webhookHandlers.ts` was rewritten to use `stripe.webhooks.constructEvent()` with a `STRIPE_WEBHOOK_SECRET` rather than delegating to `stripe-replit-sync`.
- `server/index.ts` lost its startup calls to `runMigrations()`, `findOrCreateManagedWebhook()`, and `syncBackfill()`.
- `server/routes.ts` Anthropic client now reads `ANTHROPIC_API_KEY` directly (not `AI_INTEGRATIONS_ANTHROPIC_API_KEY`).
- `vite.config.ts` dropped `@replit/vite-plugin-*` imports.
- Deleted directories: `server/replit_integrations/`, `client/replit_integrations/`, `.local/`.
- Deleted packages: `stripe-replit-sync`, all `@replit/*` plugins, plus unused dependencies (`passport`, `passport-local`, `express-session`, `connect-pg-simple`, `memorystore`, `openai`).

### What changed in Phase 2
- Added Drizzle table definitions for `free_tier_users` and `checkout_sessions` in `shared/schema.ts`.
- Pushed schema to Supabase with `drizzle-kit push`.
- The webhook handler now writes completed checkout sessions to the `checkout_sessions` table.

### What changed in Phase 3
- Added CORS middleware to `server/index.ts` for the new cross-origin setup.
- Fixed the `prioritized-{fileName}.csv.csv` double-extension bug.

### Legacy files you may still see
- `replit.md` — still in the repo as documentation, but no longer authoritative. This file (`ARCHITECTURE.md`) supersedes it.
- `attached_assets/` — contains old pasted code snippets and strategy docs. Not used by the build.

---

## 11. Remaining Work

### P0 (blocks real users)
- **Supabase connection from Railway:** After the recent DB password rotation, the free-tier endpoint returns 500. Re-verify the password is URL-encoded correctly in Railway's `DATABASE_URL` variable.
- **Stripe webhook endpoint:** Register `https://sortleads-production.up.railway.app/api/stripe/webhook` in Stripe Dashboard → Developers → Webhooks. Listen for `checkout.session.completed` at minimum.

### P1 (Phase 4 production hardening)
- **Authentication:** No auth exists. Anyone can upload files. Free tier tracking by email is unverified. Add Supabase Auth.
- **Persistent job storage:** Jobs live in an in-memory `Map` on the backend. If Railway restarts mid-process, in-flight jobs are lost. Move to Supabase tables.
- **Transactional email:** Add Resend for payment receipts, free tier welcome, and job completion notifications.
- **Bundle size:** Frontend JS is 680KB minified (221KB gzipped). Code-split with dynamic imports to reduce initial load.

### P2 (nice-to-have)
- Replace in-memory IP rate limit for `/api/demo` with a Supabase-backed counter (survives restarts, works across multiple Railway instances).
- Add a proper staging environment.
- Add automated tests (there are none).

---

## 12. Troubleshooting & Gotchas

### "Failed to check free tier status" (HTTP 500 from `/api/free-tier/check`)
Almost always a `DATABASE_URL` problem. Checklist:
1. Is the password URL-encoded? Special characters like `#`, `^`, `*` must be percent-encoded.
2. Is the hostname `aws-1-us-east-2.pooler.supabase.com`? (Note: `aws-1`, not `aws-0`.)
3. Is the port `6543`? (Transaction mode pooler. Session mode on 5432 also works but is typically used for migrations.)
4. Is the user `postgres.<PROJECT_REF>` format (required for the shared pooler)?
5. Is the Supabase project active and not paused?

Run `npx tsx script/test-supabase.ts` locally with the suspected `DATABASE_URL` to isolate the issue.

### Stripe checkout returns 500
Check `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` on Railway. They must start with `sk_` and `pk_` respectively. A non-standard prefix (e.g., `mk_`) indicates an old Replit-connector value that was never replaced.

### SSE (Server-Sent Events) drops on Vercel
SSE is used on the processing page to stream progress. The backend supports it, but **Vercel serverless functions have a duration limit**. Since our backend is on **Railway** (long-running Node process), SSE works fine — but this will break if anyone tries to move the backend to Vercel functions.

### Stripe webhook gets HTTP 400
The webhook route must be registered **before** `express.json()` middleware — otherwise the request body gets parsed and the signature verification fails (it needs the raw buffer). This is enforced in `server/index.ts`.

### Frontend env vars not picked up
Vite only exposes variables prefixed with `VITE_` to the browser. If a variable is missing, check it's set in Vercel with the correct prefix, and that the build was redeployed after the variable was added.

### Live Stripe keys in production
Verify intent before sharing the URL publicly. Live keys charge real cards. Use `sk_test_...` / `pk_test_...` when developing or demoing.

---

## 13. Useful Links

| Thing | Where |
|-------|-------|
| Production frontend | https://sortleads.vercel.app |
| Production backend | https://sortleads-production.up.railway.app |
| GitHub repo | https://github.com/kewtz/sortleads |
| Supabase dashboard | https://supabase.com/dashboard/project/xtbtvkzgauxtrdepimgo |
| Railway dashboard | https://railway.app |
| Vercel dashboard | https://vercel.com/dashboard |
| Stripe dashboard | https://dashboard.stripe.com |
| Anthropic console | https://console.anthropic.com |

---

*Last updated: 2026-04-16*
