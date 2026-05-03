# Harness Architecture

## Why Harness First

The dashboard will touch research, generation, external APIs, paid media models, copyright-sensitive assets, factual claims, and publishing. A harness-first design keeps the creative system fast while making the risky parts inspectable.

## Core Pattern

Use three layers:

1. Deterministic layer: scripts, schemas, adapters, validation, logs, cost accounting.
2. Agentic layer: skills, role prompts, analysis, writing, creative planning, review.
3. Human gate layer: approvals for facts, money, rights, final render, and publishing.

## Deterministic vs Non-Deterministic

Use deterministic code when:

- the same input should produce the same output
- credentials, file writes, uploads, deletion, or money are involved
- schema validation or quality gates are required
- source metadata must be preserved

Use LLM/agent workflows when:

- the task needs judgment, synthesis, taste, or adaptation
- multiple valid outputs are acceptable
- analysis should become a structured brief for later steps

## Repository Memory Model

- `AGENTS.md` is the short map.
- `docs/` is the durable system of record.
- `MEMORY.md` stores current project intent and open questions.
- `.agents/skills/` stores reusable workflow behavior.
- `runs/` stores per-content execution records.
- `artifacts/` stores generated media and manifests.

## Skills

Project skills live under `.agents/skills/` so they can be versioned with the project. Keep each skill focused on one job and give it a clear output contract.

Initial skills:

- market research
- video analysis
- fact check
- script architecture
- storyboard
- media prompts
- production QA

## Hooks And Safety Scripts

Hooks are useful later for deterministic enforcement:

- block dangerous commands
- validate schema after run package edits
- check that claim ledgers exist before scripts
- prevent publishing commands without approval
- run lint/tests after code edits

This repository starts with a manual validation script. Hook activation should come after the first app scaffold exists.

## Adapter Boundaries

Keep providers behind adapter interfaces:

- `youtube_search`
- `transcript_fetch`
- `web_research`
- `llm_generate`
- `image_generate`
- `video_generate`
- `tts_generate`
- `subtitle_generate`
- `timeline_render`
- `youtube_publish`

The dashboard should depend on internal data contracts, not provider-specific payloads.

## Source Notes

This setup follows the current Codex guidance that `AGENTS.md` should be project guidance, skills should package instructions/resources/scripts, and repository skills can live in `.agents/skills`. It also follows the harness-engineering principle that durable repository knowledge should be a map plus versioned docs, with mechanical checks for repeatable constraints.

Sources:

- https://openai.com/ko-KR/index/harness-engineering/
- https://openai.com/ko-KR/index/unlocking-the-codex-harness/
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/hooks

