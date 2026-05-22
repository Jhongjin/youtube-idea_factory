import { readRunFileIfExists, readRunJson, writeRunFile, writeRunJson } from "@/lib/run-store";
import type { ProductionPackage, SourceVideo } from "@/lib/runs";

export type ScriptPatternAnalysisResult = {
  files: string[];
  sources: number;
  transcripts: number;
};

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function sourceKey(source: SourceVideo) {
  return source.video_id || `source-${source.rank ?? 0}`;
}

async function readTranscript(runId: string, source: SourceVideo) {
  return (await readRunFileIfExists(runId, `transcripts/${sourceKey(source)}.txt`)) ?? "";
}

function firstWords(content: string, maxWords: number) {
  const words = content.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function lastWords(content: string, maxWords: number) {
  const words = content.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(Math.max(0, words.length - maxWords)).join(" ");
}

function inferHookType(source: SourceVideo, transcript: string) {
  const text = `${source.title} ${firstWords(transcript, 80)}`.toLowerCase();
  if (/[?？]|왜|how|what|why|어떻게|무엇|진짜|정말/.test(text)) {
    return "질문/호기심 갭";
  }
  if (/\d|%|top|best|worst|가지|위|순위|million|billion/.test(text)) {
    return "숫자/순위 약속";
  }
  if (/but|however|vs|versus|대신|하지만|반전|충격|논란/.test(text)) {
    return "대조/반전";
  }
  if (/new|breaking|latest|속보|최근|오늘|발표/.test(text)) {
    return "뉴스/업데이트";
  }
  return "문제 제기형";
}

function inferRetentionDevices(source: SourceVideo, transcript: string) {
  const text = `${source.title} ${transcript}`.toLowerCase();
  const devices = new Set<string>();
  if (/[?？]|why|how|왜|어떻게/.test(text)) {
    devices.add("질문으로 다음 답을 기다리게 함");
  }
  if (/\d|%|first|second|세 가지|3가지|top/.test(text)) {
    devices.add("숫자 목록과 단계감");
  }
  if (/but|however|대신|하지만|문제는|반전/.test(text)) {
    devices.add("대조와 반전");
  }
  if (/결국|그래서|therefore|so/.test(text)) {
    devices.add("원인-결과 연결");
  }
  if (devices.size === 0) {
    devices.add("짧은 단락 전환과 정보 밀도");
  }
  return Array.from(devices).slice(0, 4);
}

function inferCredibilityDevices(source: SourceVideo, transcript: string) {
  const devices = new Set<string>();
  if ((source.view_count ?? 0) > 0) {
    devices.add("높은 조회수로 시장 반응 확인");
  }
  if (source.channel) {
    devices.add("채널/출처 명시");
  }
  if (/\d|%|년|월|일|study|report|according|발표|조사/.test(transcript)) {
    devices.add("숫자, 날짜, 보고서형 주장");
  }
  if (source.transcript_status && source.transcript_status !== "not_checked") {
    devices.add("자막 기반 구조 확인");
  }
  if (devices.size === 0) {
    devices.add("추가 근거 확인 필요");
  }
  return Array.from(devices).slice(0, 4);
}

function inferDevelopmentPattern(source: SourceVideo, transcript: string) {
  const seconds = Number(source.duration_seconds ?? 0);
  const hasTranscript = transcript.trim().length > 0;
  if (seconds > 0 && seconds <= 75) {
    return "짧은 훅 -> 핵심 근거 1-2개 -> 빠른 결론/CTA";
  }
  if (!hasTranscript) {
    return "메타데이터만 확인됨. 자막 확보 후 비트 구조 재분석 필요";
  }
  if (/\d|첫째|둘째|third|step|가지/.test(transcript)) {
    return "목록형 전개: 약속 제시 -> 항목별 증거 -> 요약";
  }
  if (/문제|원인|해결|solution|problem/.test(transcript.toLowerCase())) {
    return "문제-원인-해결 전개";
  }
  return "상황 설명 -> 핵심 주장 -> 예시/근거 -> 정리";
}

function sourceCard(source: SourceVideo, transcript: string) {
  const opening = firstWords(transcript, 70) || "자막 없음. 제목/메타데이터만 기반으로 판단.";
  const ending = lastWords(transcript, 45) || "자막 없음. CTA/마무리 확인 필요.";
  const hookType = inferHookType(source, transcript);
  const retention = inferRetentionDevices(source, transcript);
  const credibility = inferCredibilityDevices(source, transcript);

  return `## ${source.rank ?? ""}. ${source.title}

- URL: ${source.url}
- Channel: ${source.channel ?? ""}
- Hook type: ${hookType}
- First 30 seconds structure: ${opening}
- Title/thumbnail promise: ${source.title}
- Development pattern: ${inferDevelopmentPattern(source, transcript)}
- Retention devices: ${retention.join("; ")}
- Credibility devices: ${credibility.join("; ")}
- CTA / ending pattern: ${ending}
- Do not copy: exact wording, title syntax, thumbnail composition, scene order, or unique anecdotes.
- Differentiation angle: keep the winning promise but add fresher evidence, clearer source separation, and a stronger local/channel-specific point of view.
`;
}

function countHookTypes(cards: Array<{ hookType: string }>) {
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.hookType, (counts.get(card.hookType) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `- ${type}: ${count}개`)
    .join("\n");
}

export async function createScriptPatternAnalysis(runId: string): Promise<ScriptPatternAnalysisResult> {
  assertSafeRunId(runId);
  const pkg = await readRunJson<ProductionPackage>(runId, "production-package.json");
  const sources = pkg.sources.filter((source) => !source.analysis_excluded).slice(0, 10);
  const pairs = await Promise.all(
    sources.map(async (source) => {
      const transcript = await readTranscript(runId, source);
      return {
        hookType: inferHookType(source, transcript),
        source,
        transcript,
      };
    }),
  );
  const transcriptCount = pairs.filter((pair) => pair.transcript.trim()).length;
  const hookSummary = countHookTypes(pairs);
  const markdown = `# TOP10 Script Pattern Analysis

Generated from selected source metadata and available transcripts. This file summarizes reusable structure patterns without copying competitor expression.

## Coverage

- Sources analyzed: ${sources.length}/${pkg.sources.length}
- Sources with transcript: ${transcriptCount}/${sources.length}
- Excluded sources skipped: ${pkg.sources.length - sources.length}

## Hook Type Mix

${hookSummary || "- Not enough source data yet."}

## Per-Video Analysis

${pairs.map((pair) => sourceCard(pair.source, pair.transcript)).join("\n")}

## Reusable Structure Patterns

- Hook promise first: open with the question, number, contrast, or news peg before background.
- First 30 seconds should clarify the viewer payoff and why the topic matters now.
- Main body should alternate context, evidence, interpretation, and a small reveal to avoid becoming a flat summary.
- End with the practical implication for the target viewer, then a restrained CTA.

## Retention Device Library

- Curiosity gap: ask the exact question the viewer wants answered, then delay the full answer until after one proof point.
- Contrast: show what most people think versus what the evidence suggests.
- Counted progression: number the beats so viewers feel forward motion.
- Credibility checkpoint: pause after a strong claim and show where it came from.

## Creative Boundaries

- Do not reuse exact phrasing from source openings or endings.
- Do not mirror a competitor's thumbnail composition or title syntax.
- Do not preserve the same scene order when adapting an idea.
- Treat factual claims as candidates until the claim ledger marks them supported.

## Our Differentiation Opportunities

- Make the source/evidence boundary visible on screen.
- Convert broad trend coverage into a sharper channel-specific angle.
- Use the strongest hook type from the source set, but add a new evidence path and clearer conclusion.
- Flag claims that need evidence instead of turning them into narration.
`;

  const updatedAt = new Date().toISOString();
  pkg.script_plan = {
    ...pkg.script_plan,
    notes: `${pkg.script_plan.notes ?? ""}\nTOP10 script pattern analysis generated at ${updatedAt}. Use 02-script-patterns.md before drafting or refining the script.`.trim(),
  };

  await Promise.all([
    writeRunFile(runId, "02-script-patterns.md", markdown),
    writeRunJson(runId, "production-package.json", pkg),
  ]);

  return {
    files: ["02-script-patterns.md"],
    sources: sources.length,
    transcripts: transcriptCount,
  };
}
