import type { ProviderRoleId } from "@/lib/provider-settings-shared";

export type ProviderCapabilityStatus = "direct" | "manual" | "pending";

export type ProviderCapability = {
  status: ProviderCapabilityStatus;
  label: string;
  shortLabel: string;
};

export const directAdapterProviders: Record<ProviderRoleId, string[]> = {
  bgm: [],
  editing: ["FFmpeg Worker"],
  image: ["OpenAI", "fal.ai"],
  llm: ["OpenAI", "OpenRouter", "Custom"],
  subtitles: ["OpenAI"],
  tts: ["OpenAI", "Inworld"],
  video: ["fal.ai"],
  youtube: ["YouTube Data API"],
};

const manualWorkflowProviders = new Set([
  "AIVIS (Avis)",
  "Adobe Firefly",
  "Adobe Premiere Pro Manual",
  "Artlist",
  "Canva Dream Lab",
  "CapCut",
  "DaVinci Resolve Manual",
  "Epidemic Sound",
  "Ideogram",
  "InVideo AI",
  "Kdenlive Manual",
  "Leonardo AI",
  "Local",
  "Manual Export",
  "Manual Library",
  "Midjourney Manual",
  "Naver Clova Dubbing",
  "OpenCut",
  "Reelbox",
  "Remotion",
  "Sora",
  "Soundraw",
  "Shotcut Manual",
  "Suno",
  "Typecast",
  "Udio",
  "Vrew",
  "YouTube Audio Library",
  "YouTube Auto Captions",
]);

export function hasDirectAdapter(role: ProviderRoleId, provider: string) {
  return directAdapterProviders[role].includes(provider);
}

export function hasManualWorkflow(provider: string) {
  return manualWorkflowProviders.has(provider);
}

export function requiresProviderModel(role: ProviderRoleId, provider: string) {
  if (role === "youtube" || role === "bgm" || role === "editing") {
    return false;
  }
  return hasDirectAdapter(role, provider);
}

export function getProviderCapability(
  role: ProviderRoleId,
  provider: string,
): ProviderCapability {
  if (hasDirectAdapter(role, provider)) {
    return {
      status: "direct",
      label: "직접 자동화 지원",
      shortLabel: "직접",
    };
  }
  if (hasManualWorkflow(provider)) {
    return {
      status: "manual",
      label: "수동/외부 워크플로",
      shortLabel: "수동",
    };
  }
  return {
    status: "pending",
    label: "직접 어댑터 대기",
    shortLabel: "대기",
  };
}
