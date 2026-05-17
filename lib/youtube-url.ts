export function extractYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    }

    if (host.endsWith("youtube.com")) {
      const queryVideoId = parsed.searchParams.get("v");
      if (queryVideoId) {
        return queryVideoId;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      for (const marker of ["shorts", "embed", "live"]) {
        const index = parts.indexOf(marker);
        if (index >= 0 && parts[index + 1]) {
          return parts[index + 1];
        }
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function normalizeYouTubeUrl(url: string) {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url.trim();
}

export function sourceDedupKey(source: { url?: string; video_id?: string; videoId?: string }) {
  const id = source.video_id || source.videoId || (source.url ? extractYouTubeVideoId(source.url) : "");
  return id ? `youtube:${id}` : `url:${(source.url ?? "").trim().toLowerCase()}`;
}
