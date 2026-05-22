import type { YouTubeCandidate } from "@/lib/youtube-finder";

type CandidateSelectionOptions = {
  format: string;
  maxPerChannel?: number;
  maxResults?: number;
  targetSeconds?: number;
};

function clampPositiveInt(value: number | undefined, fallback: number, max: number) {
  const parsed = Number.isFinite(value) ? value ?? fallback : fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function channelKey(candidate: YouTubeCandidate) {
  const channel = candidate.channelId || candidate.channel;
  return channel ? channel.toLowerCase() : `unknown:${candidate.videoId || candidate.url}`;
}

function candidateKey(candidate: YouTubeCandidate) {
  return candidate.videoId || candidate.url;
}

function diversifyByChannel(
  candidates: YouTubeCandidate[],
  maxResults: number,
  maxPerChannel: number,
) {
  const selected: YouTubeCandidate[] = [];
  const selectedKeys = new Set<string>();
  const channelCounts = new Map<string, number>();

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const channel = channelKey(candidate);
    const currentCount = channelCounts.get(channel) ?? 0;
    if (selectedKeys.has(key) || currentCount >= maxPerChannel) {
      continue;
    }
    selected.push(candidate);
    selectedKeys.add(key);
    channelCounts.set(channel, currentCount + 1);
    if (selected.length >= maxResults) {
      return selected;
    }
  }

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (selectedKeys.has(key)) {
      continue;
    }
    selected.push(candidate);
    selectedKeys.add(key);
    if (selected.length >= maxResults) {
      break;
    }
  }

  return selected;
}

export function selectYouTubeSourceCandidates(
  candidates: YouTubeCandidate[],
  options: CandidateSelectionOptions,
) {
  const maxResults = clampPositiveInt(options.maxResults, 10, 10);
  const maxPerChannel = clampPositiveInt(options.maxPerChannel, 2, maxResults);
  const normalizedFormat = options.format.toLowerCase();
  const sorted = candidates.slice().sort((a, b) => b.viewCount - a.viewCount);
  let matches: YouTubeCandidate[];

  if (normalizedFormat === "shorts") {
    matches = sorted.filter((candidate) => candidate.durationSeconds > 0 && candidate.durationSeconds <= 75);
  } else {
    const target = Number.isFinite(options.targetSeconds) && (options.targetSeconds ?? 0) > 0
      ? options.targetSeconds ?? 480
      : 480;
    const lower = Math.max(240, Math.floor(target * 0.5));
    const upper = Math.max(lower + 60, Math.ceil(target * 1.75));
    const durationMatches = sorted.filter(
      (candidate) => candidate.durationSeconds >= lower && candidate.durationSeconds <= upper,
    );
    matches =
      durationMatches.length >= Math.min(5, maxResults)
        ? durationMatches
        : sorted.filter((candidate) => candidate.durationSeconds >= 240);
  }

  const base = matches.length >= Math.min(5, maxResults) ? matches : sorted;
  return diversifyByChannel(base, maxResults, maxPerChannel);
}
