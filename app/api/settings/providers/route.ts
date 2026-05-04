import {
  getSafeProviderSettings,
  toSafeProviderSettings,
  updateProviderSettings,
} from "@/lib/provider-settings";
import type { ProviderSettingsUpdate } from "@/lib/provider-settings-shared";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ settings: await getSafeProviderSettings() });
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as ProviderSettingsUpdate;
    const settings = await updateProviderSettings(payload);
    return Response.json({ settings: toSafeProviderSettings(settings) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Provider settings update failed." },
      { status: 400 },
    );
  }
}
