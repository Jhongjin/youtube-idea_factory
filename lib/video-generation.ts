import {
  generateFalVideo,
  type GenerateFalMediaResult,
  type GenerateFalVideoRequest,
} from "@/lib/fal-media-generation";
import { getProviderSettings, resolveProviderSetting } from "@/lib/provider-settings";

export type GenerateVideoRequest = GenerateFalVideoRequest;
export type GenerateVideoResult = GenerateFalMediaResult;

export async function generateVideoAsset(
  runId: string,
  request: GenerateVideoRequest,
): Promise<GenerateVideoResult> {
  const settings = await getProviderSettings();
  const videoProvider = resolveProviderSetting(settings, "video", request.providerProfileId);
  if (videoProvider.provider === "fal.ai") {
    return generateFalVideo(runId, request, videoProvider);
  }
  throw new Error(`Direct video generation is not implemented for provider: ${videoProvider.provider}`);
}
