---
name: youtube-fact-check
description: Verify factual claims for YouTube scripts, research briefs, competitor analyses, descriptions, and thumbnails. Use when Codex sees dates, numbers, studies, news, legal, medical, financial, scientific, historical, or safety-sensitive claims that need evidence before publication.
---

# Youtube Fact Check

## Overview

Use this skill before script finalization and before writing metadata that makes factual claims.

## Workflow

1. Extract atomic claims from the input.
2. Classify each claim as factual, opinion/editorial, prediction, or creative premise.
3. Prioritize high-risk claims: numbers, dates, health, law, finance, science, public figures, news, safety, and accusations.
4. Verify against reliable sources.
5. Create a claim ledger with status and action.
6. Return rewrite guidance for unsupported or risky claims.

## Claim Status

- `supported`: usable with source.
- `needs_evidence`: hold until verified.
- `opinion`: allowed if framed as opinion.
- `high_risk`: requires stronger review or safer rewrite.
- `do_not_use`: remove from script.

## Output Contract

Return:

- `claim_ledger`: table with claim, status, evidence URL, confidence, risk, action
- `source_notes`: short notes on source quality
- `safe_rewrites`: safer versions of risky claims
- `blocked_claims`: claims that must not proceed
- `next_skill`: usually `youtube-script-architect` after blockers are cleared

## Rules

- Browse or use current trusted sources for unstable facts.
- Use exact dates when clarifying time-sensitive facts.
- Do not invent citations.
- Do not bury uncertainty in prose.
- Prefer removing weak claims over adding vague hedges.

