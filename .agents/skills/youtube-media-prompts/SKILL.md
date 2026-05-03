---
name: youtube-media-prompts
description: Create image generation prompts, video generation prompts, style bibles, negative prompts, continuity notes, and generation manifests from a YouTube storyboard. Use before image/video generation or when Codex needs provider-agnostic media prompts for scenes, thumbnails, or B-roll.
---

# Youtube Media Prompts

## Overview

Use this skill after storyboard creation and before generation spend.

## Workflow

1. Extract format requirements: aspect ratio, target duration, channel style, language, and platform.
2. Create a style bible for visual consistency.
3. Convert storyboard scenes into provider-agnostic image prompts.
4. Convert motion-heavy scenes into provider-agnostic video prompts.
5. Add negative prompts and safety notes.
6. Add continuity notes for recurring people, places, objects, colors, and camera language.
7. Create a generation manifest that can be reviewed before calling paid tools.

## Output Contract

Return:

- `style_bible`
- `image_prompts`: id, scene id, prompt, negative prompt, aspect ratio, safety notes
- `video_prompts`: id, scene id, prompt, motion, camera, duration, negative prompt, safety notes
- `thumbnail_prompts`: concepts and prompt variants
- `continuity_notes`
- `generation_manifest`: estimated asset count and approval needs
- `next_skill`: `youtube-production-qa` before generation or publishing

## Rules

- Do not reference living artists for style imitation unless explicitly allowed and appropriate.
- Do not create prompts for copyrighted characters, protected logos, or celebrity likeness without approval.
- Keep prompts grounded in storyboard and verified claims.
- Make provider assumptions explicit when a provider is specified.
- Keep paid generation behind approval.

