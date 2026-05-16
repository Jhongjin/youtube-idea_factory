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

export type YouTubeChannelCredentials = Pick<
  YouTubeChannel,
  | "analytics_refresh_token"
  | "brand_name"
  | "channel_id"
  | "channel_name"
  | "id"
  | "status"
  | "upload_refresh_token"
  | "youtube_handle"
>;

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

function normalizeChannelId(value: string) {
  const channelId = value.trim();
  if (channelId && !/^UC[A-Za-z0-9_-]{20,}$/.test(channelId)) {
    throw new Error("채널 ID는 YouTube Studio에서 확인한 UC... 형식이어야 합니다. 모르면 비워두고 핸들만 입력하세요.");
  }
  return channelId || null;
}

function normalizeYouTubeHandle(value?: string | null) {
  const handle = value?.trim();
  if (!handle) {
    return null;
  }
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function sameText(left?: string | null, right?: string | null) {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function findDuplicateChannel(
  channels: YouTubeChannel[],
  input: {
    brand_name?: string;
    channel_id?: string;
    channel_name?: string;
    youtube_handle?: string | null;
  },
  ignoreChannelId?: string,
) {
  const brandName = input.brand_name?.trim();
  const channelName = input.channel_name?.trim();
  const youtubeHandle = normalizeYouTubeHandle(input.youtube_handle);
  const channelId =
    input.channel_id === undefined ? undefined : normalizeChannelId(input.channel_id);

  return channels.find((channel) => {
    if (channel.id === ignoreChannelId) {
      return false;
    }
    if (youtubeHandle && sameText(channel.youtube_handle, youtubeHandle)) {
      return true;
    }
    if (channelId && sameText(channel.channel_id, channelId)) {
      return true;
    }
    return Boolean(
      brandName &&
        channelName &&
        sameText(channel.brand_name, brandName) &&
        sameText(channel.channel_name, channelName),
    );
  });
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

async function listStoredChannels(): Promise<YouTubeChannel[]> {
  if (getAppStorageMode() === "supabase") {
    return supabaseRest<YouTubeChannel[]>(channelsTable, {
      query: { order: "updated_at.desc", select: "*" },
    }).catch((error) => {
      if (isSupabaseMissingTableError(error)) {
        return [];
      }
      throw error;
    });
  }

  return readLocalChannels();
}

export async function listYouTubeChannels(): Promise<SafeYouTubeChannel[]> {
  return (await listStoredChannels()).map(safeChannel);
}

async function getStoredYouTubeChannel(channelId: string): Promise<YouTubeChannel | null> {
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
    return rows[0] ?? null;
  }

  return (await readLocalChannels()).find((item) => item.id === id) ?? null;
}

export async function getYouTubeChannel(channelId: string): Promise<SafeYouTubeChannel | null> {
  const channel = await getStoredYouTubeChannel(channelId);
  return channel ? safeChannel(channel) : null;
}

export async function getYouTubeChannelCredentials(
  channelId: string,
): Promise<YouTubeChannelCredentials | null> {
  const channel = await getStoredYouTubeChannel(channelId);
  if (!channel) {
    return null;
  }
  return {
    analytics_refresh_token: channel.analytics_refresh_token ?? null,
    brand_name: channel.brand_name,
    channel_id: channel.channel_id,
    channel_name: channel.channel_name,
    id: channel.id,
    status: channel.status,
    upload_refresh_token: channel.upload_refresh_token ?? null,
    youtube_handle: channel.youtube_handle ?? null,
  };
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
  const normalizedChannelId = normalizeChannelId(input.channel_id);
  const normalizedHandle = normalizeYouTubeHandle(input.youtube_handle);
  const existingChannels = await listStoredChannels();
  const duplicate = findDuplicateChannel(existingChannels, input);
  if (duplicate) {
    throw new Error("이미 같은 브랜드/채널 또는 핸들의 채널이 등록되어 있습니다. 기존 카드를 편집하거나 삭제하세요.");
  }

  const channel: YouTubeChannel = {
    analytics_refresh_token: input.analytics_refresh_token?.trim() || null,
    brand_name: input.brand_name.trim(),
    channel_id: normalizedChannelId,
    channel_name: input.channel_name.trim(),
    created_at: timestamp,
    default_language: input.default_language?.trim() || "ko",
    id: randomUUID(),
    notes: input.notes?.trim() || null,
    owner_email: input.owner_email?.trim().toLowerCase() || null,
    status: input.status ?? "setup",
    updated_at: timestamp,
    upload_refresh_token: input.upload_refresh_token?.trim() || null,
    youtube_handle: normalizedHandle,
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
  if (input.brand_name !== undefined && !input.brand_name.trim()) {
    throw new Error("브랜드명은 비워둘 수 없습니다.");
  }
  if (input.channel_name !== undefined && !input.channel_name.trim()) {
    throw new Error("채널명은 비워둘 수 없습니다.");
  }

  const duplicate = findDuplicateChannel(await listStoredChannels(), input, channelId);
  if (duplicate) {
    throw new Error("이미 같은 브랜드/채널, 채널 ID 또는 핸들의 채널이 있습니다. 기존 카드를 편집하거나 삭제하세요.");
  }

  const updates: Partial<YouTubeChannel> = { updated_at: nowIso() };
  if (input.analytics_refresh_token !== undefined) {
    updates.analytics_refresh_token = input.analytics_refresh_token.trim() || null;
  }
  if (input.brand_name !== undefined) {
    updates.brand_name = input.brand_name.trim();
  }
  if (input.channel_id !== undefined) {
    updates.channel_id = normalizeChannelId(input.channel_id);
  }
  if (input.channel_name !== undefined) {
    updates.channel_name = input.channel_name.trim();
  }
  if (input.default_language !== undefined) {
    updates.default_language = input.default_language.trim() || "ko";
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes.trim() || null;
  }
  if (input.owner_email !== undefined) {
    updates.owner_email = input.owner_email.trim().toLowerCase() || null;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.upload_refresh_token !== undefined) {
    updates.upload_refresh_token = input.upload_refresh_token.trim() || null;
  }
  if (input.youtube_handle !== undefined) {
    updates.youtube_handle = normalizeYouTubeHandle(input.youtube_handle);
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

export async function deleteYouTubeChannel(channelId: string) {
  const id = channelId.trim();
  if (!id) {
    throw new Error("채널 ID가 필요합니다.");
  }

  if (getAppStorageMode() === "supabase") {
    await supabaseRest(channelsTable, {
      method: "DELETE",
      prefer: "return=minimal",
      query: { id: supabaseEq(id) },
    });
    return;
  }

  const channels = await readLocalChannels();
  if (!channels.some((channel) => channel.id === id)) {
    throw new Error("채널을 찾을 수 없습니다.");
  }
  await writeLocalChannels(channels.filter((channel) => channel.id !== id));
}
