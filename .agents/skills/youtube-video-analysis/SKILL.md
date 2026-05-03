---
name: youtube-video-analysis
description: Analyze YouTube source videos, transcripts, titles, thumbnails, hooks, pacing, story structure, retention devices, claims, and reusable patterns. Use after market research or when Codex needs competitor teardown before script, storyboard, or thumbnail planning.
---

# Youtube Video Analysis

## Overview

Use this skill to turn competitor videos into structured, reusable production intelligence without copying protected expression.

## Analysis Dimensions

For each video, inspect:

- title and thumbnail promise
- first 5 to 30 seconds hook
- opening question, tension, or payoff
- beat structure
- pacing and segment lengths
- pattern interrupts
- emotional turns
- credibility devices
- CTA and ending
- factual claims requiring verification
- visual grammar and edit style

## Output Contract

Return:

- `per_video_analysis`: one compact card per source video
- `hook_library`: hook types and why they work
- `structure_patterns`: reusable outline shapes
- `retention_devices`: curiosity gaps, reveals, contrasts, stakes, countdowns
- `claim_candidates`: claims that must go to `youtube-fact-check`
- `creative_boundaries`: elements that should not be copied
- `opportunities`: gaps the new video can own

## Rules

- Summarize patterns, not transcripts.
- Treat missing transcript data as a limitation.
- Separate observed facts from interpretation.
- Do not recommend copying a competitor's exact wording, title, thumbnail, or scene sequence.
- Preserve timestamps when available.

