import { getProviderModels } from "@/lib/provider-model-catalog";
import {
  getProviderSettings,
  resolveProviderSetting,
} from "@/lib/provider-settings";
import { isProviderRoleId } from "@/lib/provider-settings-shared";

export const dynamic = "force-dynamic";

type ProviderModelsRequest = {
  profileId?: unknown;
  provider?: unknown;
  role?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProviderModelsRequest;
    const role = typeof body.role === "string" ? body.role : "";
    if (!isProviderRoleId(role)) {
      throw new Error("Unknown provider role.");
    }

    const settings = await getProviderSettings();
    const profileId = typeof body.profileId === "string" ? body.profileId : undefined;
    const provider = typeof body.provider === "string" ? body.provider.trim() : "";
    const resolved = profileId
      ? resolveProviderSetting(settings, role, profileId)
      : settings.roles[role];
    const models = await getProviderModels(role, {
      ...resolved,
      provider: provider || resolved.provider,
    });

    return Response.json({
      fetchedAt: new Date().toISOString(),
      models,
      role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider model refresh failed.";
    const safeMessage =
      /401|403|api key|unauthorized|forbidden|incorrect/i.test(message)
        ? "저장된 API 키로 모델 목록을 가져오지 못했습니다. API 키를 다시 저장한 뒤 시도하세요."
        : message;
    return Response.json(
      { error: safeMessage },
      { status: 400 },
    );
  }
}
