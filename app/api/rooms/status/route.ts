import { NextResponse } from "next/server";
import { hasSharedStorage } from "@/lib/multiplayer/persist";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      sharedStorage: hasSharedStorage(),
      hint: hasSharedStorage()
        ? "Room storage is configured."
        : "Add Vercel KV (or Upstash Redis) in your Vercel project Storage tab, then redeploy.",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
