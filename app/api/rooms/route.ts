import { NextResponse } from "next/server";
import { createRoom, getRoom, isBanned, pickColor, upsertPlayer } from "@/lib/multiplayer/roomStore";
import type { RoomApp } from "@/lib/multiplayer/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    app?: RoomApp;
    roomId?: string;
    playerId?: string;
    playerName?: string;
  };

  const app = body.app;
  const playerId = body.playerId?.trim();
  const playerName = body.playerName?.trim() || "Player";

  if (!app || !playerId) {
    return NextResponse.json({ error: "Missing app or playerId" }, { status: 400 });
  }

  if (body.roomId) {
    const existing = await getRoom(body.roomId);
    if (!existing) {
      return NextResponse.json(
        { error: "Room not found — it may have expired. Create a new room." },
        { status: 404 },
      );
    }
    if (existing.app !== app) {
      return NextResponse.json({ error: "Wrong app for this room" }, { status: 400 });
    }
    if (isBanned(existing, playerId)) {
      return NextResponse.json({ error: "Removed from room" }, { status: 403 });
    }

    const existingPlayer = existing.players.find((p) => p.id === playerId);
    const updated = upsertPlayer(existing, {
      id: playerId,
      name: playerName,
      ready: existingPlayer?.ready ?? false,
      lastSeen: Date.now(),
      color: existingPlayer?.color || pickColor(existing.players.length),
    });
    if (!updated) {
      return NextResponse.json({ error: "Removed from room" }, { status: 403 });
    }

    return NextResponse.json({ ...updated, serverNow: Date.now() });
  }

  const room = await createRoom(app, {
    id: playerId,
    name: playerName,
    ready: false,
    lastSeen: Date.now(),
    color: pickColor(0),
  });

  return NextResponse.json({ ...room, serverNow: Date.now() });
}
