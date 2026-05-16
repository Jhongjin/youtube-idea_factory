import {
  getProviderCapability,
  hasDirectAdapter,
  hasManualWorkflow,
  requiresProviderModel,
} from "@/lib/provider-capabilities";
import { getProviderSettings } from "@/lib/provider-settings";
import { providerRoles, type ProviderRoleId } from "@/lib/provider-settings-shared";
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
      externalRequired: boolean;
      oauthClientId: boolean;
      oauthClientSecret: boolean;
      oauthRefreshToken: boolean;
      queueTable: boolean;
      ready: boolean;
      requirements: string[];
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
  const hasApiKey = Boolean(setting.apiKey?.trim());
  const implementedAdapter = hasDirectAdapter(role, provider);
  const manualWorkflow = hasManualWorkflow(provider);
  const capability = getProviderCapability(role, provider);
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
  if (!hasApiKey) {
    return { ...base, ready: false, status: "missing-key", message: "API 키 필요" };
  }
  if (requiresProviderModel(role, provider) && !model) {
    return { ...base, ready: false, status: "missing-model", message: "모델/프리셋 필요" };
  }
  return { ...base, ready: true, status: "ready", message: "직접 실행 가능" };
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
        ? roleReadiness(role.id, providerSettings.roles[role.id])
        : disabledRoleReadiness(),
    ]),
  ) as Record<ProviderRoleId, ProviderRoleReadiness>;
  const youtubeProviderSettings = Boolean(
    providerSettings?.roles.youtube.enabled &&
      providerSettings.roles.youtube.apiKey?.trim(),
  );
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

  return {
    runtime: {
      appStorageMode,
      vercel,
      vercelEnv: process.env.VERCEL_ENV ?? "",
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    },
    supabase,
    providers: {
      roles: providerRoleReadiness,
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
        externalRequired: appStorageMode === "supabase",
        oauthClientId: hasEnv("YOUTUBE_OAUTH_CLIENT_ID"),
        oauthClientSecret: hasEnv("YOUTUBE_OAUTH_CLIENT_SECRET"),
        oauthRefreshToken: hasEnv("YOUTUBE_OAUTH_REFRESH_TOKEN"),
        queueTable: schema.workerJobs,
        ready:
          appStorageMode === "supabase"
            ? supabase.readyForServerAdapters &&
              schema.workerJobs &&
              hasEnv("YOUTUBE_OAUTH_CLIENT_ID") &&
              hasEnv("YOUTUBE_OAUTH_CLIENT_SECRET") &&
              hasEnv("YOUTUBE_OAUTH_REFRESH_TOKEN")
            : true,
        requirements: [
          "APP_STORAGE_MODE=supabase",
          "NEXT_PUBLIC_SUPABASE_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_ASSETS_BUCKET",
          "YOUTUBE_OAUTH_CLIENT_ID",
          "YOUTUBE_OAUTH_CLIENT_SECRET",
          "YOUTUBE_OAUTH_REFRESH_TOKEN",
        ],
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
