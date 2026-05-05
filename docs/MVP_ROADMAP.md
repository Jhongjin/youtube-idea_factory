# MVP Roadmap

## Phase 0: Harness Baseline

Status: started.

- Create project guidance and docs map.
- Create local YouTube production skills.
- Create validation script.
- Define seed data contracts.

## Phase 1: Manual-Input Production Package

Goal: User can paste a category/topic and seed URLs, then receive a structured production package.

Build:

- run folder creation: started with `scripts/create_run.py`
- run brief form or template: started with `docs/templates/run-brief.md` and `brief.json`
- source video table: started with `sources.json` and `01-research.md`
- analysis artifact format: started with `02-video-analysis.md`
- claim ledger: started with `03-claim-ledger.md`
- script plan: started with `04-script-plan.md`
- storyboard: started with `05-storyboard.md`
- media prompt pack: started with `06-media-prompts.md`
- QA packet: started with `08-qa.md` and `scripts/validate_package.py`

## Phase 2: Research Automation

Goal: Add YouTube finder and transcript ingestion.

Build:

- YouTube Data API adapter or approved search provider: started with `POST /api/youtube/search`
- transcript fetch adapter: manual transcript storage slot implemented first
- source ranking logic: started with finder result import and duplicate URL skipping
- failure and quota handling
- deterministic analysis draft from source metadata and manual transcripts
- deterministic script plan draft from analysis and claim ledger
- deterministic storyboard draft from script plan
- deterministic media prompt draft from storyboard, with structured prompt records
- deterministic publishing package draft from script plan and media prompts
- deterministic QA gate draft with blockers, warnings, fix list, and approval checklist
- dashboard one-click draft flow for analysis through QA
- approval gate script and run-level approvals template for paid adapters
- provider API registration page and local provider settings storage
- provider readiness preflight script for adapter roles
- optional LLM-backed analysis and claim-ledger refinement from selected provider
- optional LLM-backed script refinement from selected provider
- provider-agnostic asset manifest for image, video, thumbnail, voice, subtitles, and BGM
- dashboard approval gate editor for generation, render, and publishing gates
- provider-agnostic generation queue preflight from asset manifest, approvals, and provider settings
- guarded OpenAI image generation adapter route for approved queued image assets
- guarded OpenAI TTS adapter route for approved queued voice assets
- deterministic storyboard-to-SRT subtitle draft route
- deterministic render manifest and file-level preflight before assembly
- guarded local ffmpeg render adapter for approved ready manifests
- deterministic publishing handoff manifest before YouTube upload

## Phase 3: Dashboard App

Goal: Build the usable production dashboard.

Candidate stack:

- Next.js + TypeScript for dashboard
- Python/FastAPI or Node server for orchestration
- SQLite/Postgres for runs and artifacts
- object storage or local filesystem for generated media

Decision remains open until MVP data contracts settle.

Initial dashboard work has started with a Next.js operator workspace that reads local run packages from `runs/`, creates manual-seed runs through a local API route, edits allowlisted markdown artifacts from the run folder, exposes provider API settings, and manages run-level approval gates.

## Phase 4: Media Generation Adapters

Goal: Add paid generation behind approval gates.

Build:

- image generation adapter
- video generation adapter
- TTS adapter
- subtitle adapter
- BGM selection
- asset manifest
- local render is available for ffmpeg-based MVP assembly; provider render adapters remain future work

## Phase 5: Assembly And Publishing

Goal: Render and hand off to YouTube.

Build:

- timeline assembly
- render validation
- thumbnail export
- YouTube upload job handoff and external OAuth worker: started
- dashboard operations panel for render/upload worker status: started
- Supabase worker_jobs queue record foundation: started
- schedule/publish approval gate

## Phase 6: Feedback Loop

Goal: Use performance data to improve future content.

Build:

- analytics ingestion
- retention pattern comparison
- title/thumbnail A/B learning log
- channel memory updates
