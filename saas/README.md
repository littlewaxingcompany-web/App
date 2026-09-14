# SalonStream SaaS

Next.js + Supabase multi-tenant application for SalonStream. This is the
productized evolution of the standalone bridge: it receives booking emails via
an Inbound Email API (Postmark/Mailgun), parses them with the shared
`EmailParser`, persists bookings, and sends WhatsApp messages directly through
WhatChimp.

## Stack

- **Next.js (Pages Router)** — combined frontend/backend
- **Supabase** — Postgres + Auth + Row Level Security (multi-tenant isolation)
- **WhatChimp** — direct WhatsApp messaging (no Zapier)

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
│   ├── useAuth.js           # Supabase Auth session
│   └── useBookings.js       # fetch bookings
├── lib/
│   ├── email-parser.js      # shared booking-email parser (from bridge)
│   ├── inbound-email.js     # Postmark/Mailgun normalizers
│   ├── booking-service.js   # parse → persist → send → log pipeline
│   ├── whatchimp-client.js  # direct WhatsApp API client
│   └── supabase.js          # lazy server client
├── schema.sql               # users, salons, bookings, logs + RLS
└── .env.example
```

## Getting Started

```bash
cd saas
npm install
cp .env.example .env.local   # fill in Supabase + WhatChimp values
npm run dev
```

Create the schema by running `schema.sql` in the Supabase SQL editor.

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
