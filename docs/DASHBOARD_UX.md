# Dashboard UX Direction

## First Screen

The first screen should be the production workspace, not a marketing page.

Primary layout:

- left rail: runs, templates, settings
- main workspace: current run pipeline
- right inspector: selected artifact details, sources, QA status

## Core Views

## Guided Operation Model

The default dashboard mode should behave like a production wizard:

- Show one primary next action for the active run.
- Hide broad tool lists behind an explicit advanced-tools disclosure.
- Disable or defer actions whose prerequisites are missing.
- Keep approvals hidden until the current stage actually needs generation, render, or publish approval.
- Use the right inspector for the current stage context instead of showing every possible control at once.

Advanced operators can still open the full tool menu, but the default screen groups the work into five operator steps:

1. Channel and topic
2. Find sources
3. Make the script
4. Make media
5. Review and upload

The deeper production pipeline still exists behind these steps: intake, source review, video analysis, claim review, script, storyboard, media prompts, QA, asset generation, render, publishing, and feedback. The UI should surface only the part that helps the operator decide what to press next.

### Run Intake

Fields:

- category/topic
- target audience
- format
- target duration
- language
- tone
- source mode
- risk tolerance

### Pipeline Board

Stages:

1. Research
2. Analysis
3. Fact Check
4. Script
5. Storyboard
6. Media Prompts
7. Generation
8. Assembly
9. Publishing
10. QA

Each stage should show status, blockers, artifacts, and next action.

### Source Table

Dense table for source videos:

- rank
- title
- channel
- URL
- views
- date
- reason
- transcript status
- analysis status

Transcript status should use operator-readable labels:

- unchecked
- external caption/script obtained
- manual script
- STT generated
- failed
- excluded from analysis

### Claim Ledger

Table optimized for review:

- claim
- status
- source
- confidence
- risk
- action

### Storyboard

Scene cards with compact controls:

- duration
- narration
- visual
- asset status
- prompt
- QA notes

### Media Workboard

Media generation should separate:

- ready to generate
- needs human review
- manual registration
- failed retry
- skipped

Editable request text should be available before paid generation, while raw provider IDs and storage paths stay secondary.

### Publishing Pack

Reviewable metadata:

- title candidates
- thumbnail concepts
- description
- tags
- chapters
- upload checklist

### Review And Approvals

Validation and QA screens should show both the issue and the next operator action. Approval cards should state the scope and what becomes available after approval. Saving approvals must not itself generate, render, upload, or publish.

## Design Tone

This is an operator dashboard. Keep it dense, calm, and scannable. Avoid a decorative landing-page feel. Use clear stage states, compact controls, tables, tabs, and side inspectors.
