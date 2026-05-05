import type { ChannelMemoryUpdate } from "@/lib/channel-memory-update";
import { readRunJson } from "@/lib/run-store";
import { getRuns, type RunSummary } from "@/lib/runs";

export type ChannelMemoryIndexItem = {
  text: string;
  count: number;
  runs: Array<{
    run_id: string;
    topic: string;
  }>;
};

export type ChannelMemoryIndex = {
  created_at: string;
  run_count: number;
  update_count: number;
  ready_update_count: number;
  skipped_runs: number;
  latest_update_at: string;
  carry_forward: ChannelMemoryIndexItem[];
  caution_flags: ChannelMemoryIndexItem[];
  title_patterns: ChannelMemoryIndexItem[];
  thumbnail_patterns: ChannelMemoryIndexItem[];
  hook_patterns: ChannelMemoryIndexItem[];
  next_experiments: ChannelMemoryIndexItem[];
};

const memoryPath = "12-channel-memory-update.json";

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function addItem(
  map: Map<string, ChannelMemoryIndexItem>,
  text: string,
  run: Pick<RunSummary, "id" | "package">,
) {
  const key = compact(text);
  if (!key) {
    return;
  }
  const existing = map.get(key) ?? {
    count: 0,
    runs: [],
    text: key,
  };
  existing.count += 1;
  if (!existing.runs.some((item) => item.run_id === run.id)) {
    existing.runs.push({
      run_id: run.id,
      topic: run.package.brief.topic,
    });
  }
  map.set(key, existing);
}

function topItems(map: Map<string, ChannelMemoryIndexItem>, limit = 8) {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit);
}

export async function getChannelMemoryIndex(inputRuns?: RunSummary[]): Promise<ChannelMemoryIndex> {
  const runs = inputRuns ?? (await getRuns());
  const updates = await Promise.all(
    runs.map(async (run) => ({
      run,
      update: await readRunJson<ChannelMemoryUpdate>(run.id, memoryPath).catch(() => null),
    })),
  );
  const maps = {
    carry_forward: new Map<string, ChannelMemoryIndexItem>(),
    caution_flags: new Map<string, ChannelMemoryIndexItem>(),
    hook_patterns: new Map<string, ChannelMemoryIndexItem>(),
    next_experiments: new Map<string, ChannelMemoryIndexItem>(),
    thumbnail_patterns: new Map<string, ChannelMemoryIndexItem>(),
    title_patterns: new Map<string, ChannelMemoryIndexItem>(),
  };
  let latestUpdateAt = "";
  let readyUpdateCount = 0;

  for (const { run, update } of updates) {
    if (!update) {
      continue;
    }
    if (update.status === "ready") {
      readyUpdateCount += 1;
    }
    latestUpdateAt = latestUpdateAt > update.created_at ? latestUpdateAt : update.created_at;
    for (const item of update.carry_forward) {
      addItem(maps.carry_forward, item, run);
    }
    for (const item of update.caution_flags) {
      addItem(maps.caution_flags, item, run);
    }
    for (const item of update.title_patterns) {
      addItem(maps.title_patterns, item, run);
    }
    for (const item of update.thumbnail_patterns) {
      addItem(maps.thumbnail_patterns, item, run);
    }
    for (const item of update.hook_patterns) {
      addItem(maps.hook_patterns, item, run);
    }
    for (const item of update.next_experiments) {
      addItem(maps.next_experiments, item, run);
    }
  }

  const updateCount = updates.filter((item) => item.update).length;
  return {
    carry_forward: topItems(maps.carry_forward),
    caution_flags: topItems(maps.caution_flags),
    created_at: new Date().toISOString(),
    hook_patterns: topItems(maps.hook_patterns),
    latest_update_at: latestUpdateAt,
    next_experiments: topItems(maps.next_experiments),
    ready_update_count: readyUpdateCount,
    run_count: runs.length,
    skipped_runs: runs.length - updateCount,
    thumbnail_patterns: topItems(maps.thumbnail_patterns),
    title_patterns: topItems(maps.title_patterns),
    update_count: updateCount,
  };
}
