import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppStorageMode } from "@/lib/storage-mode";
import { hasSupabaseServerConfig } from "@/lib/supabase-rest";

type SupabaseStorageUri = {
  bucket: string;
  objectPath: string;
};

const artifactsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "artifacts");
const defaultBucket = "youtube-assets";

function getSupabaseStorageConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return {
    bucket: process.env.SUPABASE_ASSETS_BUCKET?.trim() || defaultBucket,
    serviceRoleKey,
    url: url.replace(/\/+$/, ""),
  };
}

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function encodeObjectPath(objectPath: string) {
  return objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeObjectPath(runId: string, assetPath: string) {
  assertSafeRunId(runId);
  const normalized = assetPath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0") || normalized.split("/").includes("..")) {
    throw new Error("Invalid asset path.");
  }
  if (!normalized.startsWith(`artifacts/${runId}/`)) {
    throw new Error("Asset path must stay inside artifacts/:runId.");
  }
  return normalized;
}

function localAssetPath(runId: string, assetPath: string) {
  const normalized = normalizeObjectPath(runId, assetPath);
  const root = path.join(artifactsDir, runId);
  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), normalized);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Asset path must stay inside artifacts/:runId.");
  }
  return resolved;
}

function parseStorageUri(value: string): SupabaseStorageUri | null {
  if (!value.startsWith("supabase://")) {
    return null;
  }
  const rest = value.slice("supabase://".length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex < 1 || slashIndex === rest.length - 1) {
    throw new Error("Invalid Supabase Storage URI.");
  }
  return {
    bucket: rest.slice(0, slashIndex),
    objectPath: rest.slice(slashIndex + 1),
  };
}

function storageUri(bucket: string, objectPath: string) {
  return `supabase://${bucket}/${objectPath}`;
}

async function supabaseStorageRequest(
  pathSuffix: string,
  init: RequestInit & { okStatuses?: number[] } = {},
) {
  const { serviceRoleKey, url } = getSupabaseStorageConfig();
  const { okStatuses, ...fetchInit } = init;
  const response = await fetch(`${url}/storage/v1/${pathSuffix}`, {
    ...fetchInit,
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      ...(init.headers ?? {}),
    },
  });
  const allowedStatuses = okStatuses ?? [200, 201, 204];
  if (!allowedStatuses.includes(response.status)) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase Storage ${response.status}: ${text.slice(0, 300)}`);
  }
  return response;
}

async function ensureBucket() {
  const { bucket } = getSupabaseStorageConfig();
  const encodedBucket = encodeURIComponent(bucket);
  const existing = await supabaseStorageRequest(`bucket/${encodedBucket}`, {
    method: "GET",
    okStatuses: [200, 404],
  });
  if (existing.status === 200) {
    return bucket;
  }

  await supabaseStorageRequest("bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    okStatuses: [200, 201, 409],
  });
  return bucket;
}

export function getConfiguredAssetBucket() {
  return process.env.SUPABASE_ASSETS_BUCKET?.trim() || defaultBucket;
}

export function hasSupabaseAssetStorageConfig() {
  return hasSupabaseServerConfig();
}

export async function writeAssetBytes(
  runId: string,
  assetPath: string,
  bytes: Buffer,
  contentType: string,
) {
  if (getAppStorageMode() === "supabase") {
    const bucket = await ensureBucket();
    const objectPath = normalizeObjectPath(runId, assetPath);
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    await supabaseStorageRequest(`object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`, {
      method: "PUT",
      headers: {
        "Cache-Control": "3600",
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body,
    });
    return storageUri(bucket, objectPath);
  }

  const outputPath = localAssetPath(runId, assetPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);
  return normalizeObjectPath(runId, assetPath);
}

export async function assetExists(runId: string, assetPath: string) {
  if (!assetPath.trim()) {
    return false;
  }

  if (getAppStorageMode() === "supabase") {
    const parsed = parseStorageUri(assetPath);
    const bucket = parsed?.bucket ?? getConfiguredAssetBucket();
    const objectPath = parsed?.objectPath ?? normalizeObjectPath(runId, assetPath);
    const response = await supabaseStorageRequest(
      `object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`,
      {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        okStatuses: [200, 206, 404],
      },
    );
    return response.status !== 404;
  }

  const stat = await fs.stat(localAssetPath(runId, assetPath)).catch(() => null);
  return Boolean(stat?.isFile());
}

export async function normalizeRegisteredAssetPath(runId: string, assetPath: string) {
  if (getAppStorageMode() === "supabase") {
    const parsed = parseStorageUri(assetPath);
    if (parsed) {
      if (!(await assetExists(runId, assetPath))) {
        throw new Error(`Registered Supabase asset does not exist: ${assetPath}`);
      }
      return storageUri(parsed.bucket, parsed.objectPath);
    }

    const objectPath = normalizeObjectPath(runId, assetPath);
    const uri = storageUri(getConfiguredAssetBucket(), objectPath);
    if (!(await assetExists(runId, uri))) {
      throw new Error(`Registered Supabase asset does not exist: ${uri}`);
    }
    return uri;
  }

  const resolved = localAssetPath(runId, assetPath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`Registered asset file does not exist: ${assetPath}`);
  }
  return normalizeObjectPath(runId, assetPath);
}
