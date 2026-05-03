# Agent Orchestration

## Role Map

### Strategy Lead

Owns channel positioning, audience, angle, format, and risk tolerance.

### Market Researcher

Uses `youtube-market-research`. Produces source video candidates, ranking rationale, and competitor observations.

### Video Analyst

Uses `youtube-video-analysis`. Produces structure and hook analysis, retention patterns, and reusable pattern library.

### Fact Checker

Uses `youtube-fact-check`. Produces claim ledger, evidence pack, and "do not use" list.

### Script Architect

Uses `youtube-script-architect`. Produces angle, outline, script plan, and source-backed beat map.

### Storyboard Director

Uses `youtube-storyboard`. Produces scene cards and edit notes.

### Media Prompt Designer

Uses `youtube-media-prompts`. Produces image/video prompt packs with style continuity and safety notes.

### Production QA

Uses `youtube-production-qa`. Reviews the final package before generation spend or publishing handoff.

## Handoff Rules

- Every role returns structured output, not only prose.
- Every output references the input artifact it used.
- Claims must carry source status.
- Creative outputs must avoid copying competitor expression.
- If a role detects missing input, it must return a blocker list instead of hallucinating.

## Main Orchestrator Flow

1. Create `RunBrief`.
2. Ask Market Researcher for sources.
3. Ask Video Analyst for competitor structure.
4. Ask Fact Checker to build claim ledger.
5. Ask Strategy Lead to pick angle.
6. Ask Script Architect to draft script plan.
7. Ask Storyboard Director to create scene cards.
8. Ask Media Prompt Designer for prompt packs.
9. Ask Production QA to approve, block, or request revisions.

## Human Approval Points

- Before using paid generation APIs
- Before using controversial or weakly sourced claims
- Before final render
- Before YouTube upload or scheduling

