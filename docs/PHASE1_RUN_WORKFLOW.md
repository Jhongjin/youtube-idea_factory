# Phase 1 Run Workflow

Phase 1 creates a production package from manual YouTube seed URLs. It does not call YouTube, LLM, image, video, TTS, or publishing APIs yet.

## Why Manual Seed First

Manual seed mode gives the harness a stable output shape before provider decisions. Once the package contract works, API-backed research and generation adapters can replace manual fields without changing the dashboard flow.

## Create A Run

```powershell
python .\scripts\create_run.py `
  --topic "AI 뉴스 요약 자동화" `
  --category "Technology" `
  --format "shorts" `
  --language "ko" `
  --target-audience "AI 툴에 관심 있는 20-40대 크리에이터" `
  --tone "빠르고 실용적인 설명" `
  --duration-seconds 60 `
  --seed-url "https://www.youtube.com/watch?v=VIDEO_ID" `
  --seed-url "https://youtu.be/ANOTHER_VIDEO_ID"
```

The command creates:

- `manifest.json`
- `brief.json`
- `sources.json`
- `production-package.json`
- `01-research.md`
- `02-video-analysis.md`
- `03-claim-ledger.md`
- `04-script-plan.md`
- `05-storyboard.md`
- `06-media-prompts.md`
- `07-publishing-package.md`
- `08-qa.md`

## Validate A Run

```powershell
python .\scripts\validate_package.py .\runs\<run-id>
```

## Fill The Package

Use the local skills in this order:

1. `youtube-market-research`
2. `youtube-video-analysis`
3. `youtube-fact-check`
4. `youtube-script-architect`
5. `youtube-storyboard`
6. `youtube-media-prompts`
7. `youtube-production-qa`

## Git Policy

Generated `runs/` and `artifacts/` contents are ignored by default. Commit only templates, scripts, schemas, docs, and intentionally curated examples.

