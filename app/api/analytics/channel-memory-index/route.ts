import { getChannelMemoryIndex } from "@/lib/channel-memory-index";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ index: await getChannelMemoryIndex() });
}
