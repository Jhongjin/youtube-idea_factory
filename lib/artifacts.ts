import { promises as fs } from "node:fs";
import path from "node:path";

export type ArtifactDefinition = {
  id: string;
  filename: string;
  label: string;
  skill: string;
  description: string;
};

export type RunArtifact = ArtifactDefinition & {
  content: string;
  updatedAt: string;
  size: number;
};

const runsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "runs");
const maxArtifactBytes = 300_000;

export const artifactDefinitions: ArtifactDefinition[] = [
  {
    id: "research",
    filename: "01-research.md",
    label: "Research",
    skill: "youtube-market-research",
    description: "Source table, research summary, and patterns to investigate.",
  },
  {
    id: "video-analysis",
    filename: "02-video-analysis.md",
    label: "Video Analysis",
    skill: "youtube-video-analysis",
    description: "Competitor teardown, hook library, structure patterns, and claim candidates.",
  },
  {
    id: "claim-ledger",
    filename: "03-claim-ledger.md",
    label: "Claim Ledger",
    skill: "youtube-fact-check",
    description: "Fact-check table with status, evidence, confidence, and action.",
  },
  {
    id: "script-plan",
    filename: "04-script-plan.md",
    label: "Script Plan",
    skill: "youtube-script-architect",
    description: "Strategy, hook options, beat map, and narration draft.",
  },
  {
    id: "storyboard",
    filename: "05-storyboard.md",
    label: "Storyboard",
    skill: "youtube-storyboard",
    description: "Scene cards, visual plan, asset needs, and edit notes.",
  },
  {
    id: "media-prompts",
    filename: "06-media-prompts.md",
    label: "Media Prompts",
    skill: "youtube-media-prompts",
    description: "Style bible, image prompts, video prompts, and thumbnail prompts.",
  },
  {
    id: "publishing",
    filename: "07-publishing-package.md",
    label: "Publishing",
    skill: "youtube-production-qa",
    description: "Title candidates, description, tags, thumbnail, and upload checklist.",
  },
  {
    id: "qa",
    filename: "08-qa.md",
    label: "QA",
    skill: "youtube-production-qa",
    description: "Blockers, warnings, approval checklist, and publish readiness.",
  },
];

function assertSafeRunId(runId: string) {
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error("Invalid run id.");
  }
}

function getArtifactDefinition(artifactId: string) {
  const definition = artifactDefinitions.find((artifact) => artifact.id === artifactId);
  if (!definition) {
    throw new Error("Unknown artifact.");
  }
  return definition;
}

function getRunDir(runId: string) {
  assertSafeRunId(runId);
  return path.join(runsDir, runId);
}

async function ensureRunExists(runDir: string) {
  const stat = await fs.stat(runDir).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error("Run not found.");
  }
}

async function readFileIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

export async function getRunArtifacts(runId: string): Promise<RunArtifact[]> {
  const runDir = getRunDir(runId);
  await ensureRunExists(runDir);

  return Promise.all(
    artifactDefinitions.map(async (definition) => {
      const filePath = path.join(runDir, definition.filename);
      const [content, stat] = await Promise.all([
        readFileIfExists(filePath),
        fs.stat(filePath).catch(() => null),
      ]);

      return {
        ...definition,
        content,
        updatedAt: stat?.mtime.toISOString() ?? "",
        size: stat?.size ?? 0,
      };
    }),
  );
}

export async function getRunArtifact(runId: string, artifactId: string): Promise<RunArtifact> {
  const runDir = getRunDir(runId);
  await ensureRunExists(runDir);

  const definition = getArtifactDefinition(artifactId);
  const filePath = path.join(runDir, definition.filename);
  const [content, stat] = await Promise.all([
    readFileIfExists(filePath),
    fs.stat(filePath).catch(() => null),
  ]);

  return {
    ...definition,
    content,
    updatedAt: stat?.mtime.toISOString() ?? "",
    size: stat?.size ?? 0,
  };
}

export async function updateRunArtifact(runId: string, artifactId: string, content: string) {
  const runDir = getRunDir(runId);
  await ensureRunExists(runDir);

  const definition = getArtifactDefinition(artifactId);
  const bytes = Buffer.byteLength(content, "utf-8");
  if (bytes > maxArtifactBytes) {
    throw new Error(`Artifact is too large. Max size is ${maxArtifactBytes} bytes.`);
  }

  const filePath = path.join(runDir, definition.filename);
  await fs.writeFile(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf-8");

  return getRunArtifact(runId, artifactId);
}

