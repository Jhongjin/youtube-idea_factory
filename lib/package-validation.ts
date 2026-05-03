import type { ProductionPackage } from "@/lib/runs";

export type PackageValidationResult = {
  status: "pass" | "fail";
  failures: string[];
  summary: {
    sources: number;
    claims: number;
    scenes: number;
    imagePrompts: number;
    videoPrompts: number;
    qaStatus: string;
  };
};

const rootRequired = [
  "run_id",
  "brief",
  "sources",
  "claim_ledger",
  "script_plan",
  "storyboard",
  "media_prompts",
  "publishing_package",
  "qa",
];
const briefRequired = ["topic", "format", "language"];
const sourceRequired = ["url", "title", "inclusion_reason"];
const scriptRequired = ["angle", "hook", "outline"];
const claimStatuses = new Set(["supported", "needs_evidence", "opinion", "high_risk", "do_not_use"]);
const qaStatuses = new Set(["pass", "blocked", "needs_review"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addMissing(
  failures: string[],
  obj: Record<string, unknown>,
  keys: string[],
  label: string,
) {
  for (const key of keys) {
    if (!(key in obj)) {
      failures.push(`${label} missing required key: ${key}`);
    }
  }
}

export function validateProductionPackage(pkg: unknown): PackageValidationResult {
  const failures: string[] = [];

  if (!isRecord(pkg)) {
    return {
      status: "fail",
      failures: ["package must be an object"],
      summary: {
        sources: 0,
        claims: 0,
        scenes: 0,
        imagePrompts: 0,
        videoPrompts: 0,
        qaStatus: "unknown",
      },
    };
  }

  addMissing(failures, pkg, rootRequired, "package");

  if (isRecord(pkg.brief)) {
    addMissing(failures, pkg.brief, briefRequired, "brief");
  } else {
    failures.push("brief must be an object");
  }

  if (Array.isArray(pkg.sources)) {
    if (pkg.sources.length === 0) {
      failures.push("sources must contain at least one source video");
    }
    pkg.sources.forEach((source, index) => {
      if (!isRecord(source)) {
        failures.push(`sources[${index + 1}] must be an object`);
        return;
      }
      addMissing(failures, source, sourceRequired, `sources[${index + 1}]`);
    });
  } else {
    failures.push("sources must be an array");
  }

  if (Array.isArray(pkg.claim_ledger)) {
    pkg.claim_ledger.forEach((claim, index) => {
      if (!isRecord(claim)) {
        failures.push(`claim_ledger[${index + 1}] must be an object`);
        return;
      }
      if (!claimStatuses.has(String(claim.status))) {
        failures.push(`claim_ledger[${index + 1}] has invalid status: ${String(claim.status)}`);
      }
    });
  } else {
    failures.push("claim_ledger must be an array");
  }

  if (isRecord(pkg.script_plan)) {
    addMissing(failures, pkg.script_plan, scriptRequired, "script_plan");
    if ("outline" in pkg.script_plan && !Array.isArray(pkg.script_plan.outline)) {
      failures.push("script_plan.outline must be an array");
    }
  } else {
    failures.push("script_plan must be an object");
  }

  if (!Array.isArray(pkg.storyboard)) {
    failures.push("storyboard must be an array");
  }

  if (isRecord(pkg.media_prompts)) {
    if ("image_prompts" in pkg.media_prompts && !Array.isArray(pkg.media_prompts.image_prompts)) {
      failures.push("media_prompts.image_prompts must be an array");
    }
    if ("video_prompts" in pkg.media_prompts && !Array.isArray(pkg.media_prompts.video_prompts)) {
      failures.push("media_prompts.video_prompts must be an array");
    }
  } else {
    failures.push("media_prompts must be an object");
  }

  if (!isRecord(pkg.publishing_package)) {
    failures.push("publishing_package must be an object");
  }

  if (isRecord(pkg.qa)) {
    if (!qaStatuses.has(String(pkg.qa.status))) {
      failures.push(`qa.status must be one of ${Array.from(qaStatuses).join(", ")}`);
    }
    if (!Array.isArray(pkg.qa.blockers)) {
      failures.push("qa.blockers must be an array");
    }
  } else {
    failures.push("qa must be an object");
  }

  const typed = pkg as Partial<ProductionPackage>;
  return {
    status: failures.length > 0 ? "fail" : "pass",
    failures,
    summary: {
      sources: Array.isArray(typed.sources) ? typed.sources.length : 0,
      claims: Array.isArray(typed.claim_ledger) ? typed.claim_ledger.length : 0,
      scenes: Array.isArray(typed.storyboard) ? typed.storyboard.length : 0,
      imagePrompts: Array.isArray(typed.media_prompts?.image_prompts)
        ? typed.media_prompts.image_prompts.length
        : 0,
      videoPrompts: Array.isArray(typed.media_prompts?.video_prompts)
        ? typed.media_prompts.video_prompts.length
        : 0,
      qaStatus: typeof typed.qa?.status === "string" ? typed.qa.status : "unknown",
    },
  };
}

