type SupabaseRestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
  query?: Record<string, string | number | boolean | undefined>;
};

export function hasSupabaseServerConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return { serviceRoleKey, url: url.replace(/\/+$/, "") };
}

export function supabaseEq(value: string) {
  return `eq.${value}`;
}

export function isSupabaseMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("PGRST205") || message.includes("Could not find the table");
}

export async function supabaseRest<T>(
  table: string,
  options: SupabaseRestOptions = {},
): Promise<T> {
  const { serviceRoleKey, url } = getSupabaseServerConfig();
  const endpoint = new URL(`${url}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      endpoint.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(endpoint, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${table} ${response.status}: ${text.slice(0, 300)}`);
  }

  if (!text) {
    return null as T;
  }
  return JSON.parse(text) as T;
}
