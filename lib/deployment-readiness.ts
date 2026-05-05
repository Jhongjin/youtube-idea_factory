import { getProviderSettings } from "@/lib/provider-settings";
import { isSupabaseMissingTableError, supabaseRest } from "@/lib/supabase-rest";

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
    };
  };
  providers: {
    youtubeApiKey: boolean;
    youtubeProviderSettings: boolean;
  };
  security: {
    adminToken: boolean;
    mutationGate: "unrestricted-local" | "token-protected" | "locked-missing-token";
  };
  blockers: string[];
  warnings: string[];
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
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
  const adminToken =
    hasEnv("DASHBOARD_ADMIN_TOKEN") || hasEnv("YIF_ADMIN_TOKEN") || hasEnv("ADMIN_ACCESS_TOKEN");
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (adminToken) {
    // Mutating API routes are protected by middleware when a token is configured.
  } else if (vercel) {
    blockers.push("DASHBOARD_ADMIN_TOKEN is missing; production mutation APIs are locked.");
  } else {
    warnings.push("DASHBOARD_ADMIN_TOKEN is missing; local mutation APIs remain unrestricted.");
  }

  if (vercel && appStorageMode === "local") {
    blockers.push("APP_STORAGE_MODE=local is not durable on Vercel serverless runtime.");
  }
  if (appStorageMode === "supabase" && !supabase.readyForServerAdapters) {
    blockers.push("Supabase server adapter mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (appStorageMode === "supabase" && supabase.readyForServerAdapters) {
    try {
      const [productionRuns, runArtifacts, runApprovals, providerSettings] =
        await Promise.all([
          hasSupabaseTable("production_runs"),
          hasSupabaseTable("run_artifacts"),
          hasSupabaseTable("run_approvals"),
          hasSupabaseTable("provider_settings"),
        ]);
      schema.checked = true;
      schema.productionRuns = productionRuns;
      schema.runArtifacts = runArtifacts;
      schema.runApprovals = runApprovals;
      schema.providerSettings = providerSettings;
      supabase.durableRunStateEnabled = productionRuns && runArtifacts && runApprovals;
      supabase.providerSettingsEnabled = providerSettings;
      if (!productionRuns || !runArtifacts || !runApprovals || !providerSettings) {
        blockers.push("Supabase schema is not applied. Run docs/templates/supabase-schema.sql in the Supabase SQL Editor.");
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
    warnings.push("Unattended production rendering requires an external worker to consume render-worker-job.json; final YouTube upload adapter is still pending.");
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
      youtubeApiKey,
      youtubeProviderSettings,
    },
    security: {
      adminToken,
      mutationGate: adminToken
        ? "token-protected"
        : vercel
          ? "locked-missing-token"
          : "unrestricted-local",
    },
    blockers,
    warnings,
  };
}
