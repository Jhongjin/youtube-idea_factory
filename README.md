# YouTube Idea Factory

유튜브 콘텐츠 제작을 리서치부터 배포까지 한 번에 오케스트레이션하기 위한 AI 대시보드 프로젝트입니다.

이 저장소의 1차 목표는 완성 앱을 바로 찍어내는 것이 아니라, 반복 가능한 제작 하네스를 먼저 고정하는 것입니다. 결정론적인 일은 스크립트와 검증 규칙으로 묶고, 판단과 창작이 필요한 일은 skills와 에이전트 역할로 분리합니다.

## Current Baseline

- `AGENTS.md`: Codex가 이 프로젝트에서 작업할 때 읽는 짧은 지도
- `docs/`: 제품, 파이프라인, 하네스, 품질/보안, MVP 계획
- `.agents/skills/`: 유튜브 제작 단계별 로컬 skills
- `scripts/create_run.py`: 수동 seed URL 기반 production run 생성기
- `scripts/validate_package.py`: production package 구조 검증기
- `scripts/validate-harness.ps1`: 하네스 문서/스킬 기본 검증
- `runs/`: 콘텐츠 제작 실행 단위별 작업 기록 위치
- `artifacts/`: 생성 이미지, 음성, 영상, 자막 등 산출물 위치

## First Working Goal

MVP는 "카테고리/주제 입력 -> 경쟁 영상 리서치 -> 구조 분석 -> 팩트체크 -> 대본 구성안 -> 스토리보드 -> 이미지/영상 프롬프트 -> 업로드 패키지"까지를 검수 가능한 패키지로 만드는 것입니다.

자동 이미지/영상/TTS/합성/업로드는 어댑터를 통해 붙입니다. 어떤 모델이나 API를 쓸지는 나중에 바꿀 수 있도록 데이터 계약을 먼저 안정화합니다.

## Create A Manual-Seed Run

```powershell
python .\scripts\create_run.py `
  --topic "AI 뉴스 요약 자동화" `
  --category "Technology" `
  --format "shorts" `
  --language "ko" `
  --target-audience "AI 툴에 관심 있는 20-40대 크리에이터" `
  --tone "빠르고 실용적인 설명" `
  --duration-seconds 60 `
  --seed-url "https://www.youtube.com/watch?v=VIDEO_ID"
```

생성된 run 폴더는 `runs/` 아래에 저장됩니다. 로컬 실행 산출물은 기본적으로 git에 커밋하지 않습니다.

## Validate A Package

```powershell
python .\scripts\validate_package.py .\runs\<run-id>
```

## Check Approval Gates

Copy `docs/templates/approvals.json` into a run folder as `approvals.json`, fill the relevant approval fields, then check a gate before calling any paid or publishing adapter:

```powershell
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate generation
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate render
python .\scripts\check_approval_gate.py .\runs\<run-id> --gate publish
```

The dashboard inspector also includes an `Approval Gates` panel. It reads and writes `runs/:runId/approvals.json` through:

- `GET /api/runs/:runId/approvals`
- `PUT /api/runs/:runId/approvals`

## Provider API Settings

Open `http://localhost:3000/settings` to choose providers and register API keys for LLM, image generation, video generation, TTS, subtitles, BGM, and YouTube adapters.

Settings are stored locally in `config/provider-settings.local.json`, which is ignored by git. The API route is `GET/PUT /api/settings/providers`; GET responses only return masked key status, never raw API keys.

Before running an adapter directly, check that its provider role is configured:

```powershell
python .\scripts\check_provider_ready.py --role llm
python .\scripts\check_provider_ready.py --role tts
python .\scripts\check_provider_ready.py --role youtube --require-key
```

## Enrich Source Metadata

```powershell
python .\scripts\enrich_sources.py <run-id>
```

This uses YouTube oEmbed to fill basic title/channel metadata without an API key.

## Configure YouTube Finder

Copy `.env.example` to `.env.local` and set:

```powershell
YOUTUBE_API_KEY=...
```

Or register the key on `http://localhost:3000/settings` under `YouTube API`.

Then use the dashboard `YouTube Finder` panel or call `POST /api/youtube/search`.
Finder results can be imported into the active run with `POST /api/runs/:runId/sources/import`.

## Transcript Slots

The dashboard Sources panel can store manual transcripts per source video. The API routes are:

- `GET /api/runs/:runId/transcripts/:sourceKey`
- `PUT /api/runs/:runId/transcripts/:sourceKey`

## Draft Analysis

The dashboard `Draft Analysis` action creates deterministic starter drafts for:

- `02-video-analysis.md`
- `03-claim-ledger.md`

It uses source metadata and available transcript text. The API route is `POST /api/runs/:runId/analysis/draft`.

## Refine Analysis With LLM

The dashboard `Refine Analysis` action uses the selected LLM provider from `/settings` to rewrite:

- `02-video-analysis.md`
- `03-claim-ledger.md`

API route: `POST /api/runs/:runId/analysis/refine`.

The response must include both required file markers before anything is saved. It also syncs parsed claim rows back into `production-package.json`.

## Draft Script

The dashboard `Draft Script` action creates a deterministic starter draft for `04-script-plan.md` from the brief, source metadata, analysis notes, and claim ledger.

API route: `POST /api/runs/:runId/script/draft`.

## Refine Script With LLM

The dashboard `Refine Script` action uses the selected LLM provider from `/settings` to rewrite `04-script-plan.md` from the current analysis, claim ledger, and deterministic script draft.

API route: `POST /api/runs/:runId/script/refine`.

Supported LLM adapter modes:

- `OpenAI`: Responses API
- `OpenRouter` or `Custom`: OpenAI-compatible chat completions endpoint

This action fails safely when the LLM provider is disabled, missing a model, or missing an API key.

## Draft Storyboard

The dashboard `Draft Storyboard` action creates a deterministic starter storyboard for `05-storyboard.md` from the current script plan.

API route: `POST /api/runs/:runId/storyboard/draft`.

## Draft Media

The dashboard `Draft Media` action creates deterministic starter prompts for `06-media-prompts.md` from the current storyboard. It also updates `production-package.json` with structured `media_prompts` counts so the pipeline state reflects generated prompt assets.

API route: `POST /api/runs/:runId/media/draft`.

## Build Asset Manifest

The dashboard `Build Assets` action creates `asset-manifest.json` for the active run. It maps image, video, thumbnail, voice, subtitle, and BGM assets to provider roles, approval gates, prompt IDs, expected output paths, and pending statuses.

API route: `POST /api/runs/:runId/assets/manifest`.

## Prepare Generation Queue

The dashboard `Prep Queue` action creates `generation-queue.json` for the active run. It checks the asset manifest against approval gates and provider settings, marks ready items as `pending_generation`, and records blockers for anything that still needs approval, provider configuration, prompts, or QA cleanup.

API route: `POST /api/runs/:runId/assets/queue`.

The inspector `Generation Console` lists queue status and can invoke the guarded OpenAI image and TTS adapters for ready assets.

## Generate Image Assets

Direct image generation is available as a guarded adapter route for OpenAI only:

- `POST /api/runs/:runId/assets/generate-image`

It requires an image or thumbnail asset ID, selected Image provider `OpenAI`, a configured model such as `gpt-image-2`, stored API key, generation approval, prepared queue status, and an explicit body field `confirmSpend: "GENERATE_IMAGE"`.

## Generate Voice Assets

Direct voice generation is available as a guarded adapter route for OpenAI only:

- `POST /api/runs/:runId/assets/generate-voice`

It requires the voice asset ID, selected TTS provider `OpenAI`, a configured model such as `gpt-4o-mini-tts`, stored API key, generation approval, prepared queue status, explicit narration text, voice, and `confirmSpend: "GENERATE_TTS"`.

## Draft Subtitles

The dashboard `Draft Subs` action creates `subtitles-primary.srt` from storyboard narration and updates the subtitle asset in `asset-manifest.json`. It is deterministic and does not call an external provider.

API route: `POST /api/runs/:runId/subtitles/draft`.

## Build Render Manifest

The dashboard `Render Plan` action creates `render-manifest.json` for the active run. It maps scene assets, voice, subtitles, BGM, resolution, timeline timing, render output paths, render approval status, and file-level blockers before any final assembly work.

API route: `POST /api/runs/:runId/render/manifest`.

`scripts/check_approval_gate.py --gate render` and `--gate publish` require `production-package.json.render_manifest.render_ready` to be true.

## Render Local MP4

The dashboard `Render MP4` action runs a guarded local ffmpeg assembly adapter:

- API route: `POST /api/runs/:runId/render/local`
- Confirmation token: `RENDER_VIDEO`
- Output: `artifacts/:runId/renders/final.mp4`

It refreshes the render manifest, runs `scripts/check_approval_gate.py --gate render`, normalizes scene videos or still images into segments, muxes voice plus optional BGM, embeds SRT subtitles, and records `rendered_path` / `rendered_at` in `production-package.json`.

## Draft Publishing

The dashboard `Draft Publish` action creates a deterministic starter upload package for `07-publishing-package.md` from the brief, script plan, and media prompts. It also updates `production-package.json` with title candidates, description, tags, and thumbnail prompt.

API route: `POST /api/runs/:runId/publishing/draft`.

## Draft QA

The dashboard `QA Gate` action creates a deterministic review packet for `08-qa.md`. It checks source coverage, claim status, pending script markers, storyboard scenes, media prompts, publishing metadata, and approval requirements, then updates `production-package.json` with QA status, blockers, warnings, fix list, and publish readiness.

API route: `POST /api/runs/:runId/qa/draft`.

## Run Draft Flow

The dashboard `Run Draft Flow` action runs the deterministic draft sequence for the active run:

`analysis -> script -> storyboard -> media -> assets -> publishing -> qa`

This is the current no-spend, no-upload baseline for one-click production package generation.

## Run Dashboard

```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

The npm scripts run Next through `scripts/next-realpath.cjs`. This keeps Next's project root stable when Windows resolves the workspace through a different real path.

The dashboard reads local packages from `runs/` and can create new manual-seed runs through `POST /api/runs`.
It also exposes a markdown artifact editor for `01-research.md` through `08-qa.md` using allowlisted local API routes.
Package structure validation is available in the right inspector and through `GET /api/runs/:runId/validate`.
Source metadata enrichment can be triggered from the Source Videos panel or through `POST /api/runs/:runId/sources/enrich`.

## Validate

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-harness.ps1
```
