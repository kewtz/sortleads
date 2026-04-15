# SortLeads.io

AI-powered lead prioritization tool for B2B sales professionals.

## Overview

SortLeads.io helps sales professionals ("Spreadsheet Steve") turn their trade show and purchased lead lists into prioritized action plans. Users upload a CSV/Excel file, describe what makes a good lead for them, and get back a prioritized spreadsheet with suggested next steps.

## Recent Changes

- **February 2026**: Homepage & Pricing Overhaul
  - Flat pricing: $0.08/lead (competitive with Clay/Apollo), down from tiered $0.12-$0.05
  - Added Pricing section to homepage with clear free tier + per-lead breakdown
  - Added "See What You Get" section showing sample scored lead output (Hot/Warm/Cold with AI reasoning)
  - Added "Who is this for?" section targeting reps promoted into sales
  - Added navigation menu with anchor links (Example, How It Works, Pricing)
  - Upload page shows pricing clearly: $0.08/lead for leads beyond free 50
  - PRICE_PER_LEAD constant exported from both client/src/lib/types.ts and shared/schema.ts

- **February 2026**: Analytics & PLG Instrumentation
  - GA4, Microsoft Clarity, PostHog analytics (env var configured, graceful when not set)
  - PLG funnel event tracking: page views, email entered, file uploaded, free tier activated, checkout started, processing started/completed, results downloaded, demo started, CTA clicked
  - Privacy policy updated to disclose all analytics providers
  - Env vars: VITE_GA4_MEASUREMENT_ID, VITE_CLARITY_PROJECT_ID, VITE_POSTHOG_API_KEY, VITE_POSTHOG_HOST

- **February 2026**: Free Tier & PLG Model
  - First 50 real leads free per email (no credit card required)
  - Email-based identity tracking (free_tier_users table in PostgreSQL)
  - Upload flow: email → file → free tier check → process or pay
  - Pricing shows billable leads only (after free tier deduction)
  - Homepage primary CTA links to /upload; demo is secondary
  - Industry social proof stats section on homepage
  - How It Works simplified to Upload → Score → Close

- **February 2026**: SEO Foundation
  - Added robots.txt, sitemap.xml for search engine crawling
  - SEO meta tags, Open Graph, Twitter Cards on all pages
  - JSON-LD structured data (SoftwareApplication schema)
  - Demo expanded to 50 sample leads, rate limit 10/day
  - CSV download enabled for demo/free tier

- **January 2026**: Security Hardening
  - Macro-enabled files (.xlsm, files with VBA) are blocked at upload
  - Expert BDR AI prompt with prompt injection resistance
  - CSV formula injection protection (prefixes dangerous characters)
  - Security warning on file downloads
  - Payment verification required (fail-closed on Stripe errors)
  - skipPayment flag blocked in production

- **January 2026**: LinkedIn & Payment Protections
  - LinkedIn profile URLs added to AI analysis and CSV exports
  - Minimum $1.00 charge to cover Stripe fees (2.9% + $0.30)
  - 100% discount coupons limited to 100 leads max to prevent abuse
  - Stripe promotion codes enabled at checkout

- **January 2026**: Bulk Actions
  - Checkbox selection in results table with select all
  - Bulk action toolbar when leads are selected
  - Export selected leads to CSV
  - Copy selected emails to clipboard

- **January 2026**: Demo Mode & Data Privacy
  - Free demo mode: try with 5 sample leads before uploading real data
  - IP-based rate limiting (3 demos per day) to prevent abuse
  - Demo results shown on-screen only (no download)
  - Enhanced privacy policy with Anthropic API guarantees (no training, 7-day retention)
  - Data protection trust badge on upload page

- **January 2026**: AI Provider Switch & Prompt Enhancement
  - Switched from OpenAI to Anthropic Claude (claude-haiku-4-5) for lead scoring
  - Added prompt enhancement feature: when user types vague prompts and tabs away, Claude suggests improvements
  - Added Privacy Policy and Terms of Service pages

- **January 2026**: Pricing & Payment Integration
  - Tiered volume pricing ($0.12/lead for small lists down to $0.05/lead for 10,000+)
  - Stripe checkout integration for one-time payments
  - Batch processing (10 leads at a time) for better performance with large lists
  - Page refresh recovery - active jobs persist in localStorage
  - CSV export with formula injection protection

- **January 2026**: Initial MVP release
  - Landing page with value proposition
  - File upload (CSV, XLS, XLSX support)
  - Prompt-based lead prioritization with AI
  - Real-time processing progress via SSE
  - Results table with Hot/Warm/Cold categorization
  - CSV download of prioritized leads

## Tech Stack

- **Frontend**: React 18, TypeScript, TanStack Query, Wouter (routing)
- **UI**: Tailwind CSS, shadcn/ui components
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL (for Stripe data sync)
- **AI**: Anthropic Claude via Replit AI Integrations (claude-haiku-4-5)
- **Payments**: Stripe (via Replit Stripe connector)
- **File Processing**: xlsx library for spreadsheet parsing

## Project Structure

```
client/
  src/
    components/
      header.tsx       # App header with navigation
      theme-toggle.tsx # Dark/light mode toggle
      ui/              # shadcn components
    pages/
      home.tsx         # Landing page with active job recovery
      upload.tsx       # File upload + prompt input + pricing
      processing.tsx   # Real-time batch processing view
      results.tsx      # Prioritized results table
    lib/
      types.ts         # TypeScript interfaces + pricing calculator
      queryClient.ts   # TanStack Query setup
server/
  routes.ts           # API endpoints
  storage.ts          # In-memory job storage
  stripeClient.ts     # Stripe API client
  webhookHandlers.ts  # Stripe webhook processing
  index.ts            # Server initialization with Stripe setup
shared/
  schema.ts           # Shared types (Lead, Job, Pricing, etc.)
```

## API Endpoints

- `POST /api/free-tier/check` - Check free tier leads remaining for an email
- `POST /api/demo` - Start demo with 50 sample leads (IP rate-limited, 10/day)
- `GET /api/demo/available` - Check if demo is available for this IP
- `POST /api/jobs` - Upload file + email + prompt, create job (free or pending payment)
- `GET /api/jobs/:id` - Get job status and results
- `POST /api/jobs/:id/start` - Start processing a paid job
- `GET /api/jobs/:id/stream` - SSE stream for real-time progress
- `GET /api/jobs/:id/download` - Download results as CSV
- `POST /api/checkout` - Create Stripe checkout session
- `GET /api/stripe/publishable-key` - Get Stripe publishable key
- `POST /api/stripe/webhook` - Stripe webhook handler

## Pricing

- First 50 leads free per email address (no credit card required)
- $0.08/lead flat rate after free tier
- $1.00 minimum per order (covers Stripe fees)

## Key Features

1. **Smart Column Detection**: Auto-detects name, email, company, title from various column naming conventions
2. **AI Analysis**: Each lead scored 1-10 with Hot/Warm/Cold labels and suggested actions
3. **Batch Processing**: Processes 10 leads at a time for efficiency with large lists
4. **Real-time Updates**: SSE streaming shows batch progress live
5. **CSV Export**: Download enriched spreadsheet with priority scores (formula injection protected)
6. **Page Refresh Recovery**: Active jobs persist across page refreshes
7. **Stripe Payments**: One-time payment before processing begins

## Development

The app runs on port 5000. Start with:

```bash
npm run dev
```

For testing without payment, add `skipPayment=true` to the job creation request.

## User Preferences

- Clean, professional B2B aesthetic
- Blue/teal primary colors for trust
- Non-technical UX for sales professionals

## Pending Features

- **Email Results**: Email service integration was dismissed. To add later, set up Resend or SendGrid connector and add email collection during upload.
