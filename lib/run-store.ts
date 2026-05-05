import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppStorageMode } from "@/lib/storage-mode";
import { supabaseEq, supabaseRest } from "@/lib/supabase-rest";
import type { ProductionPackage, RunSummary } from "@/lib/runs";

export type RunFileInfo = {
  size: number;
  updatedAt: string;
};

export type RunWorkspaceInput = {
  createdAt: string;
  files: Record<string, string>;
  id: string;
  package: ProductionPackage;
  status?: string;
};

type ProductionRunRow = {
  category: string | null;
  created_at?: string;
  format: string;
  id: string;
  language: string;
  package: ProductionPackage;
  status: string;
  topic: string;
  updated_at: string;
};

type RunArtifactRow = {
  artifact_key: string;
  content: string | null;
  filename: string;
  metadata?: Record<string, unknown>;
  updated_at: string;
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");

export function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

export function getLocalRunDir(runId: string) {
  assertSafeRunId(runId);
  return path.join(runsDir, runId);
}

export function normalizeRunFilePath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0") || normalized.split("/").includes("..")) {
    throw new Error("Invalid run file path.");
  }
  return normalized;
}

function localRunFilePath(runId: string, filePath: string) {
  const runDir = getLocalRunDir(runId);
  const normalized = normalizeRunFilePath(filePath);
  const resolved = path.resolve(runDir, normalized);
  const root = path.resolve(runDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Run file path must stay inside the run folder.");
  }
  return resolved;
}

async function localExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function packageRow(pkg: ProductionPackage, now: string, status = "needs_review") {
  return {
    category: pkg.brief.category ?? null,
    format: pkg.brief.format,
    id: pkg.run_id,
    language: pkg.brief.language,
    package: pkg,
    status,
    topic: pkg.brief.topic,
    updated_at: now,
  };
}

async function upsertSupabasePackage(pkg: ProductionPackage, status = "needs_review") {
  const now = new Date().toISOString();
  await supabaseRest<ProductionRunRow[]>("production_runs", {
    method: "POST",
    body: packageRow(pkg, now, status),
    query: { on_conflict: "id" },
    prefer: "resolution=merge-duplicates,return=representation",
  });
}

export async function listRunSummaries(): Promise<RunSummary[]> {
  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<ProductionRunRow[]>("production_runs", {
      query: {
        order: "updated_at.desc",
        select: "id,package,updated_at",
      },
    });
    return rows.map((row) => ({
      id: row.id,
      package: row.package,
      path: `supabase:production_runs/${row.id}`,
      updatedAt: row.updated_at,
    }));
  }

  if (!(await localExists(runsDir))) {
    return [];
  }

  const entries = await fs.readdir(runsDir, { withFileTypes: true });
  const runDirs = entries.filter((entry) => entry.isDirectory());
  const runs = await Promise.all(
    runDirs.map(async (entry) => {
      const runPath = path.join(runsDir, entry.name);
      const packagePath = path.join(runPath, "production-package.json");
      if (!(await localExists(packagePath))) {
        return null;
      }

      const [raw, stat] = await Promise.all([
        fs.readFile(packagePath, "utf-8"),
        fs.stat(packagePath),
      ]);

      return {
        id: entry.name,
        path: path.relative(/* turbopackIgnore: true */ process.cwd(), runPath),
        package: JSON.parse(raw) as ProductionPackage,
        updatedAt: stat.mtime.toISOString(),
      };
    }),
  );

  return runs
    .filter((run): run is RunSummary => run !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function runExists(runId: string) {
  assertSafeRunId(runId);
  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<Array<{ id: string }>>("production_runs", {
      query: { id: supabaseEq(runId), limit: 1, select: "id" },
    });
    return rows.length > 0;
  }

  const stat = await fs.stat(getLocalRunDir(runId)).catch(() => null);
  return Boolean(stat?.isDirectory());
}

export async function createRunWorkspace(input: RunWorkspaceInput): Promise<RunSummary> {
  assertSafeRunId(input.id);
  if (getAppStorageMode() === "supabase") {
    await supabaseRest<ProductionRunRow[]>("production_runs", {
      method: "POST",
      body: {
        ...packageRow(input.package, input.createdAt, input.status ?? "needs_review"),
        created_at: input.createdAt,
      },
      prefer: "return=representation",
    });

    const artifactRows = Object.entries(input.files).map(([filePath, content]) => {
      const artifactKey = normalizeRunFilePath(filePath);
      return {
        artifact_key: artifactKey,
        content,
        filename: path.posix.basename(artifactKey),
        metadata: { source: "create-run" },
        run_id: input.id,
        updated_at: input.createdAt,
      };
    });
    if (artifactRows.length > 0) {
      await supabaseRest<RunArtifactRow[]>("run_artifacts", {
        method: "POST",
        body: artifactRows,
        prefer: "return=representation",
      });
    }

    return {
      id: input.id,
      package: input.package,
      path: `supabase:production_runs/${input.id}`,
      updatedAt: input.createdAt,
    };
  }

  const runDir = getLocalRunDir(input.id);
  await fs.mkdir(runDir, { recursive: false });
  await Promise.all(
    Object.entries(input.files).map(async ([filePath, content]) => {
      const outputPath = localRunFilePath(input.id, filePath);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content, "utf-8");
    }),
  );

  return {
    id: input.id,
    package: input.package,
    path: path.relative(/* turbopackIgnore: true */ process.cwd(), runDir),
    updatedAt: input.createdAt,
  };
}

export async function readRunFile(runId: string, filePath: string): Promise<string> {
  const content = await readRunFileIfExists(runId, filePath);
  if (content === null) {
    throw new Error("Run file not found.");
  }
  return content;
}

export async function readRunFileIfExists(
  runId: string,
  filePath: string,
): Promise<string | null> {
  assertSafeRunId(runId);
  const normalized = normalizeRunFilePath(filePath);
  if (getAppStorageMode() === "supabase") {
    if (normalized === "production-package.json") {
      const rows = await supabaseRest<Array<{ package: ProductionPackage }>>("production_runs", {
        query: { id: supabaseEq(runId), limit: 1, select: "package" },
      });
      return rows[0]?.package ? `${JSON.stringify(rows[0].package, null, 2)}\n` : null;
    }

    const rows = await supabaseRest<RunArtifactRow[]>("run_artifacts", {
      query: {
        artifact_key: supabaseEq(normalized),
        limit: 1,
        run_id: supabaseEq(runId),
        select: "content,filename,artifact_key,updated_at,metadata",
      },
    });
    return rows[0]?.content ?? null;
  }

  return fs.readFile(localRunFilePath(runId, normalized), "utf-8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  });
}

export async function writeRunFile(runId: string, filePath: string, content: string) {
  assertSafeRunId(runId);
  const normalized = normalizeRunFilePath(filePath);
  const normalizedContent = content.endsWith("\n") ? content : `${content}\n`;

  if (getAppStorageMode() === "supabase") {
    if (normalized === "production-package.json") {
      await upsertSupabasePackage(JSON.parse(normalizedContent) as ProductionPackage);
    }

    await supabaseRest<RunArtifactRow[]>("run_artifacts", {
      method: "POST",
      body: {
        artifact_key: normalized,
        content: normalizedContent,
        filename: path.posix.basename(normalized),
        metadata: { source: "dashboard" },
        run_id: runId,
        updated_at: new Date().toISOString(),
      },
      query: { on_conflict: "run_id,artifact_key" },
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return;
  }

  const outputPath = localRunFilePath(runId, normalized);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, normalizedContent, "utf-8");
}

export async function readRunJson<T>(runId: string, filePath: string): Promise<T> {
  return JSON.parse(await readRunFile(runId, filePath)) as T;
}

export async function writeRunJson(runId: string, filePath: string, data: unknown) {
  await writeRunFile(runId, filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export async function getRunFileInfo(runId: string, filePath: string): Promise<RunFileInfo | null> {
  assertSafeRunId(runId);
  const normalized = normalizeRunFilePath(filePath);
  if (getAppStorageMode() === "supabase") {
    if (normalized === "production-package.json") {
      const rows = await supabaseRest<Array<{ package: ProductionPackage; updated_at: string }>>(
        "production_runs",
        {
          query: { id: supabaseEq(runId), limit: 1, select: "package,updated_at" },
        },
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        size: Buffer.byteLength(`${JSON.stringify(row.package, null, 2)}\n`, "utf-8"),
        updatedAt: row.updated_at,
      };
    }

    const rows = await supabaseRest<RunArtifactRow[]>("run_artifacts", {
      query: {
        artifact_key: supabaseEq(normalized),
        limit: 1,
        run_id: supabaseEq(runId),
        select: "content,filename,artifact_key,updated_at",
      },
    });
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      size: Buffer.byteLength(row.content ?? "", "utf-8"),
      updatedAt: row.updated_at,
    };
  }

  const stat = await fs.stat(localRunFilePath(runId, normalized)).catch(() => null);
  return stat ? { size: stat.size, updatedAt: stat.mtime.toISOString() } : null;
}

