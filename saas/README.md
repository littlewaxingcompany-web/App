# SalonStream SaaS

Next.js + PostgreSQL multi-tenant application for SalonStream. This is the
productized evolution of the standalone bridge: it receives booking emails via
an Inbound Email API (Postmark/Mailgun), parses them with the shared
`EmailParser`, persists bookings, and sends WhatsApp messages directly through
WhatChimp.

## Stack

- **Next.js (Pages Router)** — combined frontend/backend
- **PostgreSQL** — provider-agnostic via a single `DATABASE_URL` (works on
  Supabase Postgres, Neon, or any Postgres host)
- **WhatChimp** — direct WhatsApp messaging (no Zapier)

## Database Strategy

The data layer (`lib/db.js`) talks to one `DATABASE_URL` connection string via
`pg`, so it is **provider-agnostic**. The owner is UK-based and cannot use
Tiger Cloud — Supabase (per the business plan) or Neon both work by setting
`DATABASE_URL` to their Postgres connection string.

- If `DATABASE_URL` is missing, the app degrades gracefully: API routes return
  a clean `503` and booking processing is skipped, rather than crashing.
- `schema.sql` is plain PostgreSQL (no Supabase-specific hard dependencies).
  Optional Supabase Auth RLS policies are provided in a commented section at
  the bottom for when Supabase Auth is enabled.

## Directory Structure

```
saas/
├── pages/
│   ├── index.js             # marketing landing page
│   ├── dashboard.js         # bookings dashboard (scaffold)
│   ├── _app.js
│   └── api/
│       ├── health.js        # GET  liveness probe
│       ├── inbound-email.js # POST Postmark/Mailgun webhook → parse → send
│       └── bookings.js      # GET  list bookings
├── components/
│   ├── Layout.js
│   └── BookingCard.js
├── hooks/
│   ├── useAuth.js           # Supabase Auth session (optional, client-side)
│   └── useBookings.js       # fetch bookings
├── lib/
│   ├── db.js                # provider-agnostic Postgres client (DATABASE_URL)
│   ├── email-parser.js      # shared booking-email parser (from bridge)
│   ├── inbound-email.js     # Postmark/Mailgun normalizers
│   ├── booking-service.js   # parse → persist → send → log pipeline
│   └── whatchimp-client.js  # direct WhatsApp API client
├── schema.sql               # users, salons, bookings, logs (+ optional RLS)
└── .env.example
```

## Getting Started

```bash
cd saas
npm install
cp .env.example .env.local   # fill in DATABASE_URL + WhatChimp values
npm run dev
```

Create the schema by running `schema.sql` against your Postgres database
(Supabase SQL editor or `psql "$DATABASE_URL" -f schema.sql`).

`NEXT_PUBLIC_WHATSAPP_CONNECT_URL` controls the page the "Connect WhatsApp"
button opens during onboarding and on the dashboard. The legacy name
`NEXT_PUBLIC_WHATCHIMP_CONNECT_URL` is deprecated but still honoured as a
fallback.

## Inbound Email Flow

1. Point a Postmark or Mailgun inbound route at `POST /api/inbound-email?salon_id=<id>`.
2. The route normalizes the payload, filters by the salon's `email_filter_sender`,
   and parses booking fields.
3. The booking is persisted to `bookings` and a WhatsApp message is sent via
   WhatChimp (template if configured, otherwise free-form text).
4. Every send attempt is recorded in `logs` for delivery tracking.

> Note: WhatsApp free-form text only works within a 24-hour session window.
> For reminders/confirmations, create and approve a template in WhatChimp and
> set `whatchimp_template_name` on the salon (or `WHATCHIMP_TEMPLATE_NAME`).
