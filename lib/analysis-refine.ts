import { generateLlmText } from "@/lib/llm-adapter";
import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";

export type AnalysisRefineResult = {
  provider: string;
  model: string;
  responseId?: string;
  claims: number;
  files: string[];
};

type ClaimRecord = {
  claim: string;
  status: "supported" | "needs_evidence" | "opinion" | "high_risk" | "do_not_use";
  evidence_url?: string;
  confidence?: number;
  notes?: string;
};

const claimStatuses = new Set<ClaimRecord["status"]>([
  "supported",
  "needs_evidence",
  "opinion",
  "high_risk",
  "do_not_use",
]);

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function getSourceKey(source: SourceVideo) {
  return source.video_id || `source-${source.rank ?? 0}`;
}

async function readTranscript(runId: string, source: SourceVideo) {
  const sourceKey = getSourceKey(source);
  return (await readRunFileIfExists(runId, `transcripts/${sourceKey}.txt`)) ?? "";
}

function truncate(content: string, limit: number) {
  return content.length > limit ? `${content.slice(0, limit)}\n\n[TRUNCATED]` : content;
}

function splitCells(row: string) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function parseConfidence(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(1, parsed));
}

function parseClaimLedger(markdown: string): ClaimRecord[] {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Claim |"))
    .map((line) => splitCells(line))
    .filter((cells) => cells.length >= 6)
    .map(([claim, status, evidenceUrl, confidence, action, source]) => ({
      claim,
      status,
      evidenceUrl,
      confidence,
      notes: [action, source].filter(Boolean).join(" Source: "),
    }))
    .filter((row) => row.claim.trim())
    .filter((row) => claimStatuses.has(row.status as ClaimRecord["status"]))
    .map((row) => ({
      claim: row.claim,
      status: row.status as ClaimRecord["status"],
      evidence_url: row.evidenceUrl || undefined,
      confidence: parseConfidence(row.confidence),
      notes: row.notes || undefined,
    }));
}

function extractFile(text: string, filename: string) {
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `---FILE:${escaped}---\\s*([\\s\\S]*?)(?=\\n---FILE:|$)`,
    "u",
  );
  return text.match(pattern)?.[1]?.trim();
}

function buildInstructions(pkg: ProductionPackage) {
  return `You are the video-analysis and fact-check preparation agent for a YouTube production dashboard.

Return exactly two files using these markers:

---FILE:02-video-analysis.md---
[complete markdown]
---FILE:03-claim-ledger.md---
[complete markdown]

Rules:
- Write primarily in Korean when the run language is "ko"; otherwise use the run language.
- Analyze hooks, pacing, structure, retention devices, reusable patterns, and creative boundaries.
- Do not copy competitor wording, title structure, thumbnail composition, or distinctive scene order.
- For claim ledger rows, use only these statuses: supported, needs_evidence, opinion, high_risk, do_not_use.
- Do not mark a claim as supported unless the provided source/transcript context directly supports it and an evidence URL/source is present.
- If evidence is incomplete, use needs_evidence or opinion.
- Do not invent views, dates, claims, quotes, studies, or external facts.
- Keep final script, media generation, render, and publishing behind human approval.

Run topic: ${pkg.brief.topic}
Format: ${pkg.brief.format}
Audience: ${pkg.brief.target_audience ?? ""}
`;
}

function buildInput({
  pkg,
  transcripts,
  analysis,
  claimLedger,
}: {
  pkg: ProductionPackage;
  transcripts: Array<{ source: SourceVideo; transcript: string }>;
  analysis: string;
  claimLedger: string;
}) {
  return `Brief:

${JSON.stringify(pkg.brief, null, 2)}

Sources:

${JSON.stringify(pkg.sources, null, 2)}

Transcript excerpts:

${transcripts
  .map(
    (item) => `## ${item.source.rank ?? ""}. ${item.source.title}
URL: ${item.source.url}
Transcript:
${truncate(item.transcript || "Transcript not available.", 2500)}`,
  )
  .join("\n\n")}

Current 02-video-analysis.md:

${truncate(analysis, 9000)}

Current 03-claim-ledger.md:

${truncate(claimLedger, 6000)}

The 03 claim ledger must use this table:

| Claim | Status | Evidence URL | Confidence | Action | Source |
| --- | --- | --- | --- | --- | --- |
`;
}

export async function refineAnalysisWithLlm(runId: string): Promise<AnalysisRefineResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const [analysis, claimLedger, transcripts] = await Promise.all([
    readRunFileIfExists(runId, "02-video-analysis.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "03-claim-ledger.md").then((value) => value ?? ""),
    Promise.all(
      pkg.sources.map(async (source) => ({
        source,
        transcript: await readTranscript(runId, source),
      })),
    ),
  ]);

  const result = await generateLlmText({
    task: "youtube-analysis-claim-refine",
    instructions: buildInstructions(pkg),
    input: buildInput({ pkg, transcripts, analysis, claimLedger }),
  });
  const refinedAnalysis = extractFile(result.text, "02-video-analysis.md");
  const refinedClaimLedger = extractFile(result.text, "03-claim-ledger.md");
  if (!refinedAnalysis || !refinedClaimLedger) {
    throw new Error("LLM response did not include both required file markers.");
  }

  const generatedAt = new Date().toISOString();
  const record = `\n\n---\n\nLLM refinement record:\n\n- Generated at: ${generatedAt}\n- Provider: ${result.provider}\n- Model: ${result.model}\n- Response ID: ${result.responseId ?? ""}\n- Human review required before script, media generation, render, or publishing.\n`;
  const claims = parseClaimLedger(refinedClaimLedger);
  pkg.claim_ledger = claims;
  pkg.script_plan = {
    ...pkg.script_plan,
    notes: `${pkg.script_plan.notes ?? ""}\nAnalysis/claim ledger LLM-refined at ${generatedAt} with ${result.provider}/${result.model}.`.trim(),
  };

  await Promise.all([
    writeRunFile(runId, "02-video-analysis.md", `${refinedAnalysis}${record}`),
    writeRunFile(runId, "03-claim-ledger.md", `${refinedClaimLedger}${record}`),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    provider: result.provider,
    model: result.model,
    responseId: result.responseId,
    claims: claims.length,
    files: ["02-video-analysis.md", "03-claim-ledger.md"],
  };
}
