export const providerRoles = [
  {
    id: "llm",
    label: "LLM",
    description: "Research, analysis, fact-check assistance, script drafting, and review.",
    providers: ["OpenAI", "Anthropic", "Google", "OpenRouter", "Local", "Custom"],
  },
  {
    id: "image",
    label: "Image Generation",
    description: "Storyboard stills, thumbnails, visual cards, and supporting images.",
    providers: ["OpenAI", "Stability", "Midjourney Manual", "Local", "Custom"],
  },
  {
    id: "video",
    label: "Video Generation",
    description: "Motion shots, B-roll, generated clips, and scene variations.",
    providers: ["Runway", "Pika", "Luma", "Kling", "Local", "Custom"],
  },
  {
    id: "tts",
    label: "TTS",
    description: "Narration voice generation.",
    providers: ["OpenAI", "ElevenLabs", "Google", "Azure", "Local", "Custom"],
  },
  {
    id: "subtitles",
    label: "Subtitles",
    description: "Speech-to-text, subtitle timing, and caption formatting.",
    providers: ["OpenAI", "AssemblyAI", "Deepgram", "Local", "Custom"],
  },
  {
    id: "bgm",
    label: "BGM",
    description: "Background music selection or generation.",
    providers: ["Manual Library", "Mubert", "Soundraw", "Local", "Custom"],
  },
  {
    id: "youtube",
    label: "YouTube API",
    description: "Search, metadata, upload, scheduling, and analytics adapters.",
    providers: ["YouTube Data API", "Manual Export", "Custom"],
  },
] as const;

export type ProviderRoleId = (typeof providerRoles)[number]["id"];

export type ProviderRoleSetting = {
  role: ProviderRoleId;
  enabled: boolean;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl: string;
  notes: string;
  updatedAt?: string;
};

export type SafeProviderRoleSetting = Omit<ProviderRoleSetting, "apiKey"> & {
  hasApiKey: boolean;
  apiKeyPreview: string;
};

export type StoredProviderSettings = {
  version: 1;
  roles: Record<ProviderRoleId, ProviderRoleSetting>;
};

export type SafeProviderSettings = {
  version: 1;
  configPath: string;
  roles: Record<ProviderRoleId, SafeProviderRoleSetting>;
};

export type ProviderSettingsUpdate = {
  roles: Array<
    Pick<ProviderRoleSetting, "role"> &
      Partial<Omit<ProviderRoleSetting, "role" | "updatedAt">>
  >;
};

export function getProviderRole(role: string) {
  return providerRoles.find((item) => item.id === role);
}

export function isProviderRoleId(role: string): role is ProviderRoleId {
  return getProviderRole(role) !== undefined;
}
