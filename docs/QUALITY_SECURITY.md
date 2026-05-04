# Quality, Security, And Policy Gates

## Quality Gates

### G1 Research Completeness

- At least 10 candidate source videos when available.
- Each source has URL, title, channel, view count if available, date if available, and inclusion rationale.
- Manual seed mode is allowed during MVP but must be labeled.

### G2 Fact Integrity

- Every factual claim has a status.
- Claims without reliable sources are excluded or labeled as opinion.
- Dates, numbers, names, studies, legal/medical/financial statements, and news claims require explicit evidence.

### G3 Script Quality

- Hook matches the promised title/thumbnail angle.
- The script has a clear viewer payoff.
- Competitor insights are transformed, not copied.
- Claims map back to evidence.
- LLM-refined scripts still require human review and must not convert unresolved claim rows into factual narration.

### G4 Media Readiness

- Every scene has a visual plan.
- Prompt packs include aspect ratio, style, continuity, negative prompts, and safety notes.
- Paid generation requires approval.
- Run `scripts/check_approval_gate.py --gate generation` before calling image, video, TTS, subtitle, or BGM providers.

### G5 Final Package

- Thumbnail/title/description align with the content and avoid deceptive claims.
- Subtitles and voice match script.
- Render manifest exists.
- Publishing checklist is complete.
- Run `scripts/check_approval_gate.py --gate render` before final assembly or render spend.
- Run `scripts/check_approval_gate.py --gate publish` before upload, scheduling, or public publishing.

## Security Rules

- Store credentials outside committed files.
- Use `/settings` or `config/provider-settings.local.json` for provider credentials; never commit local provider settings.
- Do not log API keys, OAuth tokens, cookies, or paid provider secrets.
- Do not run upload/publish actions without explicit human approval.
- Do not run paid generation or render actions without explicit human approval.
- Keep destructive file operations scoped to this project directory.
- Keep generated media provenance and provider metadata in manifests.

## Copyright And Platform Risk

- Do not copy scripts, thumbnails, titles, or distinctive scenes from competitor videos.
- Use competitor analysis to extract patterns, not protected expression.
- Track asset license or generation provenance.
- Flag face/voice likeness, celebrity, brand, medical, financial, legal, political, and children-related content for extra review.

## Debugging Expectations

- Prefer small reproducible run records.
- Keep raw provider responses only when useful and safe.
- Summarize failures in run manifests.
- Add deterministic checks when the same mistake happens twice.
