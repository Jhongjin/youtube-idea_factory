import type { ProviderRoleId } from "@/lib/provider-settings-shared";

export type ProviderModelOption = {
  id: string;
  label: string;
  source: "static" | "live";
};

type ModelCatalogKey = `${ProviderRoleId}:${string}`;

const staticCatalog: Partial<Record<ModelCatalogKey, ProviderModelOption[]>> = {
  "llm:openai": [
    { id: "gpt-5.5", label: "GPT-5.5", source: "static" },
    { id: "gpt-5.4", label: "GPT-5.4", source: "static" },
    { id: "gpt-5.2", label: "GPT-5.2", source: "static" },
    { id: "gpt-5.2-pro", label: "GPT-5.2 Pro", source: "static" },
    { id: "gpt-5.1", label: "GPT-5.1", source: "static" },
    { id: "gpt-4.1", label: "GPT-4.1", source: "static" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", source: "static" },
    { id: "o4-mini", label: "o4-mini", source: "static" },
    { id: "o3", label: "o3", source: "static" },
  ],
  "image:openai": [
    { id: "gpt-image-1.5", label: "GPT Image 1.5", source: "static" },
    { id: "gpt-image-1", label: "GPT Image 1", source: "static" },
    { id: "dall-e-3", label: "DALL-E 3", source: "static" },
  ],
  "video:openai": [
    { id: "sora-2", label: "Sora 2", source: "static" },
    { id: "sora-2-pro", label: "Sora 2 Pro", source: "static" },
  ],
  "tts:openai": [
    { id: "gpt-4o-mini-tts", label: "GPT-4o mini TTS", source: "static" },
    { id: "tts-1", label: "TTS 1", source: "static" },
    { id: "tts-1-hd", label: "TTS 1 HD", source: "static" },
  ],
  "subtitles:openai": [
    { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe", source: "static" },
    { id: "gpt-4o-mini-transcribe", label: "GPT-4o mini Transcribe", source: "static" },
    { id: "whisper-1", label: "Whisper 1", source: "static" },
  ],
  "llm:google": [
    { id: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", source: "static" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", source: "static" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", source: "static" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", source: "static" },
  ],
  "tts:google": [
    { id: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash Preview TTS", source: "static" },
    { id: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro Preview TTS", source: "static" },
  ],
  "subtitles:google": [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", source: "static" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", source: "static" },
  ],
  "subtitles:supadata": [
    { id: "native", label: "Native transcript", source: "static" },
    { id: "auto", label: "Native then AI fallback", source: "static" },
    { id: "generate", label: "AI generated transcript", source: "static" },
  ],
  "llm:anthropic": [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", source: "static" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", source: "static" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6", source: "static" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", source: "static" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 alias", source: "static" },
    { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", source: "static" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", source: "static" },
    { id: "claude-opus-4-1-20250805", label: "Claude Opus 4.1", source: "static" },
    { id: "claude-opus-4-20250514", label: "Claude Opus 4", source: "static" },
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", source: "static" },
    { id: "claude-3-7-sonnet-20250219", label: "Claude Sonnet 3.7", source: "static" },
    { id: "claude-3-5-sonnet-20241022", label: "Claude Sonnet 3.5", source: "static" },
    { id: "claude-3-5-haiku-20241022", label: "Claude Haiku 3.5", source: "static" },
    { id: "claude-3-opus-20240229", label: "Claude Opus 3", source: "static" },
    { id: "claude-3-sonnet-20240229", label: "Claude Sonnet 3", source: "static" },
    { id: "claude-3-haiku-20240307", label: "Claude Haiku 3", source: "static" },
  ],
  "llm:mistral": [
    { id: "mistral-large-latest", label: "Mistral Large latest", source: "static" },
    { id: "ministral-8b-latest", label: "Ministral 8B latest", source: "static" },
  ],
  "llm:deepseek": [
    { id: "deepseek-chat", label: "DeepSeek Chat", source: "static" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", source: "static" },
  ],
  "image:fal.ai": [
    { id: "fal-ai/flux-pro", label: "Flux Pro", source: "static" },
    { id: "fal-ai/flux/dev", label: "Flux Dev", source: "static" },
    { id: "fal-ai/imagen4/preview", label: "Imagen 4 Preview", source: "static" },
  ],
  "video:fal.ai": [
    { id: "fal-ai/kling-video/v2.1/master", label: "Kling 2.1 Master", source: "static" },
    { id: "fal-ai/veo3", label: "Veo 3", source: "static" },
    { id: "fal-ai/minimax/video-01", label: "MiniMax Video 01", source: "static" },
  ],
  "tts:inworld": [
    { id: "inworld-tts-1", label: "Inworld TTS 1", source: "static" },
  ],
  "video:runway": [
    { id: "gen4_turbo", label: "Gen-4 Turbo", source: "static" },
    { id: "gen3a_turbo", label: "Gen-3 Alpha Turbo", source: "static" },
  ],
  "video:kling": [
    { id: "kling-v2.1", label: "Kling 2.1", source: "static" },
    { id: "kling-v2.0", label: "Kling 2.0", source: "static" },
  ],
  "video:luma": [
    { id: "ray-2", label: "Ray 2", source: "static" },
  ],
  "editing:hyperframes": [
    { id: "default-motion-template", label: "Default motion template", source: "static" },
  ],
  "editing:remotion": [
    { id: "youtube-shorts-composition", label: "YouTube Shorts composition", source: "static" },
  ],
};

const liveCatalogProviders = new Set(["openai", "anthropic", "google", "openrouter"]);

function normalizeProvider(provider: string) {
  return provider.trim().toLowerCase();
}

function catalogKey(role: ProviderRoleId, provider: string): ModelCatalogKey {
  return `${role}:${normalizeProvider(provider)}`;
}

export function getStaticProviderModels(
  role: ProviderRoleId,
  provider: string,
): ProviderModelOption[] {
  return staticCatalog[catalogKey(role, provider)] ?? [];
}

export function supportsLiveProviderModelRefresh(provider: string) {
  return liveCatalogProviders.has(normalizeProvider(provider));
}
