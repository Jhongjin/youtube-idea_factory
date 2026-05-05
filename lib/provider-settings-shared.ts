export const providerRoles = [
  {
    id: "llm",
    label: "LLM",
    description: "리서치, 분석, 팩트체크 보조, 대본 작성, 검토에 사용합니다.",
    providers: ["OpenAI", "Anthropic", "Google", "OpenRouter", "Local", "Custom"],
  },
  {
    id: "image",
    label: "이미지 생성",
    description: "스토리보드 컷, 썸네일, 비주얼 카드, 보조 이미지를 생성합니다.",
    providers: ["OpenAI", "Stability", "Midjourney Manual", "Local", "Custom"],
  },
  {
    id: "video",
    label: "영상 생성",
    description: "모션 샷, B-roll, 생성 클립, 씬 변형을 생성합니다.",
    providers: ["Runway", "Pika", "Luma", "Kling", "Local", "Custom"],
  },
  {
    id: "tts",
    label: "TTS",
    description: "내레이션 음성을 생성합니다.",
    providers: ["OpenAI", "ElevenLabs", "Google", "Azure", "Local", "Custom"],
  },
  {
    id: "subtitles",
    label: "자막",
    description: "음성 인식, 자막 타이밍, 캡션 포맷팅에 사용합니다.",
    providers: ["OpenAI", "AssemblyAI", "Deepgram", "Local", "Custom"],
  },
  {
    id: "bgm",
    label: "BGM",
    description: "배경음악 선택 또는 생성에 사용합니다.",
    providers: ["Manual Library", "Mubert", "Soundraw", "Local", "Custom"],
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
