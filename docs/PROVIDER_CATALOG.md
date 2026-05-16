# Provider Catalog

This dashboard separates provider selection from adapter implementation. A provider can be listed before a direct API adapter exists, so production runs can plan the workflow without forcing one vendor.

The settings page labels every provider as `direct`, `manual`, or `pending`:

- `direct`: the dashboard has a direct server adapter.
- `manual`: the provider is useful, but the workflow is handled outside the dashboard or through file registration.
- `pending`: the provider is selectable, but a direct adapter still needs to be built.

For `manual` or `pending` providers, use the dashboard `수동 핸드오프` action to create an external generation packet before registering completed files back into the asset manifest.

## LLM

- OpenAI
- Anthropic
- Google
- OpenRouter
- Mistral
- DeepSeek
- Perplexity
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
- Recraft
- Freepik
- Krea
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
- Hailuo
- PixVerse
- Haiper
- Vidu
- HunyuanVideo
- Wan
- Higgsfield
- Adobe Firefly Video
- CapCut
- Vrew
- HeyGen
- InVideo AI
- Reelbox
- Local
- Custom

Direct adapter implemented now:

- fal.ai video generation through the queue API. Long-running jobs still need a background worker for unattended production reliability.

## Editing / Render

- FFmpeg Worker
- OpenCut
- HyperFrames
- Remotion
- Creatomate
- Shotstack
- VEED API
- Cloudinary Video
- CapCut
- DaVinci Resolve Manual
- Adobe Premiere Pro Manual
- Kdenlive Manual
- Shotcut Manual
- Local
- Custom

Direct adapter implemented now:

- FFmpeg Worker through the local render worker path.

Selectable, but not directly automated yet:

- OpenCut for privacy-first manual timeline editing and export registration.
- HyperFrames for agent-authored HTML/CSS/JS motion renders.
- Remotion for React/programmatic video compositions.
- Creatomate, Shotstack, VEED API, and Cloudinary Video for future cloud video editing/transformation adapters.

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
- Provider settings can store multiple slots per role. Additional slots are saved as `profile:<role>:<id>` rows in `provider_settings` so existing Supabase schema can support multi-registration without a new table.

## Reference Links

- OpenCut: https://github.com/OpenCut-app/OpenCut
- HyperFrames: https://hyperframes.app/docs/1-startup/1-introduction
- Remotion: https://www.remotion.dev/docs/
- Creatomate: https://creatomate.com/docs/fundamentals/getting-started/introduction
- Shotstack: https://shotstack.io/docs/api/
- Cloudinary Video: https://cloudinary.com/documentation/video_manipulation_and_delivery
