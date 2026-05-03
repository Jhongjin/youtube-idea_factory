# Product Spec

## Product

YouTube Idea Factory is an AI-assisted production dashboard for creating reviewed YouTube content packages from a category or topic.

## Primary User

A creator/operator who wants to scale content ideation and production while keeping control over factual accuracy, channel strategy, copyright risk, and publishing approval.

## Core Promise

Input a category or topic. Receive a structured, source-backed production package that can move from research to script, storyboard, media prompts, assets, edit plan, metadata, and publishing handoff.

## MVP Scope

MVP produces a reviewed package, not fully autonomous upload:

1. Accept category, topic, target audience, format, and channel tone.
2. Collect or ingest competitor video candidates.
3. Rank the top source videos and record source metadata.
4. Analyze structure, hook, retention patterns, claims, and thumbnail/title patterns.
5. Create a claim ledger and identify fact-check requirements.
6. Add source-backed research enrichment.
7. Produce script outline and full script plan.
8. Produce storyboard cards.
9. Produce image and video generation prompt packs.
10. Produce thumbnail/title/description/tag drafts.
11. Run QA gates and produce a human approval checklist.

## Later Scope

- Automated image generation
- Automated video generation
- TTS, subtitles, BGM selection
- Timeline assembly and render
- YouTube upload and scheduled publishing
- Performance feedback loop from analytics
- A/B testing for title, thumbnail, and opening hook

## Non-Goals For The First Build

- No unsupervised publishing.
- No hidden scraping that violates site terms.
- No claim generation without source status.
- No single giant prompt that replaces persistent docs, data contracts, and skills.

## Success Criteria

- Every run has a reproducible record in `runs/`.
- Every competitor source has a URL and reason for inclusion.
- Every factual claim has a status and source trail.
- Every generated script can be reviewed without reading raw tool logs.
- Every output package passes `youtube-production-qa` before publishing handoff.

