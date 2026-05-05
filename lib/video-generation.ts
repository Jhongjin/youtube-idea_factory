import {
  generateFalVideo,
  type GenerateFalMediaResult,
  type GenerateFalVideoRequest,
} from "@/lib/fal-media-generation";
import { getProviderSettings } from "@/lib/provider-settings";

export type GenerateVideoRequest = GenerateFalVideoRequest;
export type GenerateVideoResult = GenerateFalMediaResult;

export async function generateVideoAsset(
  runId: string,
  request: GenerateVideoRequest,
): Promise<GenerateVideoResult> {
  const provider = (await getProviderSettings()).roles.video.provider;
  if (provider === "fal.ai") {
    return generateFalVideo(runId, request);
  }
  throw new Error(`Direct video generation is not implemented for provider: ${provider}`);
}
