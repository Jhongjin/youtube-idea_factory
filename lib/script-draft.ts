import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";

export type ScriptDraftResult = {
  sources: number;
  supportedClaims: number;
  needsEvidenceClaims: number;
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

function summarizeSources(sources: SourceVideo[]) {
  return sources
    .map((source) => {
      const channel = source.channel ? ` by ${source.channel}` : "";
      const views = source.view_count ? `, ${new Intl.NumberFormat("en").format(source.view_count)} views` : "";
      return `- ${source.rank ?? ""}. ${source.title}${channel}${views}\n  ${source.url}`;
    })
    .join("\n");
}

function extractClaimRows(claimLedger: string) {
  return claimLedger
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Claim |"))
    .map((line) => line.trim());
}

function countRows(rows: string[], status: string) {
  return rows.filter((row) => row.toLowerCase().includes(`| ${status.toLowerCase()} |`)).length;
}

function topClaimRows(rows: string[], limit: number) {
  const selected = rows.slice(0, limit);
  if (selected.length === 0) {
    return "- No claim rows yet. Use `youtube-fact-check` before final script approval.";
  }
  return selected.map((row) => `- ${row}`).join("\n");
}

function buildScriptDraft({
  pkg,
  analysis,
  claimLedger,
}: {
  pkg: ProductionPackage;
  analysis: string;
  claimLedger: string;
}) {
  const rows = extractClaimRows(claimLedger);
  const supported = countRows(rows, "supported");
  const needsEvidence = countRows(rows, "needs_evidence");
  const format = pkg.brief.format || "shorts";
  const duration = pkg.brief.target_duration_seconds ?? 60;
  const audience = pkg.brief.target_audience || "Target audience pending";
  const tone = pkg.brief.tone || "Channel tone pending";

  return {
    markdown: `# 04 Script Plan

Generated deterministic starter draft from brief, source metadata, analysis notes, and claim ledger.

## Script Strategy

- Topic: ${pkg.brief.topic}
- Category: ${pkg.brief.category ?? ""}
- Format: ${format}
- Target duration: ${duration} seconds
- Target audience: ${audience}
- Tone: ${tone}
- Source count: ${pkg.sources.length}
- Claim status: ${supported} supported, ${needsEvidence} needs evidence

## Source Context

${summarizeSources(pkg.sources)}

## Angle Candidates

1. Pattern gap angle: Use competitor patterns from \`02-video-analysis.md\`, then add a clearer viewer payoff.
2. Fact-first angle: Start from the most verifiable claim and build the narrative around evidence.
3. Contrarian angle: Challenge the most common promise in the source videos, only if the claim ledger supports it.

## Hook Options

1. "Most people miss the real reason this works: [specific source-backed mechanism]."
2. "I checked the top videos on this topic, and one pattern keeps repeating."
3. "Before you copy this trend, check these three facts."

## Recommended Opening

Use a 3-part hook:

1. Viewer problem or curiosity gap
2. Concrete promise
3. Evidence or pattern preview

## Beat Map

| Beat | Duration | Purpose | Narration Goal | Evidence/Source | Visual Intent |
| --- | --- | --- | --- | --- | --- |
| 1 | 0-5s | Hook | State the tension and promise. | Claim ledger must support any factual hook. | Fast visual contrast or source pattern montage. |
| 2 | 5-15s | Context | Explain why the topic matters now. | Use source metadata and verified claims. | Show source/category context without copying thumbnails. |
| 3 | 15-35s | Main insight | Deliver the strongest pattern or mechanism. | Pull from analysis notes. | Simple visual metaphor, chart, or example. |
| 4 | 35-50s | Proof/check | Separate facts from assumptions. | Use claim ledger. | Evidence cards or concise captions. |
| 5 | 50-${duration}s | Payoff/CTA | Give the viewer the practical takeaway. | Avoid unsupported claims. | Clear final text card. |

## Claim Rows To Resolve

${topClaimRows(rows, 8)}

## Analysis Notes Snapshot

${analysis.slice(0, 2500)}

## Narration Draft

[HOOK]

Pending. Write after claim rows marked \`needs_evidence\` are resolved or safely reframed.

[BODY]

Pending. Convert the beat map into narration using source-backed claims only.

[PAYOFF]

Pending. End with one practical viewer takeaway and a CTA aligned with the channel strategy.

## Revision Checklist

- [ ] Hook matches title/thumbnail promise.
- [ ] No \`needs_evidence\`, \`high_risk\`, or \`do_not_use\` claims appear as facts.
- [ ] Competitor patterns are transformed, not copied.
- [ ] Visual plan can move into storyboard.
- [ ] Human approval before media generation.
`,
    supported,
    needsEvidence,
  };
}

export async function createScriptDraft(runId: string): Promise<ScriptDraftResult> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const pkg = await loadJson<ProductionPackage>(path.join(runDir, "production-package.json"));
  const [analysis, claimLedger] = await Promise.all([
    fs.readFile(path.join(runDir, "02-video-analysis.md"), "utf-8").catch(() => ""),
    fs.readFile(path.join(runDir, "03-claim-ledger.md"), "utf-8").catch(() => ""),
  ]);
  const draft = buildScriptDraft({ pkg, analysis, claimLedger });

  await fs.writeFile(path.join(runDir, "04-script-plan.md"), draft.markdown, "utf-8");

  return {
    sources: pkg.sources.length,
    supportedClaims: draft.supported,
    needsEvidenceClaims: draft.needsEvidence,
    file: "04-script-plan.md",
  };
}

