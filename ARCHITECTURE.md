# SortLeads — Project Documentation

> **Audience:** Engineers joining the project. This doc explains what SortLeads is, how it's built, where it runs, and how the pieces fit together.

---

## 1. What SortLeads Is

SortLeads is an **AI-powered lead prioritization tool** for B2B sales teams at manufacturing and industrial companies.

### The user problem
A sales rep comes back from a trade show with a CSV of leads. They need to know which ones to call first. Sorting manually is slow and subjective.

### What the product does
1. User signs in (Supabase Auth — email + password).
2. Uploads a CSV or Excel file of leads.
3. Describes their ideal customer in plain English.
4. The backend batches leads (10 per API call) and sends them to Claude Haiku 4.5 for scoring.
5. Results stream live to the browser via SSE — Hot leads appear within ~20 seconds.
6. User downloads a prioritized CSV with scores, reasoning, and suggested actions per lead.

### Business model
- **Free tier:** First 50 leads per authenticated user, no credit card required.
- **Paid tiers (annual subscriptions via Stripe Checkout):**

| Plan | Price | Leads/month |
|------|-------|-------------|
| Essentials | $948/yr ($79/mo) | 500 |
| Professional | $1,788/yr ($149/mo) | 2,000 |
| Portfolio | $4,188/yr ($349/mo) | Unlimited + multi-user org |

- Portfolio subscribers get an admin dashboard to invite team members, monitor usage, and manage the org.

---

## 2. Platform Stack

| Service | Purpose | URL |
|---------|---------|-----|
| **Vercel** | React frontend (static + CDN) | `sortleads.vercel.app` / `sortleads.io` |
| **Railway** | Express API server | `sortleads-production.up.railway.app` |
| **Supabase** | PostgreSQL + Auth (email/password) | Project ref: `xtbtvkzgauxtrdepimgo` |
| **Anthropic** | Claude Haiku 4.5 for lead scoring | API only |
| **Stripe** | Subscription checkout + webhooks | API only |
| **GitHub** | Source control, auto-deploys | `github.com/kewtz/sortleads` |

### Why this split?
- **Vercel** for static site delivery + CDN edge. **Railway** for long-lived processes (SSE streaming during AI scoring can run 1–2 min).
- **Supabase** provides both the Postgres DB and the Auth system (JWT tokens, email confirmation, password reset) — no separate auth service needed.
- Frontend and backend are on **different domains** → CORS is configured in `server/index.ts`.

---

## 3. Architecture

```
 ┌──────────────┐     ┌───────────────────┐
 │  Browser     │     │  Stripe           │
 │ sortleads.io │     │  (subscriptions)  │
 └──────┬───────┘     └────────┬──────────┘
        │ 1. SPA                │ 5. Webhook
        ▼                       ▼
 ┌──────────────┐     ┌───────────────────┐
 │   Vercel     │     │    Railway        │
 │ (React app)  │────▶│  (Express API)    │
 └──────────────┘     └──┬─────────┬──────┘
   /api/* proxy           │         │
                    3. DB │         │ 4. AI
                          ▼         ▼
                   ┌──────────┐ ┌──────────┐
                   │ Supabase │ │Anthropic │
                   │ Postgres │ │ Haiku    │
                   │  + Auth  │ └──────────┘
                   └──────────┘
```

### Key flows

**Sign up → Upload → Score → Download:**
1. User signs up at `/auth` → Supabase creates account + sends confirmation email.
2. After confirmation, user signs in → gets a JWT.
3. User uploads a file at `/upload` → frontend sends `POST /api/jobs` with `Authorization: Bearer <jwt>`.
4. Backend validates JWT (`optionalAuth` middleware), checks free-tier/subscription status, parses file, creates a job row in Postgres.
5. If within free tier or subscribed → processing starts immediately. If over limit → redirected to `/#pricing`.
6. `analyzeLeadsBatch()` sends 10 leads per Claude call. Results stream to the browser via SSE on `/api/jobs/:id/stream`.
7. Each batch result is atomically appended to the `jobs.results` jsonb column.
8. User downloads CSV from `/api/jobs/:id/download`, or retrieves past results from `/history`.

**Subscription checkout:**
1. User clicks "Get started" on a pricing tier → if not signed in, redirects to `/auth`.
2. After sign-in → `POST /api/checkout` with `{ tier }` + Bearer token.
3. Backend creates a Stripe subscription checkout session with user_id in metadata.
4. Stripe redirects to `/upload?subscribed=true` on success.
5. Webhook (`checkout.session.completed`) writes to `checkout_sessions` table. If Portfolio tier → auto-creates an org + admin membership.

**Portfolio org invite:**
1. Admin visits `/admin` → creates an invite link (`/invite/{token}`, expires in 7 days).
2. Shares the link (Slack, email, etc.).
3. Invitee clicks → redirected to `/auth` if not signed in → after sign-in, auto-accepted into the org.
4. Org members inherit the Portfolio subscription — unlimited leads, no individual payment.

---

## 4. Database Schema

Six tables in Supabase (defined in `shared/schema.ts`, pushed via `drizzle-kit push`):

| Table | Purpose |
|-------|---------|
| `free_tier_users` | Tracks free lead usage per email + user_id |
| `checkout_sessions` | Stripe payment records (subscription or one-time) |
| `jobs` | All uploaded jobs — metadata + `leads` jsonb (input) + `results` jsonb (scored output) |
| `organizations` | Portfolio orgs — name, owner_id, tier |
| `org_members` | Org membership — user_id, role (admin/member), leads_used counter |
| `org_invites` | Pending invite tokens with expiry |

### Key columns on `jobs`
- `leads`: jsonb — the input Lead[] from the uploaded file
- `results`: jsonb — the scored ProcessedLead[] (appended atomically via `results || $1::jsonb`)
- `user_id`: text — links job to the authenticated user
- `status`: pending → processing → completed / failed

---

## 5. Repository Layout

```
sortleads-export/
├── client/
│   ├── index.html                 HTML shell + meta tags + OG image
│   ├── public/                    Static assets (favicon, og-image, robots, sitemap)
│   └── src/
│       ├── main.tsx               React entry point
│       ├── App.tsx                Router + AuthProvider + RequireAuth wrapper
│       ├── context/
│       │   └── AuthContext.tsx     Supabase Auth state (session, user, signIn/Out)
│       ├── lib/
│       │   ├── supabase.ts        Supabase client init (VITE_SUPABASE_URL/ANON_KEY)
│       │   ├── analytics.ts       GA4, PostHog, Clarity
│       │   ├── queryClient.ts     TanStack Query
│       │   ├── types.ts           Shared TS types + FREE_TIER_LEAD_LIMIT
│       │   └── utils.ts
│       ├── components/
│       │   ├── header.tsx         Nav bar (auth-aware: Sign in / email + Sort My Leads)
│       │   ├── theme-toggle.tsx
│       │   └── ui/                shadcn/ui components
│       └── pages/
│           ├── home.tsx           Landing page (tier pricing, demo, About link)
│           ├── auth.tsx           Sign in / Sign up / Reset password
│           ├── auth-callback.tsx  Supabase email confirmation handler
│           ├── upload.tsx         File upload (auth-required, shows subscription status)
│           ├── processing.tsx     Live SSE results table during scoring
│           ├── results.tsx        Full results + download + bulk actions
│           ├── history.tsx        Past uploads list (auth-required)
│           ├── admin.tsx          Portfolio org dashboard (admin-only)
│           ├── invite.tsx         Org invite acceptance
│           ├── about.tsx          Founder / practitioner page
│           ├── privacy.tsx        Privacy policy
│           ├── terms.tsx          Terms of service
│           └── not-found.tsx
│
├── server/
│   ├── index.ts                   Express app: CORS, webhook route, JSON middleware
│   ├── auth.ts                    requireAuth + optionalAuth Express middleware
│   ├── routes.ts                  All API endpoints (~1100 lines)
│   ├── storage.ts                 DbStorage class (Postgres-backed job + org CRUD)
│   ├── stripeClient.ts            Stripe SDK init from env vars
│   ├── webhookHandlers.ts         Stripe webhook: checkout_sessions + auto-create org
│   ├── static.ts                  Serves built frontend in production
│   └── vite.ts                    Vite dev server (development only)
│
├── shared/
│   └── schema.ts                  Drizzle pgTable definitions + Zod schemas
│
├── script/
│   ├── build.ts                   Vite (client) + esbuild (server → ESM bundle)
│   └── test-supabase.ts           DB connection verification
│
├── vercel.json                    /api/* rewrite to Railway + SPA fallback
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
├── package.json
└── ARCHITECTURE.md                (this file)
```

---

## 6. Environment Variables

### Railway (backend)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase pooler: `postgresql://postgres.<ref>:<pw>@aws-1-us-east-2.pooler.supabase.com:6543/postgres` |
| `ANTHROPIC_API_KEY` | Claude API key (`sk-ant-...`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) |
| `STRIPE_PRICE_ESSENTIALS` | Stripe Price ID for Essentials tier |
| `STRIPE_PRICE_PROFESSIONAL` | Stripe Price ID for Professional tier |
| `STRIPE_PRICE_PORTFOLIO` | Stripe Price ID for Portfolio tier |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side JWT validation) |
| `PORT` | Set by Railway automatically |
| `NODE_ENV` | `production` |

### Vercel (frontend)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Same as backend `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe for browser) |
| `VITE_GA4_MEASUREMENT_ID` | Google Analytics (optional) |
| `VITE_POSTHOG_API_KEY` | PostHog analytics (optional) |
| `VITE_CLARITY_PROJECT_ID` | Microsoft Clarity (optional) |

---

## 7. API Endpoints

### Public
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/demo/available` | Check demo rate limit (IP-based) |
| POST | `/api/demo` | Start a 50-lead demo job |
| GET | `/api/org/invite/:token` | Get invite details (org name) |

### optionalAuth (works with or without JWT)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/free-tier/check` | Check free lead allowance |
| POST | `/api/jobs` | Upload file + create job |

### requireAuth (JWT required)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/jobs` | List user's jobs (metadata only) |
| POST | `/api/jobs/:id/cancel` | Cancel pending/processing job |
| POST | `/api/checkout` | Create Stripe subscription checkout |
| GET | `/api/org` | Get user's org |
| GET | `/api/org/members` | List org members (admin) |
| POST | `/api/org/invite` | Create invite link (admin) |
| GET | `/api/org/invites` | List pending invites (admin) |
| DELETE | `/api/org/invites/:id` | Revoke invite (admin) |
| POST | `/api/org/invite/:token/accept` | Accept invite |
| DELETE | `/api/org/members/:userId` | Remove member (admin) |

### No auth (public or SSE)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/jobs/:id` | Get job status + results |
| GET | `/api/jobs/:id/stream` | SSE real-time progress |
| GET | `/api/jobs/:id/download` | Download CSV |
| POST | `/api/stripe/webhook` | Stripe webhook (raw body) |
| POST | `/api/enhance-prompt` | AI prompt expansion |
| GET | `/api/stripe/publishable-key` | Stripe public key |

---

## 8. AI Scoring Pipeline

### Key parameters (all in `server/routes.ts`)
| Parameter | Value | Notes |
|-----------|-------|-------|
| Model | `claude-haiku-4-5` | Cost-optimized, fast |
| Batch size | 10 leads/call | 44 leads = 5 API calls |
| Concurrency | `pLimit(3)` | Module-level cap |
| Retries | 5 | p-retry on 429/529 only |
| Min backoff | 12s | Covers 10-13s retry-after |
| Max tokens | `max(500, N * 300)` | Scales with batch size |
| SDK retries | 0 | Disabled — p-retry handles it |

### Prompt architecture
The system prompt is a detailed senior-BDR-coach persona that:
- Expands vague ICPs into full qualification frameworks before scoring
- Reads company name patterns, title authority levels, PE/timing signals
- Calibrates conservatively ("Hot = rep calls first thing Monday morning")
- Generates specific, personalized suggested actions (not generic "follow up")
- Resists prompt injection in lead data fields

### Performance (44-lead benchmark)
| Metric | Value |
|--------|-------|
| Total time | ~75-105s |
| Success rate | 100% (0 failures) |
| First results visible | ~17s |
| API calls | 5 (10 leads each) |

---

## 9. Authentication

### Stack
- **Supabase Auth** — email + password, JWT tokens
- **Backend middleware:** `server/auth.ts` — `requireAuth` (401 if no token) and `optionalAuth` (proceeds either way)
- **Frontend context:** `client/src/context/AuthContext.tsx` — session, user, signIn/signUp/signOut/resetPassword
- **Route protection:** `RequireAuth` wrapper in `App.tsx` for `/upload`, `/history`, `/admin`

### Flow
1. User signs up → Supabase sends confirmation email.
2. User clicks confirm link → lands on `/auth/callback` → redirected to `/upload`.
3. All authenticated API calls include `Authorization: Bearer <access_token>`.
4. Backend validates via `supabase.auth.getUser(token)` using the service role key.
5. Sign-out clears the session client-side.

### Free tier tracking
- **Authenticated users:** tracked by `user_id` in `free_tier_users`. New auth users get a fresh 50-lead allowance even if their email was used before auth existed.
- **Unauthenticated users (demo only):** tracked by email.

---

## 10. Build System

### esbuild (server)
- **Output format:** ESM (`dist/index.mjs`) — required for ESM-only deps (p-limit, p-retry)
- **Banner shims:** `createRequire`, `__dirname`, `__filename` injected for CJS compat
- **Bundled deps** (in allowlist): `@supabase/supabase-js`, `p-limit`, `p-retry`, `stripe`, `express`, `pg`, `multer`, `xlsx`, `zod`, and others
- **External deps:** everything NOT in the allowlist — must be in `node_modules` at runtime
- Start command: `node dist/index.mjs`

### Vite (client)
- Output: `dist/public/` (static files)
- Aliases: `@` → `client/src`, `@shared` → `shared/`, `@assets` → `attached_assets/`

### Common Railway deploy issue
If a new dependency is added but Railway caches the old `npm ci`, the container will crash with a module-not-found error. Fix: add the dep to the allowlist in `script/build.ts` so it gets bundled and has no runtime dependency.

---

## 11. Remaining Work

### Active
- [ ] **Supabase email templates** — confirmation + password reset emails use Supabase defaults (ugly). Customize in Supabase Dashboard → Authentication → Email Templates.
- [ ] **Stripe webhook registration** — register `https://sortleads-production.up.railway.app/api/stripe/webhook` in Stripe Dashboard for `checkout.session.completed`.
- [ ] **Per-member lead quotas** — schema has `lead_quota` on `org_members` but not yet enforced. Admin can see usage but can't cap individual members.
- [ ] **Custom domain** — `sortleads.io` → Vercel DNS not yet confirmed.

### Future
- [ ] Transactional email via Resend (receipts, invite notifications)
- [ ] On-startup recovery of orphaned `status='processing'` jobs
- [ ] Demo rate limiting persisted to DB (currently in-memory, resets on deploy)
- [ ] Code-split the frontend bundle (currently ~900KB minified)
- [ ] Automated tests
- [ ] Staging environment

---

## 12. Troubleshooting

### Railway "Container failed to start"
Build succeeds but runtime crashes. Most common cause: a dependency is external (not in the esbuild allowlist) and Railway's cached `node_modules` doesn't have it. Fix: add the package to the allowlist in `script/build.ts`.

### DATABASE_URL issues
1. Password must be URL-encoded (`#` → `%23`, `^` → `%5E`, `*` → `%2A`)
2. Hostname is `aws-1-us-east-2` (not `aws-0`)
3. Port `6543` (shared pooler). Direct DB is IPv6-only from this Supabase project.
4. If `DATABASE_URL` is empty/undefined, `pg` falls back to `localhost:5432` → `ECONNREFUSED` loop

### Auth token issues
- Backend returns 401 "Authentication required" → check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set on Railway
- Frontend redirects to `/auth` unexpectedly → session expired, user needs to sign in again
- After Supabase email confirmation, user lands on wrong page → check `Authentication → URL Configuration → Redirect URLs` includes your domain + `/auth/callback`

### Scoring failures show "Analysis error: ..."
This is intentional — the system surfaces real Anthropic errors (rate limits, JSON parse failures) in the lead's reasoning field rather than hiding them behind a fake priority=5/"Warm" fallback. If you see 429 errors, the org's Anthropic RPM limit may need upgrading.

### Stripe checkout returns 401
`/api/checkout` requires auth (`requireAuth`). If the user isn't signed in, the pricing page redirects to `/auth` first. If they're signed in but the token is expired, they'll get 401 — sign out and back in.

---

## 13. Useful Links

| Resource | URL |
|----------|-----|
| Production frontend | https://sortleads.vercel.app |
| Production backend | https://sortleads-production.up.railway.app |
| GitHub repo | https://github.com/kewtz/sortleads |
| Supabase dashboard | https://supabase.com/dashboard/project/xtbtvkzgauxtrdepimgo |
| Railway dashboard | https://railway.app |
| Vercel dashboard | https://vercel.com/dashboard |
| Stripe dashboard | https://dashboard.stripe.com |
| Anthropic console | https://console.anthropic.com |

---

*Last updated: 2026-04-17*
