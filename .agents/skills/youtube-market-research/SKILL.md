---
name: youtube-market-research
description: Find, rank, and synthesize YouTube competitor/source videos for a topic, category, or content run. Use when Codex needs a YouTube finder workflow, top-video shortlist, source table, trend snapshot, competitor selection rationale, or research brief before script planning.
---

# Youtube Market Research

## Workflow

1. Clarify the content brief: topic, category, language, target audience, format, time horizon, and region.
2. Select source mode: official API, approved search provider, web search, or manual seed URLs.
3. Collect candidate videos with URL, title, channel, published date, view count if available, duration, and why it matters.
4. Rank candidates using relevance, performance, recency, format match, and usefulness for the target channel.
5. Return a top 10 shortlist plus excluded near-misses when useful.
6. Flag transcript availability, source quality, copyright risk, and fact-check needs.

## Output Contract

Return:

- `research_summary`: short synthesis of the topic space
- `ranking_method`: how candidates were selected
- `top_videos`: table with rank, URL, title, channel, views, date, duration, inclusion reason
- `patterns_to_investigate`: hooks, thumbnail/title promises, narrative formats, repeated claims
- `gaps`: missing data, unavailable transcripts, or weak sources
- `next_skill`: usually `youtube-video-analysis`

## Rules

- Do not treat view count alone as quality.
- Label estimates and unavailable fields clearly.
- Preserve source URLs exactly.
- Do not copy titles or thumbnail concepts verbatim into creative recommendations.
- If current YouTube data is required, use live/API-backed lookup or state that only manual seeds are available.

