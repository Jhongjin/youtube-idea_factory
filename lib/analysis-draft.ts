import { promises as fs } from "node:fs";
import path from "node:path";
import type { SourceVideo } from "@/lib/runs";

export type AnalysisDraftResult = {
  sources: number;
  transcripts: number;
  claimCandidates: number;
  files: string[];
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function getSourceKey(source: SourceVideo) {
  return source.video_id || `source-${source.rank ?? 0}`;
}

async function loadJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function readTranscript(runDir: string, source: SourceVideo) {
  const sourceKey = getSourceKey(source);
  const transcriptPath = path.join(runDir, "transcripts", `${sourceKey}.txt`);
  return fs.readFile(transcriptPath, "utf-8").catch(() => "");
}

function firstNonEmptyLines(content: string, limit: number) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function extractClaimCandidates(content: string) {
  const sentences = content
    .replace(/\r?\n/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const claimPattern = /(\d|%|년|월|일|최초|최고|최대|유일|always|never|first|largest|most|only)/i;
  const seen = new Set<string>();
  const claims: string[] = [];

  for (const sentence of sentences) {
    if (!claimPattern.test(sentence)) {
      continue;
    }
    const clipped = sentence.slice(0, 220);
    if (seen.has(clipped)) {
      continue;
    }
    seen.add(clipped);
    claims.push(clipped);
    if (claims.length >= 30) {
      break;
    }
  }

  return claims;
}

function formatNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? new Intl.NumberFormat("en").format(number) : "";
}

function sourceAnalysisCard(source: SourceVideo & Record<string, unknown>, transcript: string) {
  const transcriptLines = firstNonEmptyLines(transcript, 5);
  const transcriptPreview =
    transcriptLines.length > 0
      ? transcriptLines.map((line) => `> ${line}`).join("\n")
      : "Transcript not available yet.";

  return `## ${source.rank ?? ""}. ${source.title}

- URL: ${source.url}
- Channel: ${source.channel ?? ""}
- Views: ${formatNumber(source.view_count)}
- Duration: ${source.duration ?? ""}
- Transcript status: ${source.transcript_status ?? "not_checked"}

### Transcript Preview

${transcriptPreview}

### Hook Notes

- Pending. Use \`youtube-video-analysis\` to identify the opening promise, tension, and retention device.

### Structure Notes

- Pending. Map beats, pacing, proof points, transitions, and CTA.

### Reusable Pattern

- Pending. Extract reusable pattern without copying wording, title, thumbnail, or scene sequence.
`;
}

function claimLedgerRows(claimsBySource: Array<{ source: SourceVideo; claims: string[] }>) {
  const rows: string[] = [];
  for (const item of claimsBySource) {
    for (const claim of item.claims) {
      rows.push(
        `| ${claim.replace(/\|/g, "\\|")} | needs_evidence |  | 0 | Verify before script use. | ${item.source.url} |`,
      );
    }
  }

  if (rows.length === 0) {
    rows.push("|  | needs_evidence |  | 0 | Add claims from analysis or transcript review. |  |");
  }

  return rows.join("\n");
}

export async function createAnalysisDraft(runId: string): Promise<AnalysisDraftResult> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const sources = await loadJson<Array<SourceVideo & Record<string, unknown>>>(
    path.join(runDir, "sources.json"),
  );

  const transcriptPairs = await Promise.all(
    sources.map(async (source) => ({
      source,
      transcript: await readTranscript(runDir, source),
    })),
  );

  const analysisMarkdown = `# 02 Video Analysis

Generated deterministic draft from source metadata and available manual transcripts.

${transcriptPairs.map((item) => sourceAnalysisCard(item.source, item.transcript)).join("\n")}

## Hook Library

- Pending. Compare source cards and extract hook patterns.

## Structure Patterns

- Pending. Identify repeated beat structures and gaps.

## Creative Boundaries

- Do not copy titles, thumbnails, exact phrasing, or distinctive scene order.
`;

  const claimsBySource = transcriptPairs.map((item) => ({
    source: item.source,
    claims: extractClaimCandidates(item.transcript),
  }));
  const claimCount = claimsBySource.reduce((total, item) => total + item.claims.length, 0);
  const claimMarkdown = `# 03 Claim Ledger

Generated deterministic draft from transcript sentences that look fact-checkable.

| Claim | Status | Evidence URL | Confidence | Action | Source |
| --- | --- | --- | --- | --- | --- |
${claimLedgerRows(claimsBySource)}

Allowed statuses: \`supported\`, \`needs_evidence\`, \`opinion\`, \`high_risk\`, \`do_not_use\`.
`;

  await Promise.all([
    fs.writeFile(path.join(runDir, "02-video-analysis.md"), analysisMarkdown, "utf-8"),
    fs.writeFile(path.join(runDir, "03-claim-ledger.md"), claimMarkdown, "utf-8"),
  ]);

  return {
    sources: sources.length,
    transcripts: transcriptPairs.filter((item) => item.transcript.trim()).length,
    claimCandidates: claimCount,
    files: ["02-video-analysis.md", "03-claim-ledger.md"],
  };
}

