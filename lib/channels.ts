import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getAppStorageMode } from "@/lib/storage-mode";
import { isSupabaseMissingTableError, supabaseEq, supabaseRest } from "@/lib/supabase-rest";

export type YouTubeChannelStatus = "active" | "setup" | "paused";

export type YouTubeChannel = {
  analytics_refresh_token?: string | null;
  brand_name: string;
  channel_id: string | null;
  channel_name: string;
  created_at: string;
  default_language: string;
  id: string;
  notes?: string | null;
  owner_email?: string | null;
  status: YouTubeChannelStatus;
  updated_at: string;
  upload_refresh_token?: string | null;
  youtube_handle?: string | null;
};

export type SafeYouTubeChannel = Omit<YouTubeChannel, "analytics_refresh_token" | "upload_refresh_token"> & {
  has_analytics_refresh_token: boolean;
  has_upload_refresh_token: boolean;
};

type ChannelStoreFile = {
  channels: YouTubeChannel[];
};

const channelsTable = "youtube_channels";
const localChannelStorePath = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "config",
  "youtube-channels.local.json",
);

function nowIso() {
  return new Date().toISOString();
}

function safeChannel(channel: YouTubeChannel): SafeYouTubeChannel {
  const { analytics_refresh_token, upload_refresh_token, ...safe } = channel;
  return {
    ...safe,
    has_analytics_refresh_token: Boolean(analytics_refresh_token),
    has_upload_refresh_token: Boolean(upload_refresh_token),
  };
}

async function readLocalChannels(): Promise<YouTubeChannel[]> {
  const raw = await fs.readFile(localChannelStorePath, "utf-8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as ChannelStoreFile;
  return parsed.channels ?? [];
}

async function writeLocalChannels(channels: YouTubeChannel[]) {
  await fs.mkdir(path.dirname(localChannelStorePath), { recursive: true });
  await fs.writeFile(localChannelStorePath, `${JSON.stringify({ channels }, null, 2)}\n`, "utf-8");
}

export async function listYouTubeChannels(): Promise<SafeYouTubeChannel[]> {
  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<YouTubeChannel[]>(channelsTable, {
      query: { order: "updated_at.desc", select: "*" },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return [];
      }
      throw error;
    });
    return rows.map(safeChannel);
  }

  return (await readLocalChannels()).map(safeChannel);
}

export async function getYouTubeChannel(channelId: string): Promise<SafeYouTubeChannel | null> {
  const id = channelId.trim();
  if (!id) {
    return null;
  }

  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<YouTubeChannel[]>(channelsTable, {
      query: { id: supabaseEq(id), limit: 1, select: "*" },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return [];
      }
      throw error;
    });
    return rows[0] ? safeChannel(rows[0]) : null;
  }

  const channel = (await readLocalChannels()).find((item) => item.id === id);
  return channel ? safeChannel(channel) : null;
}

export async function createYouTubeChannel(input: {
  analytics_refresh_token?: string;
  brand_name: string;
  channel_id: string;
  channel_name: string;
  default_language?: string;
  notes?: string;
  owner_email?: string;
  status?: YouTubeChannelStatus;
  upload_refresh_token?: string;
  youtube_handle?: string;
}) {
  if (!input.brand_name.trim() || !input.channel_name.trim()) {
    throw new Error("브랜드명과 채널명은 필수입니다.");
  }

  const timestamp = nowIso();
  const channel: YouTubeChannel = {
    analytics_refresh_token: input.analytics_refresh_token?.trim() || null,
    brand_name: input.brand_name.trim(),
    channel_id: input.channel_id.trim() || null,
    channel_name: input.channel_name.trim(),
    created_at: timestamp,
    default_language: input.default_language?.trim() || "ko",
    id: randomUUID(),
    notes: input.notes?.trim() || null,
    owner_email: input.owner_email?.trim().toLowerCase() || null,
    status: input.status ?? "setup",
    updated_at: timestamp,
    upload_refresh_token: input.upload_refresh_token?.trim() || null,
    youtube_handle: input.youtube_handle?.trim() || null,
  };

  if (getAppStorageMode() === "supabase") {
    await supabaseRest<YouTubeChannel[]>(channelsTable, {
      body: channel,
      method: "POST",
      prefer: "return=representation",
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        throw new Error("Supabase youtube_channels 테이블이 필요합니다. docs/templates/supabase-auth-schema.sql을 적용하세요.");
      }
      throw error;
    });
    return safeChannel(channel);
  }

  const channels = await readLocalChannels();
  await writeLocalChannels([channel, ...channels]);
  return safeChannel(channel);
}

export async function updateYouTubeChannel(
  channelId: string,
  input: Partial<{
    analytics_refresh_token: string;
    brand_name: string;
    channel_id: string;
    channel_name: string;
    default_language: string;
    notes: string;
    owner_email: string;
    status: YouTubeChannelStatus;
    upload_refresh_token: string;
    youtube_handle: string;
  }>,
) {
  const updates: Partial<YouTubeChannel> = { updated_at: nowIso() };
  if (input.analytics_refresh_token !== undefined) {
    updates.analytics_refresh_token = input.analytics_refresh_token.trim();
  }
  if (input.brand_name !== undefined) {
    updates.brand_name = input.brand_name.trim();
  }
  if (input.channel_id !== undefined) {
    updates.channel_id = input.channel_id.trim() || null;
  }
  if (input.channel_name !== undefined) {
    updates.channel_name = input.channel_name.trim();
  }
  if (input.default_language !== undefined) {
    updates.default_language = input.default_language.trim();
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes.trim();
  }
  if (input.owner_email !== undefined) {
    updates.owner_email = input.owner_email.trim();
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.upload_refresh_token !== undefined) {
    updates.upload_refresh_token = input.upload_refresh_token.trim();
  }
  if (input.youtube_handle !== undefined) {
    updates.youtube_handle = input.youtube_handle.trim();
  }

  if (getAppStorageMode() === "supabase") {
    const rows = await supabaseRest<YouTubeChannel[]>(channelsTable, {
      body: updates,
      method: "PATCH",
      prefer: "return=representation",
      query: { id: supabaseEq(channelId) },
    });
    if (!rows[0]) {
      throw new Error("채널을 찾을 수 없습니다.");
    }
    return safeChannel(rows[0]);
  }

  const channels = await readLocalChannels();
  const nextChannels = channels.map((channel) =>
    channel.id === channelId ? { ...channel, ...updates } : channel,
  );
  if (!channels.some((channel) => channel.id === channelId)) {
    throw new Error("채널을 찾을 수 없습니다.");
  }
  await writeLocalChannels(nextChannels);
  return safeChannel(nextChannels.find((channel) => channel.id === channelId)!);
}
