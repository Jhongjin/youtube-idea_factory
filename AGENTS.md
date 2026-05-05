# YouTube Idea Factory Agent Guide

## Mission

Build a YouTube automation dashboard that can turn a category or topic into a reviewed production package: research, competitor analysis, fact-checking, script plan, storyboard, media prompts, generated assets, final render metadata, and publishing handoff.

## Operating Principles

- Keep this file short. Treat it as a map, not the full manual.
- Put durable project knowledge in `docs/` and link to it from here.
- Keep deterministic work in scripts, schemas, adapters, tests, and validation gates.
- Keep creative or judgment-heavy work in `.agents/skills/` and explicit agent roles.
- Never publish, upload, or spend external credits without an explicit human approval gate.
- Preserve source links, timestamps, model choices, costs, and reasoning notes for every content run.
- For claims, always separate "supported", "needs evidence", "opinion", and "do not use".

## Project Map

- Product goal and scope: `docs/PRODUCT_SPEC.md`
- End-to-end content pipeline: `docs/PIPELINE.md`
- Harness strategy: `docs/HARNESS_ARCHITECTURE.md`
- Agent and skill orchestration: `docs/AGENT_ORCHESTRATION.md`
- Quality, security, and policy gates: `docs/QUALITY_SECURITY.md`
- Dashboard UX direction: `docs/DASHBOARD_UX.md`
- Provider catalog and adapter status: `docs/PROVIDER_CATALOG.md`
- YouTube upload worker: `docs/YOUTUBE_UPLOAD_WORKER.md`
- Worker queue operations: `docs/WORKER_QUEUE.md`
- MVP sequence: `docs/MVP_ROADMAP.md`
- Work queue and deferred tasks: `docs/WORK_QUEUE.md`
- Decision log: `docs/TECH_DECISIONS.md`
- Data contract seed: `docs/templates/production-package.schema.json`
- Run brief template: `docs/templates/run-brief.md`

## Local Skills

Use the project-local skills under `.agents/skills/` when the task matches their descriptions:

- `youtube-market-research`
- `youtube-video-analysis`
- `youtube-fact-check`
- `youtube-script-architect`
- `youtube-storyboard`
- `youtube-media-prompts`
- `youtube-production-qa`

## Validation

Run this after editing project guidance, skills, or templates:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-harness.ps1
```

## Current Constraints

- The workspace currently lives under a broader user-home git root. Keep edits scoped to `Documents/Codex/yuotube_idea_factory`.
- Prefer project-local `.agents/skills` for workflow skills so the harness travels with the project folder.
- Treat YouTube API access, scraping, media generation, and publishing integrations as adapters until credentials and provider choices are decided.
