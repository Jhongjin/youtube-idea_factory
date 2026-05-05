import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppStorageMode } from "@/lib/storage-mode";
import { isSupabaseMissingTableError, supabaseRest } from "@/lib/supabase-rest";
import {
  isProviderRoleId,
  providerRoles,
  type ProviderRoleId,
  type ProviderRoleSetting,
  type ProviderSettingsUpdate,
  type SafeProviderRoleSetting,
  type SafeProviderSettings,
  type StoredProviderSettings,
} from "@/lib/provider-settings-shared";

const configDir = path.join(/* turbopackIgnore: true */ process.cwd(), "config");
const providerSettingsPath = path.join(configDir, "provider-settings.local.json");

type SupabaseProviderSettingsRow = {
  api_key: string | null;
  base_url: string;
  enabled: boolean;
  model: string;
  notes: string;
  provider: string;
  role: ProviderRoleId;
  updated_at: string | null;
};

function defaultRoleSetting(role: ProviderRoleId): ProviderRoleSetting {
  const metadata = providerRoles.find((item) => item.id === role);
  return {
    role,
    enabled: false,
    provider: metadata?.providers[0] ?? "Custom",
    model: "",
    baseUrl: "",
    notes: "",
  };
}

function createDefaultSettings(): StoredProviderSettings {
  return {
    version: 1,
    roles: Object.fromEntries(
      providerRoles.map((role) => [role.id, defaultRoleSetting(role.id)]),
    ) as Record<ProviderRoleId, ProviderRoleSetting>,
  };
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function normalizeText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeSettings(input: Partial<StoredProviderSettings>): StoredProviderSettings {
  const defaults = createDefaultSettings();
  const inputRoles =
    input.roles && typeof input.roles === "object" ? input.roles : defaults.roles;

  for (const role of providerRoles) {
    const saved = inputRoles[role.id];
    defaults.roles[role.id] = {
      ...defaults.roles[role.id],
      ...(saved && typeof saved === "object" ? saved : {}),
      role: role.id,
      enabled: normalizeBoolean(saved?.enabled),
      provider: normalizeText(saved?.provider, 80) || defaults.roles[role.id].provider,
      model: normalizeText(saved?.model, 120),
      apiKey: normalizeText(saved?.apiKey, 4000) || undefined,
      baseUrl: normalizeText(saved?.baseUrl, 300),
      notes: normalizeText(saved?.notes, 1000),
      updatedAt: normalizeText(saved?.updatedAt, 80) || undefined,
    };
  }

  return defaults;
}

export async function getProviderSettings(): Promise<StoredProviderSettings> {
  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<SupabaseProviderSettingsRow[]>("provider_settings", {
      query: {
        select: "role,enabled,provider,model,api_key,base_url,notes,updated_at",
      },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return [];
      }
      throw error;
    });
    const settings = createDefaultSettings();
    for (const row of rows) {
      if (!isProviderRoleId(row.role)) {
        continue;
      }
      settings.roles[row.role] = {
        apiKey: row.api_key ?? undefined,
        baseUrl: row.base_url,
        enabled: row.enabled,
        model: row.model,
        notes: row.notes,
        provider: row.provider,
        role: row.role,
        updatedAt: row.updated_at ?? undefined,
      };
    }
    return normalizeSettings(settings);
  }

  if (!(await exists(providerSettingsPath))) {
    return createDefaultSettings();
  }

  return normalizeSettings(await readJson<Partial<StoredProviderSettings>>(providerSettingsPath));
}

function maskKey(apiKey?: string) {
  if (!apiKey) {
    return "";
  }
  const suffix = apiKey.slice(-4);
  return suffix ? `stored ending ${suffix}` : "stored";
}

function toSafeRoleSetting(setting: ProviderRoleSetting): SafeProviderRoleSetting {
  const { apiKey: _apiKey, ...safe } = setting;
  return {
    ...safe,
    hasApiKey: Boolean(setting.apiKey),
    apiKeyPreview: maskKey(setting.apiKey),
  };
}

export function toSafeProviderSettings(settings: StoredProviderSettings): SafeProviderSettings {
  return {
    version: 1,
    configPath:
      getAppStorageMode() === "supabase"
        ? "supabase:provider_settings"
        : path.relative(/* turbopackIgnore: true */ process.cwd(), providerSettingsPath),
    roles: Object.fromEntries(
      providerRoles.map((role) => [role.id, toSafeRoleSetting(settings.roles[role.id])]),
    ) as SafeProviderSettings["roles"],
  };
}

export async function getSafeProviderSettings(): Promise<SafeProviderSettings> {
  return toSafeProviderSettings(await getProviderSettings());
}

export async function updateProviderSettings(
  update: ProviderSettingsUpdate,
): Promise<StoredProviderSettings> {
  if (!Array.isArray(update.roles)) {
    throw new Error("roles must be an array.");
  }

  const settings = await getProviderSettings();
  const now = new Date().toISOString();

  for (const incoming of update.roles) {
    if (!isProviderRoleId(incoming.role)) {
      throw new Error(`Unknown provider role: ${incoming.role}`);
    }

    const current = settings.roles[incoming.role];
    const apiKey = normalizeText(incoming.apiKey, 4000);
    settings.roles[incoming.role] = {
      ...current,
      enabled: incoming.enabled === undefined ? current.enabled : normalizeBoolean(incoming.enabled),
      provider: normalizeText(incoming.provider, 80) || current.provider,
      model: incoming.model === undefined ? current.model : normalizeText(incoming.model, 120),
      apiKey: apiKey ? apiKey : current.apiKey,
      baseUrl:
        incoming.baseUrl === undefined ? current.baseUrl : normalizeText(incoming.baseUrl, 300),
      notes: incoming.notes === undefined ? current.notes : normalizeText(incoming.notes, 1000),
      updatedAt: now,
    };
  }

  if (getAppStorageMode() === "supabase") {
    await supabaseRest<SupabaseProviderSettingsRow[]>("provider_settings", {
      method: "POST",
      body: providerRoles.map((role) => {
        const setting = settings.roles[role.id];
        return {
          api_key: setting.apiKey ?? null,
          base_url: setting.baseUrl,
          enabled: setting.enabled,
          model: setting.model,
          notes: setting.notes,
          provider: setting.provider,
          role: role.id,
          updated_at: now,
        };
      }),
      query: { on_conflict: "role" },
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return settings;
  }

  await writeJson(providerSettingsPath, settings);
  return settings;
}
