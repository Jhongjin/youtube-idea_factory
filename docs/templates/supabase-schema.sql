-- YouTube Idea Factory Supabase seed schema.
-- Apply in Supabase SQL Editor after reviewing project auth requirements.
-- MVP policy: no public table policies. Server adapters should use SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.production_runs (
  id text primary key,
  topic text not null,
  category text,
  format text not null,
  language text not null,
  status text not null default 'draft',
  package jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.run_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id text not null references public.production_runs(id) on delete cascade,
  artifact_key text not null,
  filename text not null,
  content text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, artifact_key)
);

create table if not exists public.run_assets (
  run_id text not null references public.production_runs(id) on delete cascade,
  asset_id text not null,
  kind text not null,
  provider_role text not null,
  status text not null,
  expected_path text not null,
  actual_path text,
  provider text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (run_id, asset_id)
);

create table if not exists public.run_approvals (
  run_id text not null references public.production_runs(id) on delete cascade,
  gate text not null check (gate in ('generation', 'render', 'publish')),
  approved boolean not null default false,
  approved_by text not null default '',
  approved_at timestamptz,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (run_id, gate)
);

create table if not exists public.run_events (
  id bigint generated always as identity primary key,
  run_id text references public.production_runs(id) on delete cascade,
  event_type text not null,
  provider text,
  model text,
  cost_usd numeric(12, 6),
  request_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.production_runs enable row level security;
alter table public.run_artifacts enable row level security;
alter table public.run_assets enable row level security;
alter table public.run_approvals enable row level security;
alter table public.run_events enable row level security;

comment on table public.production_runs is 'Durable production package records for YouTube Idea Factory.';
comment on table public.run_artifacts is 'Markdown artifacts and optional Supabase Storage pointers.';
comment on table public.run_assets is 'Generated or externally registered media asset manifest records.';
comment on table public.run_approvals is 'Human approval gates for generation, render, and publish.';
comment on table public.run_events is 'Provider calls, cost estimates, render events, upload attempts, and audit notes.';
