---
name: youtube-production-qa
description: Review a YouTube production package before generation spend, final render, or publishing. Use when Codex needs to inspect source coverage, factual claims, copyright risk, platform policy risk, asset completeness, script/storyboard consistency, metadata, and approval gates.
---

# Youtube Production Qa

## Overview

Use this skill at the end of each major phase and always before external spend, final render, or upload.

## Review Areas

- brief alignment
- source coverage
- fact-check completeness
- unsupported claims
- derivative/copyright risk
- platform policy risk
- script and storyboard consistency
- media prompt safety
- asset completeness
- metadata accuracy
- approval status

## Output Contract

Return:

- `qa_status`: `pass`, `blocked`, or `needs_review`
- `blockers`: issues that prevent the next step
- `warnings`: issues that can proceed with caution
- `fix_list`: concrete revisions by artifact
- `approval_checklist`: human approvals still needed
- `publish_readiness`: ready, not ready, or render-only ready

## Rules

- Lead with blockers.
- Do not approve publishing when facts, rights, or platform safety are unclear.
- Treat paid generation as a separate approval from publishing.
- Preserve the user's channel strategy over generic virality advice.
- Convert repeated failures into proposed harness checks or docs updates.

