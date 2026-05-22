#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { loadLocalEnv } from "./load-local-env.mjs";
import { warnIfInsecureTls } from "./runtime-warnings.mjs";

loadLocalEnv();
warnIfInsecureTls();

const execFileAsync = promisify(execFile);
const root = process.cwd();
const localChannelStorePath = path.join(root, "config", "youtube-channels.local.json");

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

function normalizeStorageMode(value) {
  const mode = String(value || "local").trim().toLowerCase();
  return mode === "supabase" ? "supabase" : "local";
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return null;
  }
  return { key, url };
}

async function supabaseRequest(pathSuffix) {
  const config = supabaseConfig();
  if (!config) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const response = await fetch(`${config.url}/${pathSuffix}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.key}`,
      apikey: config.key,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 260)}`);
  }
  return response.json();
}

function isMissingSupabaseTable(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("PGRST205") || message.includes("Could not find the table");
}

async function checkFfmpeg() {
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
    const firstLine = stdout.split(/\r?\n/u)[0] || "ffmpeg available";
    return { ok: true, detail: firstLine };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "ffmpeg was not found on PATH.",
    };
  }
}

async function checkSupabaseWorkerJobs() {
  if (!supabaseConfig()) {
    return { ok: false, detail: "Supabase URL/service role key missing." };
  }
  try {
    await supabaseRequest("rest/v1/worker_jobs?select=id&limit=1");
    return { ok: true, detail: "worker_jobs reachable" };
  } catch (error) {
    if (isMissingSupabaseTable(error)) {
      return { ok: false, detail: "worker_jobs table missing" };
    }
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function countSupabaseUploadTokens() {
  if (!supabaseConfig()) {
    return { active: 0, total: 0, detail: "Supabase URL/service role key missing." };
  }
  try {
    const rows = await supabaseRequest(
      "rest/v1/youtube_channels?select=id,status,upload_refresh_token",
    );
    const withToken = rows.filter((channel) => String(channel.upload_refresh_token ?? "").trim());
    return {
      active: withToken.filter((channel) => channel.status === "active").length,
      total: withToken.length,
      detail: `${withToken.filter((channel) => channel.status === "active").length}/${withToken.length} active upload tokens`,
    };
  } catch (error) {
    if (isMissingSupabaseTable(error)) {
      return { active: 0, total: 0, detail: "youtube_channels table missing" };
    }
    return { active: 0, total: 0, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function countLocalUploadTokens() {
  const raw = await fs.readFile(localChannelStorePath, "utf-8").catch((error) => {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  if (!raw) {
    return { active: 0, total: 0, detail: "no local channel store" };
  }
  const parsed = JSON.parse(raw);
  const channels = Array.isArray(parsed.channels) ? parsed.channels : [];
  const withToken = channels.filter((channel) => String(channel.upload_refresh_token ?? "").trim());
  return {
    active: withToken.filter((channel) => channel.status === "active").length,
    total: withToken.length,
    detail: `${withToken.filter((channel) => channel.status === "active").length}/${withToken.length} active upload tokens`,
  };
}

function printCheck(label, check) {
  const mark = check.ok ? "ok" : "needs action";
  console.log(`  [${mark}] ${label}: ${check.detail}`);
}

function printCommands(storageMode) {
  console.log("\nWorker commands");
  console.log(
    `  Render poll: npm run render:worker -- --poll --confirm RUN_RENDER_WORKER --storage ${storageMode} --interval-seconds 15`,
  );
  console.log(
    `  Upload poll: npm run youtube:upload-worker -- --poll --confirm RUN_YOUTUBE_UPLOAD --storage ${storageMode} --interval-seconds 15`,
  );
  console.log(`  Queue status: npm run ops:status -- --storage ${storageMode}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const storageMode = normalizeStorageMode(args.storage || process.env.APP_STORAGE_MODE);
  const ffmpeg = await checkFfmpeg();
  const queue =
    storageMode === "supabase"
      ? await checkSupabaseWorkerJobs()
      : { ok: true, detail: "local worker-jobs.json queue" };
  const uploadTokens =
    storageMode === "supabase" ? await countSupabaseUploadTokens() : await countLocalUploadTokens();
  const oauth = {
    clientId: hasEnv("YOUTUBE_OAUTH_CLIENT_ID"),
    clientSecret: hasEnv("YOUTUBE_OAUTH_CLIENT_SECRET"),
    globalRefreshToken: hasEnv("YOUTUBE_OAUTH_REFRESH_TOKEN"),
  };
  const supabaseEnv = {
    anonKey: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    assetsBucket: hasEnv("SUPABASE_ASSETS_BUCKET"),
    serviceRoleKey: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    url: hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
  };
  const supabaseReady =
    storageMode === "local" || (supabaseEnv.url && supabaseEnv.serviceRoleKey && queue.ok);
  const uploadRefreshReady = oauth.globalRefreshToken || uploadTokens.active > 0;
  const renderReady = ffmpeg.ok && supabaseReady;
  const uploadReady = supabaseReady && oauth.clientId && oauth.clientSecret && uploadRefreshReady;
  const summary = {
    storageMode,
    renderReady,
    uploadReady,
    queueReady: queue.ok,
    activeChannelUploadTokenCount: uploadTokens.active,
    uploadTokenCount: uploadTokens.total,
  };

  if (args.json === "true") {
    console.log(JSON.stringify({ summary, ffmpeg, oauth, queue, supabaseEnv, uploadTokens }, null, 2));
  } else {
    console.log("Worker doctor");
    console.log(JSON.stringify(summary, null, 2));
    printCheck("ffmpeg", ffmpeg);
    printCheck("worker queue", queue);
    if (storageMode === "supabase") {
      printCheck("Supabase URL", { ok: supabaseEnv.url, detail: supabaseEnv.url ? "set" : "missing" });
      printCheck("Supabase service role", {
        ok: supabaseEnv.serviceRoleKey,
        detail: supabaseEnv.serviceRoleKey ? "set" : "missing",
      });
      printCheck("Supabase assets bucket", {
        ok: supabaseEnv.assetsBucket,
        detail: supabaseEnv.assetsBucket ? "set" : "missing; defaults to youtube-assets",
      });
    }
    printCheck("YouTube OAuth client", {
      ok: oauth.clientId && oauth.clientSecret,
      detail: oauth.clientId && oauth.clientSecret ? "client id/secret set" : "client id or secret missing",
    });
    printCheck("YouTube upload refresh token", {
      ok: uploadRefreshReady,
      detail: oauth.globalRefreshToken ? "global refresh token set" : uploadTokens.detail,
    });
    printCommands(storageMode);
  }

  if (args.strict === "true" && (!renderReady || !uploadReady)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
