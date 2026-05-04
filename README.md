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

## Draft Script

The dashboard `Draft Script` action creates a deterministic starter draft for `04-script-plan.md` from the brief, source metadata, analysis notes, and claim ledger.

API route: `POST /api/runs/:runId/script/draft`.

## Draft Storyboard

The dashboard `Draft Storyboard` action creates a deterministic starter storyboard for `05-storyboard.md` from the current script plan.

API route: `POST /api/runs/:runId/storyboard/draft`.

## Draft Media

The dashboard `Draft Media` action creates deterministic starter prompts for `06-media-prompts.md` from the current storyboard. It also updates `production-package.json` with structured `media_prompts` counts so the pipeline state reflects generated prompt assets.

API route: `POST /api/runs/:runId/media/draft`.

## Draft Publishing

The dashboard `Draft Publish` action creates a deterministic starter upload package for `07-publishing-package.md` from the brief, script plan, and media prompts. It also updates `production-package.json` with title candidates, description, tags, and thumbnail prompt.

API route: `POST /api/runs/:runId/publishing/draft`.

## Run Dashboard

```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

The dashboard reads local packages from `runs/` and can create new manual-seed runs through `POST /api/runs`.
It also exposes a markdown artifact editor for `01-research.md` through `08-qa.md` using allowlisted local API routes.
Package structure validation is available in the right inspector and through `GET /api/runs/:runId/validate`.
Source metadata enrichment can be triggered from the Source Videos panel or through `POST /api/runs/:runId/sources/enrich`.

## Validate

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-harness.ps1
```
