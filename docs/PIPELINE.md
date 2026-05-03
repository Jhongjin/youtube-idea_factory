# Production Pipeline

## Pipeline Stages

### 1. Intake

Inputs:

- category or topic
- target audience
- video format: Shorts, long-form, documentary, explainer, review, news, tutorial
- language and tone
- desired length
- hard constraints: forbidden topics, required sources, brand rules

Output: `RunBrief`

### 2. YouTube Finder

Find candidate videos for the category or topic.

Preferred source order:

1. Official YouTube Data API when credentials are available.
2. Approved third-party trend/search APIs.
3. Manual seed URLs during early MVP.

Output: ranked `SourceVideo[]`

### 3. Competitor Analysis

Analyze each selected video:

- title and thumbnail promise
- opening hook
- structure and pacing
- retention devices
- story turns
- CTA
- factual claims
- reusable patterns without copying expression

Output: `VideoAnalysis[]` and `PatternLibrary`

### 4. Fact Check

Create a claim ledger:

- supported
- needs evidence
- opinion/editorial
- high risk
- do not use

Output: `ClaimLedger`

### 5. Research Enrichment

Search additional sources for gaps found during analysis and fact-checking. Store source URLs, retrieval dates, and short notes.

Output: `EvidencePack`

### 6. Script Architecture

Create the production script plan:

- angle
- promise
- hook
- beat outline
- narration draft
- visual notes
- source-backed claim placement
- retention checkpoints

Output: `ScriptPlan`

### 7. Storyboard

Convert the script plan into scene cards:

- scene id
- duration
- narration
- visual concept
- on-screen text
- asset needs
- generation prompt need
- edit notes

Output: `Storyboard`

### 8. Media Prompting

Create prompt packs:

- style bible
- character/object continuity
- image prompts
- video prompts
- negative prompts
- aspect ratio and duration
- rights and safety notes

Output: `MediaPromptPack`

### 9. Generation And Assembly

Later adapter stage:

- image generation
- video generation
- TTS
- subtitles
- BGM
- timeline assembly
- render

Output: `AssetManifest` and `RenderManifest`

### 10. Publishing Package

Create:

- final title candidates
- thumbnail concept and prompt
- description
- chapters
- tags
- pinned comment
- upload checklist

Output: `PublishingPackage`

### 11. QA Gate

Run production QA:

- source coverage
- factual risk
- copyright/derivative risk
- platform policy risk
- brand/tone fit
- asset completeness
- human approval status

Output: `QAPacket`

## Required Gates

- G1 Research sources approved
- G2 Fact check complete
- G3 Script approved
- G4 Storyboard approved
- G5 Media prompts approved before paid generation
- G6 Final render approved
- G7 Human approval before upload

