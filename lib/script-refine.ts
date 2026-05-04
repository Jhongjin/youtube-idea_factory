import { promises as fs } from "node:fs";
import path from "node:path";
import { generateLlmText } from "@/lib/llm-adapter";
import type { ProductionPackage } from "@/lib/runs";

export type ScriptRefineResult = {
  provider: string;
  model: string;
  responseId?: string;
  file: string;
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function truncate(content: string, limit: number) {
  return content.length > limit ? `${content.slice(0, limit)}\n\n[TRUNCATED]` : content;
}

function buildInstructions(pkg: ProductionPackage) {
  return `You are the script architect for a YouTube production dashboard.

Return a complete Markdown replacement for 04-script-plan.md.

Rules:
- Write primarily in Korean when the run language is "ko"; otherwise use the run language.
- Keep the existing evidence discipline: do not present needs_evidence, high_risk, or do_not_use claims as facts.
- If facts are unresolved, reframe them as questions, assumptions to verify, or excluded material.
- Transform competitor patterns without copying titles, thumbnail layouts, wording, or scene order.
- Make the hook, beat map, narration draft, revision checklist, and storyboard handoff concrete.
- Keep paid generation, render, and publishing behind explicit human approval.
- Do not invent source links, view counts, dates, statistics, studies, or quotes.

Run:
- Topic: ${pkg.brief.topic}
- Category: ${pkg.brief.category ?? ""}
- Format: ${pkg.brief.format}
- Target audience: ${pkg.brief.target_audience ?? ""}
- Target duration: ${pkg.brief.target_duration_seconds ?? 60} seconds
- Tone: ${pkg.brief.tone ?? ""}
`;
}

function buildInput({
  pkg,
  analysis,
  claimLedger,
  currentScript,
}: {
  pkg: ProductionPackage;
  analysis: string;
  claimLedger: string;
  currentScript: string;
}) {
  return `Brief JSON:

${JSON.stringify(pkg.brief, null, 2)}

Source videos:

${JSON.stringify(pkg.sources, null, 2)}

Current 02-video-analysis.md:

${truncate(analysis, 7000)}

Current 03-claim-ledger.md:

${truncate(claimLedger, 5000)}

Current 04-script-plan.md:

${truncate(currentScript, 9000)}

Create an improved 04-script-plan.md with these sections:

# 04 Script Plan
## LLM Refinement Metadata
## Script Strategy
## Source Context
## Angle Candidates
## Hook Options
## Recommended Opening
## Beat Map
## Claim Handling
## Narration Draft
## Storyboard Handoff
## Revision Checklist
`;
}

export async function refineScriptWithLlm(runId: string): Promise<ScriptRefineResult> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const pkg = await loadJson<ProductionPackage>(packagePath);
  const [analysis, claimLedger, currentScript] = await Promise.all([
    fs.readFile(path.join(runDir, "02-video-analysis.md"), "utf-8").catch(() => ""),
    fs.readFile(path.join(runDir, "03-claim-ledger.md"), "utf-8").catch(() => ""),
    fs.readFile(path.join(runDir, "04-script-plan.md"), "utf-8").catch(() => ""),
  ]);

  const result = await generateLlmText({
    task: "youtube-script-refine",
    instructions: buildInstructions(pkg),
    input: buildInput({ pkg, analysis, claimLedger, currentScript }),
  });
  const generatedAt = new Date().toISOString();
  const markdown = `${result.text.trim()}

---

LLM refinement record:

- Generated at: ${generatedAt}
- Provider: ${result.provider}
- Model: ${result.model}
- Response ID: ${result.responseId ?? ""}
- Human review required before storyboard, media generation, render, or publishing.
`;

  pkg.script_plan = {
    ...pkg.script_plan,
    notes: `LLM-refined script plan generated at ${generatedAt} with ${result.provider}/${result.model}. Human review required.`,
  };

  await Promise.all([
    fs.writeFile(path.join(runDir, "04-script-plan.md"), markdown, "utf-8"),
    writeJson(packagePath, pkg),
  ]);

  return {
    provider: result.provider,
    model: result.model,
    responseId: result.responseId,
    file: "04-script-plan.md",
  };
}
