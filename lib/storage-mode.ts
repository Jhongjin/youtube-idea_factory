export type AppStorageMode = "local" | "supabase";

export function getAppStorageMode(): AppStorageMode {
  const mode = process.env.APP_STORAGE_MODE?.trim().toLowerCase();
  return mode === "supabase" ? "supabase" : "local";
}

export function isSupabaseStorageMode() {
  return getAppStorageMode() === "supabase";
}

