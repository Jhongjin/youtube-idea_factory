import { promises as fs } from "node:fs";
import path from "node:path";

export type SourceVideo = {
  rank?: number;
  url: string;
  title: string;
  channel?: string;
  view_count?: number;
  published_at?: string;
  inclusion_reason: string;
  transcript_status?: string;
  video_id?: string;
};

export type ProductionPackage = {
  run_id: string;
  brief: {
    topic: string;
    category?: string;
    format: string;
    target_audience?: string;
    target_duration_seconds?: number;
    language: string;
    tone?: string;
  };
  sources: SourceVideo[];
  claim_ledger: unknown[];
  script_plan: {
    angle: string;
    hook: string;
    outline: string[];
    notes?: string;
  };
  storyboard: unknown[];
  media_prompts: {
    style_bible?: string;
    image_prompts?: unknown[];
    video_prompts?: unknown[];
  };
  publishing_package: {
    title_candidates?: string[];
    description?: string;
    tags?: string[];
    thumbnail_prompt?: string;
  };
  qa: {
    status: "pass" | "blocked" | "needs_review";
    blockers: string[];
    warnings?: string[];
    fix_list?: string[];
    approval_checklist?: string[];
    publish_readiness?: "ready" | "not ready" | "render-only ready";
    approval_required?: boolean;
  };
};

export type RunSummary = {
  id: string;
  path: string;
  package: ProductionPackage;
  updatedAt: string;
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getRuns(): Promise<RunSummary[]> {
  if (!(await exists(runsDir))) {
    return [];
  }

  const entries = await fs.readdir(runsDir, { withFileTypes: true });
  const runDirs = entries.filter((entry) => entry.isDirectory());
  const runs = await Promise.all(
    runDirs.map(async (entry) => {
      const runPath = path.join(runsDir, entry.name);
      const packagePath = path.join(runPath, "production-package.json");
      if (!(await exists(packagePath))) {
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

export function getStageState(pkg: ProductionPackage) {
  return [
    {
      name: "Intake",
      meta: pkg.brief.topic,
      status: "done" as const,
    },
    {
      name: "Research",
      meta: `${pkg.sources.length} source video${pkg.sources.length === 1 ? "" : "s"}`,
      status: pkg.sources.length > 0 ? ("review" as const) : ("pending" as const),
    },
    {
      name: "Video Analysis",
      meta: "Competitor structure and hook teardown",
      status: "pending" as const,
    },
    {
      name: "Fact Check",
      meta: `${pkg.claim_ledger.length} claim${pkg.claim_ledger.length === 1 ? "" : "s"}`,
      status: pkg.claim_ledger.length > 0 ? ("review" as const) : ("blocked" as const),
    },
    {
      name: "Script",
      meta: pkg.script_plan.hook,
      status: pkg.script_plan.outline.length > 0 ? ("review" as const) : ("pending" as const),
    },
    {
      name: "Storyboard",
      meta: `${pkg.storyboard.length} scene${pkg.storyboard.length === 1 ? "" : "s"}`,
      status: pkg.storyboard.length > 0 ? ("review" as const) : ("pending" as const),
    },
    {
      name: "Media Prompts",
      meta: `${pkg.media_prompts.image_prompts?.length ?? 0} image, ${
        pkg.media_prompts.video_prompts?.length ?? 0
      } video`,
      status:
        (pkg.media_prompts.image_prompts?.length ?? 0) +
          (pkg.media_prompts.video_prompts?.length ?? 0) >
        0
          ? ("review" as const)
          : ("pending" as const),
    },
    {
      name: "Publishing",
      meta: `${pkg.publishing_package.title_candidates?.length ?? 0} title candidate${
        (pkg.publishing_package.title_candidates?.length ?? 0) === 1 ? "" : "s"
      }`,
      status:
        (pkg.publishing_package.title_candidates?.length ?? 0) > 0
          ? ("review" as const)
          : ("pending" as const),
    },
    {
      name: "QA",
      meta: `${pkg.qa.blockers.length} blocker${pkg.qa.blockers.length === 1 ? "" : "s"}`,
      status:
        pkg.qa.status === "pass"
          ? ("done" as const)
          : pkg.qa.status === "blocked"
            ? ("blocked" as const)
            : ("review" as const),
    },
  ];
}
