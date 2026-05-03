# Technical Decisions

## Decision Log

### D001: Use Project-Local Skills

Decision: Store workflow skills in `.agents/skills`.

Reason: Codex reads repository skills from `.agents/skills`, and this keeps YouTube-specific workflows versioned with the project.

### D002: Keep Provider Choices Behind Adapters

Decision: Do not hard-code LLM, image, video, TTS, subtitle, or publishing providers in the first harness.

Reason: Provider capabilities and costs change. The project should stabilize artifacts and approvals first.

### D003: Human Approval Before Publishing

Decision: YouTube upload and scheduling remain manual-gated until policy, credential, and QA flows are proven.

Reason: Publishing is externally visible and high-risk.

### D004: Start With Manual Seed URLs

Decision: Phase 1 starts with manually supplied YouTube URLs instead of live YouTube search.

Reason: This stabilizes run folders, package schemas, QA gates, and dashboard-facing artifacts before API credentials, quotas, scraping policy, and ranking logic are introduced.

## Open Decisions

### O001: Dashboard Stack

Options:

- Next.js + TypeScript
- Streamlit
- Electron/local app
- Hybrid Next.js frontend with Python orchestration backend

Current leaning: Next.js for a durable dashboard, Python for media/research adapters if needed.

### O002: Run Storage

Options:

- local JSON files
- SQLite
- Postgres

Current leaning: JSON files for Phase 1, SQLite once dashboard state becomes interactive.

### O003: First Content Format

Options:

- Shorts
- long-form explainer
- faceless documentary
- tutorial

Current leaning: pick one format first to stabilize storyboard and prompt contracts.

### O004: YouTube Finder Adapter

Options:

- YouTube Data API
- approved third-party search/trend API
- browser-assisted manual research

Current leaning: implement an adapter interface after manual-seed package creation is stable.
