import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteYouTubeChannel, updateYouTubeChannel } from "@/lib/channels";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  await requireUser({ role: "admin" });
  const { channelId } = await params;
  const body = (await request.json().catch(() => null)) as {
    analytics_refresh_token?: string;
    brand_name?: string;
    channel_id?: string;
    channel_name?: string;
    default_language?: string;
    notes?: string;
    owner_email?: string;
    status?: "active" | "setup" | "paused";
    upload_refresh_token?: string;
    youtube_handle?: string;
  } | null;

  try {
    const channel = await updateYouTubeChannel(channelId, {
      analytics_refresh_token: body?.analytics_refresh_token,
      brand_name: body?.brand_name,
      channel_id: body?.channel_id,
      channel_name: body?.channel_name,
      default_language: body?.default_language,
      notes: body?.notes,
      owner_email: body?.owner_email,
      status: body?.status,
      upload_refresh_token: body?.upload_refresh_token,
      youtube_handle: body?.youtube_handle,
    });
    return NextResponse.json({ channel });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "채널을 수정하지 못했습니다." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  await requireUser({ role: "admin" });
  const { channelId } = await params;

  try {
    await deleteYouTubeChannel(channelId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "채널을 삭제하지 못했습니다." },
      { status: 400 },
    );
  }
}
