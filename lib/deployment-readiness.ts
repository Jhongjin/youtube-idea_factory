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
  };
  providers: {
    youtubeApiKey: boolean;
  };
  blockers: string[];
  warnings: string[];
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function getDeploymentReadiness(): DeploymentReadiness {
  const appStorageMode = process.env.APP_STORAGE_MODE?.trim() || "local";
  const supabase = {
    publicUrl: hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    readyForServerAdapters:
      hasEnv("NEXT_PUBLIC_SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    durableRunStateEnabled: appStorageMode === "supabase",
    providerSettingsEnabled: appStorageMode === "supabase",
  };
  const vercel = Boolean(process.env.VERCEL);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (vercel && appStorageMode === "local") {
    blockers.push("APP_STORAGE_MODE=local is not durable on Vercel serverless runtime.");
  }
  if (appStorageMode === "supabase" && !supabase.readyForServerAdapters) {
    blockers.push("Supabase server adapter mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (hasEnv("SUPABASE_SERVICE_ROLE_KEY") && process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    blockers.push("SUPABASE_SERVICE_ROLE_KEY must not equal NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (!hasEnv("YOUTUBE_API_KEY")) {
    warnings.push("YOUTUBE_API_KEY is missing; YouTube Finder will need the dashboard provider settings or env var.");
  }
  if (!hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    warnings.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing; browser-side Supabase features should remain disabled.");
  }
  if (appStorageMode === "supabase") {
    warnings.push("Generated binary media and local ffmpeg rendering still need object storage or a render worker before unattended production use.");
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
      youtubeApiKey: hasEnv("YOUTUBE_API_KEY"),
    },
    blockers,
    warnings,
  };
}
