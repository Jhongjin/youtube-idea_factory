import {
  getProviderCapability,
  hasDirectAdapter,
  hasManualWorkflow,
  requiresProviderModel,
} from "@/lib/provider-capabilities";
import { listYouTubeChannels } from "@/lib/channels";
import {
  getProviderSettings,
  resolvePreferredProviderSetting,
} from "@/lib/provider-settings";
import {
  providerRoles,
  type ProviderRoleId,
  type StoredProviderSettings,
} from "@/lib/provider-settings-shared";
import { isSupabaseMissingTableError, supabaseRest } from "@/lib/supabase-rest";

export type ProviderRoleReadiness = {
  enabled: boolean;
  provider: string;
  model: string;
  hasApiKey: boolean;
  implementedAdapter: boolean;
  manualWorkflow: boolean;
  ready: boolean;
  status: "disabled" | "ready" | "manual" | "missing-key" | "missing-model" | "adapter-pending";
  message: string;
};

function firstNonEmptyEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export type DeploymentReadiness = {
  runtime: {
    appStorageMode: string;
    vercel: boolean;
    vercelEnv: string;
    vercelGitCommitSha: string;
  };
  supabase: {
    publicUrl: boolean;
    anonKey: boolean;
    serviceRoleKey: boolean;
    readyForServerAdapters: boolean;
    durableRunStateEnabled: boolean;
    providerSettingsEnabled: boolean;
    schema: {
      checked: boolean;
      productionRuns: boolean;
      providerSettings: boolean;
      runApprovals: boolean;
      runArtifacts: boolean;
      appUsers: boolean;
      youtubeChannels: boolean;
      workerJobs: boolean;
    };
  };
  providers: {
    roles: Record<ProviderRoleId, ProviderRoleReadiness>;
    summary: {
      directEnabledCount: number;
      enabledProfileCount: number;
      enabledRoleCount: number;
      manualEnabledCount: number;
      profileCount: number;
      roleCount: number;
      savedKeyCount: number;
    };
    subtitles: {
      enabled: boolean;
      envApiKey: boolean;
      model: string;
      provider: string;
      settingsHasApiKey: boolean;
      settingsSupadataEnabled: boolean;
      supadataReady: boolean;
      message: string;
    };
    youtubeApiKey: boolean;
    youtubeProviderSettings: boolean;
  };
  workers: {
    render: {
      command: string;
      externalRequired: boolean;
      queueTable: boolean;
      ready: boolean;
      requirements: string[];
    };
    youtubeUpload: {
      command: string;
      activeChannelUploadTokenCount: number;
      channelUploadTokenAvailable: boolean;
      channelCount: number;
      externalRequired: boolean;
      oauthClientId: boolean;
      oauthClientSecret: boolean;
      oauthRefreshToken: boolean;
      pausedChannelUploadTokenCount: number;
      queueTable: boolean;
      refreshTokenReady: boolean;
      ready: boolean;
      requirements: string[];
      setupChannelUploadTokenCount: number;
    };
  };
  security: {
    adminToken: boolean;
    envAdminCredential: boolean;
    mutationGate: "unrestricted-local" | "session-protected" | "locked-missing-session-secret";
    sessionSigningSecret: boolean;
  };
  blockers: string[];
  warnings: string[];
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function disabledRoleReadiness(): ProviderRoleReadiness {
  return {
    enabled: false,
    provider: "",
    model: "",
    hasApiKey: false,
    implementedAdapter: false,
    manualWorkflow: false,
    ready: false,
    status: "disabled",
    message: "비활성",
  };
}

function roleReadiness(
  role: ProviderRoleId,
  setting: Awaited<ReturnType<typeof getProviderSettings>>["roles"][ProviderRoleId],
): ProviderRoleReadiness {
  const provider = setting.provider.trim();
  const model = setting.model.trim();
  const hasSettingApiKey = Boolean(setting.apiKey?.trim());
  const hasRuntimeApiKey =
    (role === "subtitles" && provider === "Supadata" && hasEnv("SUPADATA_API_KEY")) ||
    (role === "youtube" && provider === "YouTube Data API" && hasEnv("YOUTUBE_API_KEY"));
  const hasApiKey = hasSettingApiKey || hasRuntimeApiKey;
  const implementedAdapter = hasDirectAdapter(role, provider);
  const manualWorkflow = hasManualWorkflow(provider);
  const capability = getProviderCapability(role, provider);
  const needsApiKey = !(role === "editing" && provider === "FFmpeg Worker");
  const base = {
    enabled: setting.enabled,
    provider,
    model,
    hasApiKey,
    implementedAdapter,
    manualWorkflow,
  };

  if (!setting.enabled) {
    return { ...base, ready: false, status: "disabled", message: "비활성" };
  }
  if (manualWorkflow) {
    return { ...base, ready: true, status: "manual", message: capability.label };
  }
  if (!implementedAdapter) {
    return { ...base, ready: false, status: "adapter-pending", message: capability.label };
  }
  if (needsApiKey && !hasApiKey) {
    return { ...base, ready: false, status: "missing-key", message: "API 키 필요" };
  }
  if (requiresProviderModel(role, provider) && !model) {
    return { ...base, ready: false, status: "missing-model", message: "모델/프리셋 필요" };
  }
  return { ...base, ready: true, status: "ready", message: "직접 실행 가능" };
}

function providerInventorySummary(providerSettings: StoredProviderSettings | null) {
  if (!providerSettings) {
    return {
      directEnabledCount: 0,
      enabledProfileCount: 0,
      enabledRoleCount: 0,
      manualEnabledCount: 0,
      profileCount: 0,
      roleCount: providerRoles.length,
      savedKeyCount: 0,
    };
  }

  const roleSettings = providerRoles.map((role) => providerSettings.roles[role.id]);
  const enabledRoleCount = roleSettings.filter((setting) => setting.enabled).length;
  const enabledProfiles = providerSettings.profiles.filter((profile) => profile.enabled);
  const enabledSettings = [...roleSettings.filter((setting) => setting.enabled), ...enabledProfiles];
  return {
    directEnabledCount: enabledSettings.filter((setting) => hasDirectAdapter(setting.role, setting.provider)).length,
    enabledProfileCount: enabledProfiles.length,
    enabledRoleCount,
    manualEnabledCount: enabledSettings.filter((setting) => hasManualWorkflow(setting.provider)).length,
    profileCount: providerSettings.profiles.length,
    roleCount: providerRoles.length,
    savedKeyCount:
      roleSettings.filter((setting) => setting.apiKey?.trim()).length +
      providerSettings.profiles.filter((profile) => profile.apiKey?.trim()).length,
  };
}

function subtitlesReadiness(providerSettings: StoredProviderSettings | null) {
  const setting = providerSettings
    ? resolvePreferredProviderSetting(providerSettings, "subtitles")
    : null;
  const provider = setting?.provider.trim() ?? "";
  const model = setting?.model.trim() ?? "";
  const envApiKey = hasEnv("SUPADATA_API_KEY");
  const settingsSupadataEnabled =
    Boolean(setting?.enabled) && provider.toLowerCase() === "supadata";
  const settingsHasApiKey = Boolean(setting?.apiKey?.trim());
  const supadataReady = envApiKey || (settingsSupadataEnabled && settingsHasApiKey);
  const message = supadataReady
    ? envApiKey
      ? "SUPADATA_API_KEY 감지"
      : "설정 저장 키 감지"
    : settingsSupadataEnabled
      ? "Supadata API 키 필요"
      : "자막 역할에서 Supadata 선택 필요";

  return {
    enabled: Boolean(setting?.enabled),
    envApiKey,
    model,
    provider,
    settingsHasApiKey,
    settingsSupadataEnabled,
    supadataReady,
    message,
  };
}

async function hasSupabaseTable(table: string) {
  try {
    await supabaseRest(table, { query: { limit: 1, select: "*" } });
    return true;
  } catch (error) {
    if (isSupabaseMissingTableError(error)) {
      return false;
    }
    throw error;
  }
}

export async function getDeploymentReadiness(): Promise<DeploymentReadiness> {
  const appStorageMode = process.env.APP_STORAGE_MODE?.trim() || "local";
  const schema = {
    checked: false,
    productionRuns: false,
    providerSettings: false,
    runApprovals: false,
    runArtifacts: false,
    appUsers: false,
    youtubeChannels: false,
    workerJobs: false,
  };
  const supabase = {
    publicUrl: hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    readyForServerAdapters:
      hasEnv("NEXT_PUBLIC_SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    durableRunStateEnabled: false,
    providerSettingsEnabled: false,
    schema,
  };
  const vercel = Boolean(process.env.VERCEL);
  const envAdminCredential =
    hasEnv("DASHBOARD_ADMIN_PASSWORD") ||
    hasEnv("DASHBOARD_ADMIN_TOKEN") ||
    hasEnv("YIF_ADMIN_TOKEN") ||
    hasEnv("ADMIN_ACCESS_TOKEN");
  const sessionSigningSecret = hasEnv("DASHBOARD_SESSION_SECRET") || envAdminCredential;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (sessionSigningSecret) {
    // Mutating API routes are protected by login sessions when credentials are configured.
  } else if (vercel) {
    blockers.push("DASHBOARD_SESSION_SECRET or DASHBOARD_ADMIN_PASSWORD is missing; production login is locked.");
  } else {
    warnings.push("DASHBOARD_ADMIN_PASSWORD is missing; local login falls back to development-only session settings.");
  }

  if (vercel && appStorageMode === "local") {
    blockers.push("APP_STORAGE_MODE=local is not durable on Vercel serverless runtime.");
  }
  if (appStorageMode === "supabase" && !supabase.readyForServerAdapters) {
    blockers.push("Supabase server adapter mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (appStorageMode === "supabase" && supabase.readyForServerAdapters) {
    try {
      const [
        productionRuns,
        runArtifacts,
        runApprovals,
        providerSettings,
        appUsers,
        youtubeChannels,
        workerJobs,
      ] =
        await Promise.all([
          hasSupabaseTable("production_runs"),
          hasSupabaseTable("run_artifacts"),
          hasSupabaseTable("run_approvals"),
          hasSupabaseTable("provider_settings"),
          hasSupabaseTable("app_users"),
          hasSupabaseTable("youtube_channels"),
          hasSupabaseTable("worker_jobs"),
        ]);
      schema.checked = true;
      schema.productionRuns = productionRuns;
      schema.runArtifacts = runArtifacts;
      schema.runApprovals = runApprovals;
      schema.providerSettings = providerSettings;
      schema.appUsers = appUsers;
      schema.youtubeChannels = youtubeChannels;
      schema.workerJobs = workerJobs;
      supabase.durableRunStateEnabled = productionRuns && runArtifacts && runApprovals;
      supabase.providerSettingsEnabled = providerSettings;
      if (!productionRuns || !runArtifacts || !runApprovals || !providerSettings) {
        blockers.push("Supabase schema is not applied. Run docs/templates/supabase-schema.sql in the Supabase SQL Editor.");
      }
      if (!workerJobs) {
        warnings.push("Supabase worker_jobs table is missing; external worker queue records will fall back to JSON artifacts.");
      }
      if (!appUsers || !youtubeChannels) {
        warnings.push("Supabase auth/channel tables are missing. Run docs/templates/supabase-auth-schema.sql for persistent login and channel management.");
      }
      if (vercel && !envAdminCredential && appUsers) {
        warnings.push("Production login relies on persistent app_users records; keep at least one active admin user.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blockers.push(`Supabase schema check failed: ${message.slice(0, 180)}`);
    }
  }
  if (hasEnv("SUPABASE_SERVICE_ROLE_KEY") && process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    blockers.push("SUPABASE_SERVICE_ROLE_KEY must not equal NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const providerSettings = await getProviderSettings().catch(() => null);
  const providerRoleReadiness = Object.fromEntries(
    providerRoles.map((role) => [
      role.id,
      providerSettings
        ? roleReadiness(role.id, resolvePreferredProviderSetting(providerSettings, role.id))
        : disabledRoleReadiness(),
    ]),
  ) as Record<ProviderRoleId, ProviderRoleReadiness>;
  const youtubeProviderSettings = Boolean(
    providerSettings &&
      resolvePreferredProviderSetting(providerSettings, "youtube").enabled &&
      resolvePreferredProviderSetting(providerSettings, "youtube").apiKey?.trim(),
  );
  const subtitles = subtitlesReadiness(providerSettings);
  const youtubeApiKey = hasEnv("YOUTUBE_API_KEY") || youtubeProviderSettings;
  if (!youtubeApiKey) {
    warnings.push("YOUTUBE_API_KEY is missing; YouTube Finder will need the dashboard provider settings or env var.");
  }
  if (!hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    warnings.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing; browser-side Supabase features should remain disabled.");
  }
  if (appStorageMode === "supabase") {
    warnings.push("Unattended render and YouTube upload jobs require external workers with ffmpeg and YouTube OAuth credentials.");
  }
  const configuredButNotReady = providerRoles
    .map((role) => ({ label: role.label, readiness: providerRoleReadiness[role.id] }))
    .filter(
      (role) =>
        role.readiness.enabled &&
        !role.readiness.ready &&
        role.readiness.status !== "adapter-pending",
    );
  if (configuredButNotReady.length > 0) {
    warnings.push(
      `Enabled provider roles need configuration: ${configuredButNotReady
        .map((role) => `${role.label}(${role.readiness.message})`)
        .join(", ")}.`,
    );
  }
  const youtubeChannels = await listYouTubeChannels().catch(() => []);
  const activeChannelUploadTokenCount = youtubeChannels.filter(
    (channel) => channel.status === "active" && channel.has_upload_refresh_token,
  ).length;
  const setupChannelUploadTokenCount = youtubeChannels.filter(
    (channel) => channel.status === "setup" && channel.has_upload_refresh_token,
  ).length;
  const pausedChannelUploadTokenCount = youtubeChannels.filter(
    (channel) => channel.status === "paused" && channel.has_upload_refresh_token,
  ).length;
  const inactiveChannelUploadTokenCount =
    setupChannelUploadTokenCount + pausedChannelUploadTokenCount;
  const channelUploadTokenAvailable = activeChannelUploadTokenCount > 0;
  const uploadRefreshTokenReady = hasEnv("YOUTUBE_OAUTH_REFRESH_TOKEN") || channelUploadTokenAvailable;
  if (appStorageMode === "supabase" && !uploadRefreshTokenReady) {
    warnings.push(
      "YouTube upload worker needs either YOUTUBE_OAUTH_REFRESH_TOKEN or a selected channel upload refresh token.",
    );
  }
  if (appStorageMode === "supabase" && inactiveChannelUploadTokenCount > 0 && !channelUploadTokenAvailable) {
    warnings.push(
      "Channel upload tokens exist, but no active channel has an upload token. Set the target channel status to active before upload.",
    );
  }

  return {
    runtime: {
      appStorageMode,
      vercel,
      vercelEnv: process.env.VERCEL_ENV ?? "",
      vercelGitCommitSha: firstNonEmptyEnv("VERCEL_GIT_COMMIT_SHA", "YIF_DEPLOYMENT_COMMIT_SHA"),
    },
    supabase,
    providers: {
      roles: providerRoleReadiness,
      summary: providerInventorySummary(providerSettings),
      subtitles,
      youtubeApiKey,
      youtubeProviderSettings,
    },
    workers: {
      render: {
        command: "npm run render:worker -- --poll --confirm RUN_RENDER_WORKER --storage supabase --interval-seconds 15",
        externalRequired: appStorageMode === "supabase",
        queueTable: schema.workerJobs,
        ready: appStorageMode === "supabase" ? supabase.readyForServerAdapters && schema.workerJobs : true,
        requirements: [
          "ffmpeg available on worker PATH",
          "APP_STORAGE_MODE=supabase",
          "NEXT_PUBLIC_SUPABASE_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_ASSETS_BUCKET",
        ],
      },
      youtubeUpload: {
        command:
          "npm run youtube:upload-worker -- --poll --confirm RUN_YOUTUBE_UPLOAD --storage supabase --interval-seconds 15",
        activeChannelUploadTokenCount,
        channelUploadTokenAvailable,
        channelCount: youtubeChannels.length,
        externalRequired: appStorageMode === "supabase",
        oauthClientId: hasEnv("YOUTUBE_OAUTH_CLIENT_ID"),
        oauthClientSecret: hasEnv("YOUTUBE_OAUTH_CLIENT_SECRET"),
        oauthRefreshToken: hasEnv("YOUTUBE_OAUTH_REFRESH_TOKEN"),
        pausedChannelUploadTokenCount,
        queueTable: schema.workerJobs,
        refreshTokenReady: uploadRefreshTokenReady,
        ready:
          appStorageMode === "supabase"
            ? supabase.readyForServerAdapters &&
              schema.workerJobs &&
              hasEnv("YOUTUBE_OAUTH_CLIENT_ID") &&
              hasEnv("YOUTUBE_OAUTH_CLIENT_SECRET") &&
              uploadRefreshTokenReady
            : true,
        requirements: [
          "APP_STORAGE_MODE=supabase",
          "NEXT_PUBLIC_SUPABASE_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_ASSETS_BUCKET",
          "YOUTUBE_OAUTH_CLIENT_ID",
          "YOUTUBE_OAUTH_CLIENT_SECRET",
          "YOUTUBE_OAUTH_REFRESH_TOKEN or youtube_channels.upload_refresh_token for the selected run channel",
        ],
        setupChannelUploadTokenCount,
      },
    },
    security: {
      adminToken: sessionSigningSecret,
      envAdminCredential,
      mutationGate: sessionSigningSecret
        ? "session-protected"
        : vercel
          ? "locked-missing-session-secret"
          : "unrestricted-local",
      sessionSigningSecret,
    },
    blockers,
    warnings,
  };
}
