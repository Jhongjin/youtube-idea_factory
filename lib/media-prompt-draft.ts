import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductionPackage } from "@/lib/runs";

export type MediaPromptDraftResult = {
  imagePrompts: number;
  videoPrompts: number;
  file: string;
};

type MediaPrompt = {
  id: string;
  scene_id: string;
  prompt: string;
  negative_prompt: string;
  aspect_ratio: string;
  duration_seconds?: number;
  safety_notes: string;
};

type SceneRow = {
  scene: string;
  time: string;
  narration: string;
  visual: string;
  text: string;
  assets: string;
  notes: string;
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

function parseStoryboardRows(storyboard: string): SceneRow[] {
  return storyboard
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| S"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 7)
    .filter(([scene]) => /^S\d+/i.test(scene))
    .map(([scene, time, narration, visual, text, assets, notes]) => ({
      scene,
      time,
      narration,
      visual,
      text,
      assets,
      notes,
    }));
}

function cleanSentence(value: string) {
  return value.trim().replace(/[.]+$/u, "");
}

function getAspectRatio(pkg: ProductionPackage) {
  return pkg.brief.format === "shorts" ? "9:16" : "16:9";
}

function imagePrompt(scene: SceneRow, pkg: ProductionPackage): MediaPrompt {
  const aspectRatio = getAspectRatio(pkg);
  const visual = cleanSentence(scene.visual);
  const text = cleanSentence(scene.text);
  const prompt =
    `Create a clean YouTube ${pkg.brief.format} visual for "${pkg.brief.topic}". ` +
    `Visual concept: ${visual}. Include readable space for short Korean ` +
    `on-screen text: "${text}". Style should be modern, high-contrast, ` +
    "creator-operations friendly, with clear focal hierarchy and no copied competitor thumbnail layout.";

  return {
    id: `image-${scene.scene.toLowerCase()}`,
    scene_id: scene.scene,
    prompt,
    negative_prompt:
      "distorted text, copied logos, celebrity likeness, copyrighted characters, cluttered composition, misleading evidence, unreadable captions",
    aspect_ratio: aspectRatio,
    safety_notes: "Use only source-backed factual visuals. Do not imply evidence that is not in the claim ledger.",
  };
}

function imagePromptMarkdown(scene: SceneRow, prompt: MediaPrompt) {
  return `### ${scene.scene} Image Prompt

- Scene: ${scene.scene} (${scene.time})
- Purpose: ${scene.narration}
- Prompt: ${prompt.prompt}
- Negative prompt: ${prompt.negative_prompt}
- Aspect ratio: ${prompt.aspect_ratio}
- Safety notes: ${prompt.safety_notes}
`;
}

function videoPrompt(scene: SceneRow, pkg: ProductionPackage): MediaPrompt {
  const aspectRatio = getAspectRatio(pkg);
  const visual = cleanSentence(scene.visual);
  const prompt =
    `Generate a short motion shot for "${pkg.brief.topic}" based on this storyboard visual: ` +
    `${visual}. Camera language: subtle push-in, clean transitions, stable composition. ` +
    `Motion should support narration: ${scene.narration}`;

  return {
    id: `video-${scene.scene.toLowerCase()}`,
    scene_id: scene.scene,
    prompt,
    negative_prompt:
      "shaky camera, incoherent text, copied thumbnails, brand logos, realistic public figure likeness, unsupported charts",
    aspect_ratio: aspectRatio,
    duration_seconds: 5,
    safety_notes: `Keep edit notes in scope: ${scene.notes}`,
  };
}

function videoPromptMarkdown(scene: SceneRow, prompt: MediaPrompt) {
  return `### ${scene.scene} Video Prompt

- Scene: ${scene.scene} (${scene.time})
- Prompt: ${prompt.prompt}
- Duration: ${prompt.duration_seconds ?? 5} seconds
- Aspect ratio: ${prompt.aspect_ratio}
- Negative prompt: ${prompt.negative_prompt}
- Safety notes: ${prompt.safety_notes}
`;
}

export async function createMediaPromptDraft(runId: string): Promise<MediaPromptDraftResult> {
  assertSafeRunId(runId);
  const runDir = path.join(runsDir, runId);
  const packagePath = path.join(runDir, "production-package.json");
  const pkg = await loadJson<ProductionPackage>(packagePath);
  const storyboard = await fs.readFile(path.join(runDir, "05-storyboard.md"), "utf-8").catch(() => "");
  const scenes = parseStoryboardRows(storyboard);
  const promptScenes =
    scenes.length > 0
      ? scenes
      : [
          {
            scene: "S01",
            time: "0-5s",
            narration: "Hook visual",
            visual: "High-contrast hook card",
            text: "Hook",
            assets: "Generated image/video",
            notes: "Starter fallback scene.",
          },
        ];
  const styleBible = [
    `Topic: ${pkg.brief.topic}`,
    `Format: ${pkg.brief.format}`,
    `Language: ${pkg.brief.language}`,
    `Tone: ${pkg.brief.tone ?? ""}`,
    "Visual direction: dense, clear, operational YouTube production visuals with strong contrast and readable Korean text space.",
    "Continuity: keep colors, typography style, and evidence-card visual grammar consistent across scenes.",
    "Rights/safety: do not copy competitor thumbnails, titles, characters, logos, or distinctive scene sequences.",
  ].join("\n");
  const imagePrompts = promptScenes.map((scene) => imagePrompt(scene, pkg));
  const videoPrompts = promptScenes.map((scene) => videoPrompt(scene, pkg));

  pkg.media_prompts = {
    ...pkg.media_prompts,
    style_bible: styleBible,
    image_prompts: imagePrompts,
    video_prompts: videoPrompts,
  };

  const markdown = `# 06 Media Prompts

Generated deterministic starter prompts from storyboard scene cards.

## Style Bible

${styleBible
  .split("\n")
  .map((item) => `- ${item}`)
  .join("\n")}

## Image Prompts

${promptScenes.map((scene, index) => imagePromptMarkdown(scene, imagePrompts[index])).join("\n")}

## Video Prompts

${promptScenes.map((scene, index) => videoPromptMarkdown(scene, videoPrompts[index])).join("\n")}

## Thumbnail Prompts

1. Create a high-contrast YouTube thumbnail for "${pkg.brief.topic}" with one clear focal object, one short Korean phrase, and a visual tension that matches the script promise.
2. Create an evidence-first thumbnail concept using a clean checklist or source-pattern motif, without copying any source video layout.

## Continuity Notes

- Reuse the same contrast system, caption placement, and evidence-card language across all scenes.
- Any recurring object or diagram style should be described before generation and reused by prompt id.
- Do not introduce a person, brand, logo, or public figure unless the run brief explicitly approves it.

## Generation Manifest

- Image prompts: ${promptScenes.length}
- Video prompts: ${promptScenes.length}
- Human approval required before paid generation.
- Next skill: youtube-production-qa before generation or publishing.
`;

  await Promise.all([
    fs.writeFile(path.join(runDir, "06-media-prompts.md"), markdown, "utf-8"),
    writeJson(packagePath, pkg),
  ]);

  return {
    imagePrompts: promptScenes.length,
    videoPrompts: promptScenes.length,
    file: "06-media-prompts.md",
  };
}
