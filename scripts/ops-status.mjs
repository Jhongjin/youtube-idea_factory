#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const root = process.cwd();
const runsDir = path.join(root, "runs");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must start with https://.");
  }
  return { key, url };
}

async function supabaseRequest(pathSuffix) {
  const { key, url } = supabaseConfig();
  let response;
  try {
    response = await fetch(`${url}/${pathSuffix}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
    const code =
      cause && "code" in cause && typeof cause.code === "string" ? ` (${cause.code})` : "";
    throw new Error(
      [
        `Supabase request failed${code}: ${cause?.message ?? (error instanceof Error ? error.message : String(error))}`,
        "Check local network/TLS certificates and confirm the PowerShell env vars are set in this terminal.",
      ].join("\n"),
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

async function listSupabaseRuns(limit) {
  const query = new URLSearchParams({
    limit: String(limit),
    order: "updated_at.desc",
    select: "id,topic,category,format,status,updated_at",
  });
  return supabaseRequest(`rest/v1/production_runs?${query}`);
}

async function listSupabaseJobs(limit) {
  const query = new URLSearchParams({
    limit: String(limit),
    order: "updated_at.desc",
    select: "id,run_id,kind,status,attempts,last_error,job_artifact_key,queued_at,updated_at",
  });
  return supabaseRequest(`rest/v1/worker_jobs?${query}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listLocalRuns(limit) {
  if (!(await fileExists(runsDir))) {
    return [];
  }
  const entries = await fs.readdir(runsDir, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packagePath = path.join(runsDir, entry.name, "production-package.json");
    if (!(await fileExists(packagePath))) {
      continue;
    }
    const [raw, stat] = await Promise.all([fs.readFile(packagePath, "utf-8"), fs.stat(packagePath)]);
    const pkg = JSON.parse(raw);
    runs.push({
      category: pkg.brief?.category ?? "",
      format: pkg.brief?.format ?? "",
      id: entry.name,
      status: pkg.qa?.status ?? "needs_review",
      topic: pkg.brief?.topic ?? "",
      updated_at: stat.mtime.toISOString(),
    });
  }
  return runs.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit);
}

async function listLocalJobs(limit) {
  const runs = await listLocalRuns(1000);
  const jobs = [];
  for (const run of runs) {
    const queuePath = path.join(runsDir, run.id, "worker-jobs.json");
    if (!(await fileExists(queuePath))) {
      continue;
    }
    const parsed = JSON.parse(await fs.readFile(queuePath, "utf-8"));
    if (Array.isArray(parsed)) {
      jobs.push(...parsed);
    }
  }
  return jobs
    .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))
    .slice(0, limit);
}

function clip(value, length) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function printRows(title, rows, columns, emptyMessage) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log(`  ${emptyMessage}`);
    return;
  }
  for (const row of rows) {
    console.log(
      `  ${columns
        .map((column) => `${column.label}: ${clip(row[column.key], column.width ?? 40)}`)
        .join(" | ")}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const storageMode = args.storage ?? process.env.APP_STORAGE_MODE ?? "local";
  const limit = Math.max(1, Math.min(Number(args.limit ?? 8), 50));

  const [runs, jobs] =
    storageMode === "supabase"
      ? await Promise.all([listSupabaseRuns(limit), listSupabaseJobs(limit)])
      : await Promise.all([listLocalRuns(limit), listLocalJobs(limit)]);

  const queuedJobs = jobs.filter((job) => job.status === "queued");
  const runningJobs = jobs.filter((job) => job.status === "running");

  console.log(
    JSON.stringify(
      {
        storageMode,
        runCount: runs.length,
        recentJobCount: jobs.length,
        queuedJobCount: queuedJobs.length,
        runningJobCount: runningJobs.length,
      },
      null,
      2,
    ),
  );

  printRows(
    "Recent runs",
    runs,
    [
      { key: "id", label: "run-id", width: 42 },
      { key: "topic", label: "topic", width: 36 },
      { key: "status", label: "status", width: 16 },
      { key: "updated_at", label: "updated", width: 26 },
    ],
    "No runs found.",
  );

  printRows(
    "Recent worker jobs",
    jobs,
    [
      { key: "kind", label: "kind", width: 16 },
      { key: "status", label: "status", width: 14 },
      { key: "run_id", label: "run-id", width: 42 },
      { key: "last_error", label: "last-error", width: 40 },
    ],
    "No worker jobs found.",
  );

  const firstRunId = runs[0]?.id;
  if (firstRunId) {
    console.log("\nUse a real run id like this:");
    console.log(
      `  npm run youtube:upload-worker -- --run-id ${firstRunId} --confirm RUN_YOUTUBE_UPLOAD --storage ${storageMode} --dry-run`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.error("Warning: NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS certificate verification.");
  }
  process.exitCode = 1;
});
