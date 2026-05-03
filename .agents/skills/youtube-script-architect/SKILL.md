---
name: youtube-script-architect
description: Turn YouTube research, competitor analysis, and fact-check results into a complete script strategy, outline, hook, beat map, narration plan, and revision checklist. Use when Codex needs to plan or draft a source-backed YouTube script before storyboard work.
---

# Youtube Script Architect

## Overview

Use this skill after research, analysis, and fact-checking. If those inputs are missing, return blockers before drafting.

## Workflow

1. Restate the target viewer and promise.
2. Pick one defensible angle from research gaps and competitor patterns.
3. Design the hook around curiosity, stakes, contrast, or payoff.
4. Build a beat outline with source-backed claims.
5. Mark retention checkpoints.
6. Draft narration or a detailed script plan depending on requested depth.
7. Create revision notes for tone, pacing, clarity, and evidence.

## Output Contract

Return:

- `script_strategy`: audience, promise, angle, format, target length
- `hook_options`: 3 to 5 hook candidates with rationale
- `selected_hook`: one recommended hook
- `beat_map`: ordered sections with purpose, claims, evidence references, visual intent
- `narration_draft`: draft or partial draft when requested
- `retention_plan`: where to add reveals, contrasts, pattern interrupts, CTA
- `open_questions`: unresolved facts or strategic choices
- `next_skill`: usually `youtube-storyboard`

## Rules

- Do not use claims marked `needs_evidence`, `high_risk`, or `do_not_use`.
- Transform competitor patterns into original expression.
- Make the first 15 seconds earn attention.
- Keep the script aligned with thumbnail/title promise.
- Prefer clarity and momentum over encyclopedic completeness.

