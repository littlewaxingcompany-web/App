-- ============================================================================
-- SalonStream SaaS — Database Schema (Provider-Agnostic PostgreSQL)
-- ============================================================================
-- Multi-tenant schema for the SalonStream platform.
--
-- This file targets plain PostgreSQL and works on Supabase, Neon, or any other
-- Postgres host. The application connects via a single `DATABASE_URL`
-- connection string (see `saas/lib/db.js`).
--
-- Tenancy model: a "user" (account owner) has one or more "salons".
-- Bookings are captured per salon; every outbound message is recorded in "logs".
--
-- Row Level Security policies are provided in a clearly-marked OPTIONAL section
-- at the bottom. Those require Supabase Auth (the `auth` schema + `auth.uid()`)
-- and are only applied when you run them inside Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extension (harmless if already present)
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type plan_tier as enum ('lite', 'pro', 'agency');
create type booking_status as enum ('new', 'confirmed', 'reminded', 'cancelled', 'failed');
create type message_channel as enum ('whatchimp', 'zapier', 'whatsapp');
create type message_status as enum ('pending', 'sent', 'delivered', 'read', 'failed');

-- ----------------------------------------------------------------------------
-- users
-- One row per account owner.
-- `auth_id` optionally links to an external identity provider (e.g. Supabase
-- Auth's auth.users). It is nullable and has NO foreign key so this schema
-- also works on Neon / plain Postgres, which have no `auth` schema.
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique,                 -- external auth id (e.g. Supabase Auth), optional
  email       text not null,
  full_name   text,
  plan        plan_tier not null default 'lite',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- salons
-- Each salon belongs to exactly one user (tenant boundary).
-- ----------------------------------------------------------------------------
create table if not exists public.salons (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  name                text not null,
  -- Ovatu email filtering (which inbound emails belong to this salon)
  email_filter_sender text not null default 'reservations@ovatu.com',
  email_filter_subject text,
  -- WhatChimp messaging config. Store the api token carefully — do not log it.
  whatchimp_api_token       text,
  whatchimp_phone_number_id text,
  whatchimp_template_id     text,
  whatchimp_template_name   text,
  whatchimp_language_code   text default 'en_US',
  default_country_code      text default '44',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists salons_user_id_idx on public.salons (user_id);
create index if not exists salons_email_filter_sender_idx on public.salons (email_filter_sender);

-- ----------------------------------------------------------------------------
-- bookings
-- Parsed booking records, one per inbound booking email (or API event).
-- ----------------------------------------------------------------------------
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references public.salons (id) on delete cascade,
  client_name    text,
  client_phone   text,
  client_email   text,
  service        text,
  staff          text,
  date_appointment text,
  time_appointment text,
  location       text,
  status         booking_status not null default 'new',
  -- Raw parsed fields + source email for traceability/debugging
  raw_payload    jsonb not null default '{}'::jsonb,
  source_email   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists bookings_salon_id_idx on public.bookings (salon_id);
create index if not exists bookings_client_phone_idx on public.bookings (client_phone);
create index if not exists bookings_created_at_idx on public.bookings (created_at desc);

-- ----------------------------------------------------------------------------
-- logs
-- Append-only audit of every outbound message attempt (delivery tracking).
-- ----------------------------------------------------------------------------
create table if not exists public.logs (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons (id) on delete cascade,
  booking_id   uuid references public.bookings (id) on delete set null,
  channel      message_channel not null default 'whatchimp',
  event        text not null,               -- e.g. 'booking_received', 'message_sent', 'message_failed'
  status       message_status not null default 'pending',
  wa_message_id text,                        -- WhatsApp message id (from WhatChimp)
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists logs_salon_id_idx on public.logs (salon_id);
create index if not exists logs_booking_id_idx on public.logs (booking_id);
create index if not exists logs_created_at_idx on public.logs (created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists salons_set_updated_at on public.salons;
create trigger salons_set_updated_at before update on public.salons
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- OPTIONAL: Supabase Row Level Security (run only inside Supabase)
-- ============================================================================
-- The statements below enforce tenant isolation using Supabase Auth's
-- `auth.uid()`. They require the Supabase `auth` schema and are NOT part of a
-- plain-Neon/Postgres setup (where the app enforces tenancy itself via the
-- `DATABASE_URL` service connection). Uncomment/run them only if you use
-- Supabase Auth and want database-level RLS.

-- alter table public.users enable row level security;
-- alter table public.salons enable row level security;
-- alter table public.bookings enable row level security;
-- alter table public.logs enable row level security;

-- create or replace function public.owns_salon(_salon_id uuid)
-- returns boolean language sql stable security definer as $$
--   select exists (
--     select 1 from public.salons s
--     where s.id = _salon_id
--       and s.user_id = (select u.id from public.users u where u.auth_id = auth.uid())
--   );
-- $$;

-- create policy "users_select_own" on public.users
--   for select using (auth_id = auth.uid());
-- create policy "users_update_own" on public.users
--   for update using (auth_id = auth.uid());
-- create policy "salons_all_owner" on public.salons
--   for all using (user_id = (select id from public.users where auth_id = auth.uid()))
--   with check (user_id = (select id from public.users where auth_id = auth.uid()));
-- create policy "bookings_all_owner" on public.bookings
--   for all using (public.owns_salon(salon_id)) with check (public.owns_salon(salon_id));
-- create policy "logs_all_owner" on public.logs
--   for all using (public.owns_salon(salon_id)) with check (public.owns_salon(salon_id));
