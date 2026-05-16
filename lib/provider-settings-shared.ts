export const providerRoles = [
  {
    id: "llm",
    label: "LLM",
    description: "리서치, 분석, 팩트체크 보조, 대본 작성, 검토에 사용합니다.",
    providers: [
      "OpenAI",
      "Anthropic",
      "Google",
      "OpenRouter",
      "Mistral",
      "DeepSeek",
      "Perplexity",
      "Naver HyperCLOVA X",
      "Upstage Solar",
      "Local",
      "Custom",
    ],
  },
  {
    id: "image",
    label: "이미지 생성",
    description: "스토리보드 컷, 썸네일, 비주얼 카드, 보조 이미지를 생성합니다.",
    providers: [
      "OpenAI",
      "fal.ai",
      "Midjourney Manual",
      "Stability",
      "Flux",
      "Stable Diffusion",
      "Leonardo AI",
      "Canva Dream Lab",
      "Adobe Firefly",
      "Ideogram",
      "Recraft",
      "Freepik",
      "Krea",
      "Local",
      "Custom",
    ],
  },
  {
    id: "video",
    label: "영상 생성",
    description: "모션 샷, B-roll, 생성 클립, 씬 변형을 생성합니다.",
    providers: [
      "Runway",
      "fal.ai",
      "Kling",
      "Pika",
      "Luma",
      "Sora",
      "Google Veo",
      "Seedance",
      "Hailuo",
      "PixVerse",
      "Haiper",
      "Vidu",
      "HunyuanVideo",
      "Wan",
      "Higgsfield",
      "Adobe Firefly Video",
      "CapCut",
      "Vrew",
      "HeyGen",
      "InVideo AI",
      "Reelbox",
      "Local",
      "Custom",
    ],
  },
  {
    id: "tts",
    label: "TTS",
    description: "내레이션 음성을 생성합니다.",
    providers: [
      "OpenAI",
      "Inworld",
      "Supertone",
      "AIVIS (Avis)",
      "ElevenLabs",
      "Typecast",
      "Vrew",
      "Naver Clova Dubbing",
      "CapCut",
      "Google",
      "Azure",
      "Local",
      "Custom",
    ],
  },
  {
    id: "subtitles",
    label: "자막",
    description: "음성 인식, 자막 타이밍, 캡션 포맷팅에 사용합니다.",
    providers: [
      "OpenAI",
      "AssemblyAI",
      "Deepgram",
      "Vrew",
      "CapCut",
      "YouTube Auto Captions",
      "Local",
      "Custom",
    ],
  },
  {
    id: "bgm",
    label: "BGM",
    description: "배경음악 선택 또는 생성에 사용합니다.",
    providers: [
      "Manual Library",
      "YouTube Audio Library",
      "Mubert",
      "Soundraw",
      "Suno",
      "Udio",
      "Epidemic Sound",
      "Artlist",
      "Local",
      "Custom",
    ],
  },
  {
    id: "editing",
    label: "편집/렌더",
    description: "타임라인 편집, 자동 합성, 프로그램형 렌더, 최종 파일 변환에 사용합니다.",
    providers: [
      "FFmpeg Worker",
      "OpenCut",
      "HyperFrames",
      "Remotion",
      "Creatomate",
      "Shotstack",
      "VEED API",
      "Cloudinary Video",
      "CapCut",
      "DaVinci Resolve Manual",
      "Adobe Premiere Pro Manual",
      "Kdenlive Manual",
      "Shotcut Manual",
      "Local",
      "Custom",
    ],
  },
  {
    id: "youtube",
    label: "YouTube API",
    description: "검색, 메타데이터, 업로드, 예약, 분석 어댑터에 사용합니다.",
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

export type ProviderProfile = ProviderRoleSetting & {
  id: string;
};

export type SafeProviderProfile = Omit<ProviderProfile, "apiKey"> & {
  hasApiKey: boolean;
  apiKeyPreview: string;
};

export type StoredProviderSettings = {
  version: 1;
  profiles: ProviderProfile[];
  roles: Record<ProviderRoleId, ProviderRoleSetting>;
};

export type SafeProviderSettings = {
  version: 1;
  configPath: string;
  profiles: SafeProviderProfile[];
  roles: Record<ProviderRoleId, SafeProviderRoleSetting>;
};

export type ProviderSettingsUpdate = {
  profiles?: Array<
    Pick<ProviderProfile, "id" | "role"> &
      Partial<Omit<ProviderProfile, "id" | "role" | "updatedAt">>
  >;
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
