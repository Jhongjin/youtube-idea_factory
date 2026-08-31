-- Supabase mirror for the Orca local control-plane.
-- The local Orca host remains the execution authority. Vercel reads only
-- server-signed snapshots through SUPABASE_SECRET_KEY.

create table if not exists public.orca_channel_policies (
  channel text primary key,
  policy_version text not null,
  fact_mode text not null check (fact_mode in ('strict', 'conditional', 'world_bound')),
  recommendation_mode text not null,
  format_mode text not null,
  risk_tier text not null,
  policy jsonb not null,
  policy_sha256 text not null check (policy_sha256 ~ '^[0-9a-f]{64}$'),
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orca_runs (
  run_id text primary key,
  channel text not null,
  run_name text not null,
  run_dir text not null unique,
  topic_key text not null default '',
  state text not null check (state in ('running', 'hold', 'completed', 'rejected')),
  current_stage text,
  next_stage text,
  resume_from text,
  fact_mode text not null check (fact_mode in ('strict', 'conditional', 'world_bound')),
  policy_version text not null,
  failure jsonb,
  progress jsonb not null default '{"completed":0,"total":0}'::jsonb,
  stages jsonb not null default '[]'::jsonb,
  updated_at_kst text not null,
  source_state_sha256 text not null check (source_state_sha256 ~ '^[0-9a-f]{64}$'),
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orca_queue_jobs (
  queue_kind text not null check (queue_kind in ('llm', 'media', 'render', 'audio', 'publish')),
  job_id text not null,
  idempotency_key text not null,
  run_dir text not null,
  channel text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  stage text,
  record jsonb not null,
  record_sha256 text not null check (record_sha256 ~ '^[0-9a-f]{64}$'),
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (queue_kind, job_id),
  unique (queue_kind, idempotency_key)
);

drop trigger if exists set_orca_channel_policies_updated_at on public.orca_channel_policies;
create trigger set_orca_channel_policies_updated_at
before update on public.orca_channel_policies
for each row execute function public.set_updated_at();

drop trigger if exists set_orca_runs_updated_at on public.orca_runs;
create trigger set_orca_runs_updated_at
before update on public.orca_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_orca_queue_jobs_updated_at on public.orca_queue_jobs;
create trigger set_orca_queue_jobs_updated_at
before update on public.orca_queue_jobs
for each row execute function public.set_updated_at();

alter table public.orca_channel_policies enable row level security;
alter table public.orca_runs enable row level security;
alter table public.orca_queue_jobs enable row level security;

revoke all on table public.orca_channel_policies from anon, authenticated;
revoke all on table public.orca_runs from anon, authenticated;
revoke all on table public.orca_queue_jobs from anon, authenticated;

grant select, insert, update, delete on table public.orca_channel_policies to service_role;
grant select, insert, update, delete on table public.orca_runs to service_role;
grant select, insert, update, delete on table public.orca_queue_jobs to service_role;

create index if not exists orca_runs_channel_synced_idx
  on public.orca_runs (channel, synced_at desc);
create index if not exists orca_runs_state_synced_idx
  on public.orca_runs (state, synced_at desc);
create index if not exists orca_queue_jobs_status_kind_idx
  on public.orca_queue_jobs (status, queue_kind, source_updated_at desc);
create index if not exists orca_queue_jobs_channel_idx
  on public.orca_queue_jobs (channel, source_updated_at desc);

comment on table public.orca_channel_policies is 'Server-only mirror of versioned Orca channel policies.';
comment on table public.orca_runs is 'Server-only mirror of hash-bound Orca run states.';
comment on table public.orca_queue_jobs is 'Server-only mirror of Orca LLM, media, render, audio, and publish queues.';

notify pgrst, 'reload schema';
