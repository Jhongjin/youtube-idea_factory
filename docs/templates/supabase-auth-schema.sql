-- YouTube Idea Factory auth and channel management tables.
-- Run in Supabase SQL Editor after the core production schema.

create table if not exists public.app_users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'member')),
  status text not null check (status in ('active', 'pending', 'disabled')),
  password_hash text not null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_status_idx on public.app_users(status);
create index if not exists app_users_role_idx on public.app_users(role);

create table if not exists public.youtube_channels (
  id text primary key,
  brand_name text not null,
  channel_name text not null,
  channel_id text,
  youtube_handle text,
  owner_email text,
  default_language text not null default 'ko',
  status text not null check (status in ('active', 'setup', 'paused')),
  upload_refresh_token text,
  analytics_refresh_token text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists youtube_channels_status_idx on public.youtube_channels(status);
create index if not exists youtube_channels_brand_idx on public.youtube_channels(brand_name);

comment on table public.app_users is
  'Dashboard login users. Password hashes are written by the app server through the Supabase service role.';

comment on table public.youtube_channels is
  'Brand channel OAuth inventory. Refresh tokens are never returned to the browser by dashboard pages.';
