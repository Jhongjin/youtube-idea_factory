---
name: youtube-storyboard
description: Convert a YouTube script plan or narration draft into scene-by-scene storyboard cards with duration, visuals, on-screen text, asset needs, edit notes, and media generation requirements. Use before image/video prompting or production assembly.
---

# Youtube Storyboard

## Overview

Use this skill when the script is approved enough to plan visuals.

## Workflow

1. Split the script into scenes based on idea changes, visual changes, or pacing needs.
2. Assign duration estimates.
3. Create visual concepts for each scene.
4. Add on-screen text only where it supports comprehension or retention.
5. Identify asset needs: generated image, generated video, stock, chart, screen capture, icon, text card, B-roll, voice, subtitle, BGM cue.
6. Add edit notes and transition intent.
7. Flag scenes that are expensive, risky, or unclear.

## Output Contract

Return a `storyboard` table with:

- `scene_id`
- `time_range`
- `duration_seconds`
- `narration`
- `visual`
- `on_screen_text`
- `asset_needs`
- `prompt_needed`
- `edit_notes`
- `risk_notes`

Also return:

- `asset_summary`
- `generation_priority`
- `next_skill`: usually `youtube-media-prompts`

## Rules

- Keep visuals faithful to verified claims.
- Do not invent evidence charts or screenshots.
- Keep text overlays short.
- Plan for the selected format: Shorts need faster scene changes; long-form can breathe.
- Flag any scene that needs human approval or paid generation.

