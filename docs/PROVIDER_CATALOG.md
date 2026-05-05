# Provider Catalog

This dashboard separates provider selection from adapter implementation. A provider can be listed before a direct API adapter exists, so production runs can plan the workflow without forcing one vendor.

## LLM

- OpenAI
- Anthropic
- Google
- OpenRouter
- Naver HyperCLOVA X
- Upstage Solar
- Local
- Custom

## Image Generation

- OpenAI
- fal.ai
- Midjourney Manual
- Stability
- Flux
- Stable Diffusion
- Leonardo AI
- Canva Dream Lab
- Adobe Firefly
- Ideogram
- Local
- Custom

Direct adapter implemented now:

- OpenAI image generation
- fal.ai image generation through the queue API

## Video Generation

- Runway
- fal.ai
- Kling
- Pika
- Luma
- Sora
- Google Veo
- Seedance
- CapCut
- Vrew
- HeyGen
- InVideo AI
- Reelbox
- Local
- Custom

Direct adapter implemented now:

- fal.ai video generation through the queue API. Long-running jobs still need a background worker for unattended production reliability.

## TTS

- OpenAI
- Inworld
- Supertone
- AIVIS (Avis)
- ElevenLabs
- Typecast
- Vrew
- Naver Clova Dubbing
- CapCut
- Google
- Azure
- Local
- Custom

Direct adapter implemented now:

- OpenAI TTS
- Inworld TTS

Selectable, but not directly automated yet:

- Supertone
- AIVIS (Avis)
- Typecast
- Vrew
- Naver Clova Dubbing
- CapCut

## Subtitles

- OpenAI
- AssemblyAI
- Deepgram
- Vrew
- CapCut
- YouTube Auto Captions
- Local
- Custom

Direct adapter implemented now:

- OpenAI speech-to-text transcript import from an operator-provided audio URL

## BGM

- Manual Library
- YouTube Audio Library
- Mubert
- Soundraw
- Suno
- Udio
- Epidemic Sound
- Artlist
- Local
- Custom

## Market Notes

- There is no reliable public ranking for "most used by Korean YouTubers." Treat the catalog as a practical shortlist, not a market-share claim.
- Korean creator workflows repeatedly mention Vrew, CapCut, Typecast, and Naver Clova Dubbing for captions, editing, and voiceover.
- Global AI video comparisons repeatedly include Runway, Kling, Pika, Luma, Sora, Veo, and Seedance.
- Global AI image comparisons repeatedly include Midjourney, OpenAI image generation, Stable Diffusion, Flux, Leonardo AI, Adobe Firefly, Canva, and Ideogram.
- fal.ai is included as an API aggregation layer for image, video, audio, and multimodal generation models.
