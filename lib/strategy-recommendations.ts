import { generateLlmText } from "@/lib/llm-adapter";
import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage } from "@/lib/runs";

export type StrategyRecommendationOptions = {
  providerProfileId?: string;
};

export type StrategyRecommendationResult = {
  files: string[];
  model: string;
  provider: string;
  responseId?: string;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function truncate(content: string, limit: number) {
  return content.length > limit ? `${content.slice(0, limit)}\n\n[TRUNCATED]` : content;
}

function instructions(pkg: ProductionPackage) {
  return `You are the YouTube script strategy recommender for a human-approved production dashboard.

Write primarily in Korean when the run language is "ko"; otherwise use the run language.

Return a concise but useful markdown strategy brief with these exact sections:

# LLM Source-Based Strategy Recommendations
## Audience Recommendations
Five target audience options. For each: who they are, why they fit the source set, and what they need from the video.
## Tone Recommendations
Five tone options. For each: when to use it and what to avoid.
## Angle Recommendations
Five original video angles. Each must transform source patterns into an original framing and include a differentiation note.
## Recommended Script Structure
One recommended structure with hook, first 30 seconds, body beats, retention checkpoints, credibility moments, and ending.
## Channel Fit Filter
How to filter the recommendations for this channel's brand, language, format, and audience.
## Open Questions
Facts or strategic choices that need human review.

Rules:
- Do not copy source wording, title syntax, thumbnails, or scene order.
- Do not present claims marked needs_evidence, high_risk, or do_not_use as facts.
- Treat missing transcripts as a limitation.
- Keep generation, rendering, and publishing behind human approval.

Run:
- Topic: ${pkg.brief.topic}
- Format: ${pkg.brief.format}
- Language: ${pkg.brief.language}
- Region: ${pkg.brief.region_code ?? ""}
- Target duration seconds: ${pkg.brief.target_duration_seconds ?? ""}
- Existing target audience: ${pkg.brief.target_audience ?? ""}
- Existing tone: ${pkg.brief.tone ?? ""}
- Channel: ${pkg.brief.channel ? `${pkg.brief.channel.brand_name} / ${pkg.brief.channel.channel_name}` : "not selected"}
`;
}

export async function createStrategyRecommendations(
  runId: string,
  options: StrategyRecommendationOptions = {},
): Promise<StrategyRecommendationResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const [research, analysis, scriptPatterns, claimLedger] = await Promise.all([
    readRunFileIfExists(runId, "01-research.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "02-video-analysis.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "02-script-patterns.md").then((value) => value ?? ""),
    readRunFileIfExists(runId, "03-claim-ledger.md").then((value) => value ?? ""),
  ]);

  const input = `Production package brief:

${JSON.stringify(pkg.brief, null, 2)}

Sources:

${JSON.stringify(pkg.sources, null, 2)}

Research:

${truncate(research, 5000)}

Video analysis:

${truncate(analysis, 8000)}

TOP10 script patterns:

${truncate(scriptPatterns, 8000)}

Claim ledger:

${truncate(claimLedger, 5000)}
`;

  const result = await generateLlmText({
    task: "youtube-source-based-strategy-recommendations",
    instructions: instructions(pkg),
    input,
    providerProfileId: options.providerProfileId,
  });

  const generatedAt = new Date().toISOString();
  const record = `\n\n---\n\nLLM recommendation record:\n\n- Generated at: ${generatedAt}\n- Provider: ${result.provider}\n- Model: ${result.model}\n- Response ID: ${result.responseId ?? ""}\n- Human review required before script, media generation, render, or publishing.\n`;
  pkg.script_plan = {
    ...pkg.script_plan,
    notes: `${pkg.script_plan.notes ?? ""}\nSource-based strategy recommendations generated at ${generatedAt} with ${result.provider}/${result.model}.`.trim(),
  };

  await Promise.all([
    writeRunFile(runId, "04-strategy-recommendations.md", `${result.text.trim()}${record}`),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    files: ["04-strategy-recommendations.md"],
    model: result.model,
    provider: result.provider,
    responseId: result.responseId,
  };
}
