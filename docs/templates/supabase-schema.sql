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

create table if not exists public.worker_jobs (
  id uuid primary key,
  run_id text not null references public.production_runs(id) on delete cascade,
  kind text not null check (kind in ('render', 'youtube-upload', 'image-generation', 'video-generation', 'tts', 'subtitles', 'bgm')),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  job_artifact_key text not null,
  log_artifact_key text not null default '',
  approval_gate text not null default '',
  provider_role text not null default '',
  worker_type text not null default '',
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  last_error text not null default '',
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_settings (
  role text primary key,
  enabled boolean not null default false,
  provider text not null default '',
  model text not null default '',
  api_key text,
  base_url text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('youtube-assets', 'youtube-assets', false)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_production_runs_updated_at on public.production_runs;
create trigger set_production_runs_updated_at
before update on public.production_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_run_artifacts_updated_at on public.run_artifacts;
create trigger set_run_artifacts_updated_at
before update on public.run_artifacts
for each row execute function public.set_updated_at();

drop trigger if exists set_run_assets_updated_at on public.run_assets;
create trigger set_run_assets_updated_at
before update on public.run_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_run_approvals_updated_at on public.run_approvals;
create trigger set_run_approvals_updated_at
before update on public.run_approvals
for each row execute function public.set_updated_at();

drop trigger if exists set_worker_jobs_updated_at on public.worker_jobs;
create trigger set_worker_jobs_updated_at
before update on public.worker_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_provider_settings_updated_at on public.provider_settings;
create trigger set_provider_settings_updated_at
before update on public.provider_settings
for each row execute function public.set_updated_at();

alter table public.production_runs enable row level security;
alter table public.run_artifacts enable row level security;
alter table public.run_assets enable row level security;
alter table public.run_approvals enable row level security;
alter table public.run_events enable row level security;
alter table public.worker_jobs enable row level security;
alter table public.provider_settings enable row level security;

create index if not exists worker_jobs_status_kind_idx on public.worker_jobs (status, kind, queued_at);
create index if not exists worker_jobs_run_id_idx on public.worker_jobs (run_id, updated_at desc);

comment on table public.production_runs is 'Durable production package records for YouTube Idea Factory.';
comment on table public.run_artifacts is 'Markdown artifacts and optional Supabase Storage pointers.';
comment on table public.run_assets is 'Generated or externally registered media asset manifest records.';
comment on table public.run_approvals is 'Human approval gates for generation, render, and publish.';
comment on table public.run_events is 'Provider calls, cost estimates, render events, upload attempts, and audit notes.';
comment on table public.worker_jobs is 'Durable queue records for external render, upload, and generation workers.';
comment on table public.provider_settings is 'Server-side provider selections and API keys for adapter roles. Access with service role only until auth policies are designed.';
