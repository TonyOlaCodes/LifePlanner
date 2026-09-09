import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  allReady,
  getRoom,
  saveRoom,
  scoreWaveLockTap,
  touchPlayer,
  upsertPlayer,
  waveLockExpectedTapMs,
} from "@/lib/multiplayer/store";
import type { BoardNote, BoardStroke, Room } from "@/lib/multiplayer/types";

export const dynamic = "force-dynamic";

const ROUND_MS = 3600;

function snapshot(room: Room) {
  return { ...room, serverNow: Date.now() };
}

function getWaveLock(room: Room) {
  if (!room.waveLock) throw new Error("Invalid room");
  return room.waveLock;
}

function advanceWaveLockIfNeeded(room: Room): Room {
  const wl = getWaveLock(room);
  const now = Date.now();

  if (wl.phase === "countdown" && wl.phaseStartedAt > 0 && now - wl.phaseStartedAt >= wl.countdown * 1000) {
    wl.phase = "playing";
    wl.phaseStartedAt = now;
    wl.presses = Object.fromEntries(room.players.map((p) => [p.id, null]));
  }

  if (wl.phase === "playing" && wl.phaseStartedAt > 0 && now - wl.phaseStartedAt >= ROUND_MS + 800) {
    const presses = room.players
      .map((p, i) => {
        const t = wl.presses[p.id];
        if (t == null) return 0;
        const expected = waveLockExpectedTapMs(i, room.players.length, ROUND_MS);
        return scoreWaveLockTap(expected, t);
      })
      .filter((s) => s >= 0);

    const avg = presses.length ? Math.round(presses.reduce((a, b) => a + b, 0) / presses.length) : 0;
    wl.roundSyncMs = avg;
    wl.roundScores.push(avg);
    wl.totalScore = wl.roundScores.reduce((a, b) => a + b, 0);
    wl.phase = "round-result";
    wl.phaseStartedAt = now;
  }

  if (wl.phase === "round-result" && wl.phaseStartedAt > 0 && now - wl.phaseStartedAt >= 2800) {
    if (wl.round + 1 >= wl.maxRounds) {
      wl.phase = "finished";
    } else {
      wl.round += 1;
      wl.phase = "countdown";
      wl.countdown = 3;
      wl.phaseStartedAt = now;
      wl.presses = Object.fromEntries(room.players.map((p) => [p.id, null]));
      wl.roundSyncMs = null;
      room.players.forEach((p) => {
        p.ready = false;
      });
    }
  }

  room.waveLock = wl;
  return saveRoom(room);
}

export async function GET(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId") || "";

  let room = getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  if (playerId) {
    const member = room.players.find((p) => p.id === playerId);
    if (!member) {
      return NextResponse.json({ error: "Not in room" }, { status: 403 });
    }
    const touched = touchPlayer(room, playerId);
    if (touched) room = touched;
  }

  if (room.app === "wave-lock") {
    room = advanceWaveLockIfNeeded(room);
  }

  return NextResponse.json(snapshot(room));
}

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const body = (await req.json()) as {
    action?: string;
    playerId?: string;
    playerName?: string;
    ready?: boolean;
    optionIndex?: number;
    noteText?: string;
    noteId?: string;
    noteX?: number;
    noteY?: number;
    noteColor?: string;
    strokes?: Array<{
      id?: string;
      tool?: string;
      color?: string;
      width?: number;
      points?: { x: number; y: number }[];
    }>;
    targetPlayerId?: string;
    question?: string;
    options?: string[];
  };

  let room = getRoom(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const playerId = body.playerId?.trim();
  if (!playerId) return NextResponse.json({ error: "Missing playerId" }, { status: 400 });

  const action = body.action || "";
  const isMember = room.players.some((p) => p.id === playerId);

  if (action !== "join" && action !== "heartbeat" && !isMember) {
    return NextResponse.json({ error: "Not in room" }, { status: 403 });
  }

  if (action === "heartbeat" || action === "join") {
    room = upsertPlayer(room, {
      id: playerId,
      name: body.playerName?.trim() || "Player",
      ready: false,
      lastSeen: Date.now(),
      color: room.players.find((p) => p.id === playerId)?.color || "#FB7185",
    });
    return NextResponse.json(snapshot(room));
  }

  if (action === "ready") {
    const p = room.players.find((x) => x.id === playerId);
    if (!p) return NextResponse.json({ error: "Player not in room" }, { status: 403 });
    p.ready = !!body.ready;
    p.lastSeen = Date.now();
    room = saveRoom(room);
    return NextResponse.json(snapshot(room));
  }

  if (action === "reset-lobby" && room.app === "wave-lock") {
    const wl = getWaveLock(room);
    wl.phase = "lobby";
    wl.round = 0;
    wl.roundScores = [];
    wl.totalScore = 0;
    wl.presses = {};
    wl.roundSyncMs = null;
    wl.phaseStartedAt = 0;
    room.players.forEach((p) => {
      p.ready = false;
    });
    room.waveLock = wl;
    room = saveRoom(room);
    return NextResponse.json(snapshot(room));
  }

  if (action === "start" && room.app === "wave-lock") {
    if (!allReady(room)) {
      return NextResponse.json({ error: "Everyone must be ready first" }, { status: 400 });
    }
    const wl = getWaveLock(room);
    wl.phase = "countdown";
    wl.round = 0;
    wl.roundScores = [];
    wl.totalScore = 0;
    wl.countdown = 3;
    wl.phaseStartedAt = Date.now();
    wl.presses = Object.fromEntries(room.players.map((p) => [p.id, null]));
    room.waveLock = wl;
    room = saveRoom(room);
    return NextResponse.json(snapshot(room));
  }

  if (action === "tap" && room.app === "wave-lock") {
    let r = advanceWaveLockIfNeeded(room);
    const wl = getWaveLock(r);
    if (wl.phase !== "playing") {
      return NextResponse.json({ error: "Not in play phase" }, { status: 400 });
    }
    if (wl.presses[playerId] != null) {
      return NextResponse.json(snapshot(r));
    }
    wl.presses[playerId] = Date.now() - wl.phaseStartedAt;
    r.waveLock = wl;
    r = saveRoom(r);
    return NextResponse.json(snapshot(r));
  }

  if (room.app === "poll") {
    if (!room.poll) room.poll = { question: "", options: [], votes: {}, voted: {} };

    if (action === "set-poll") {
      const opts = (body.options || []).map((o) => o.trim()).filter(Boolean).slice(0, 6);
      if (!body.question?.trim() || opts.length < 2) {
        return NextResponse.json({ error: "Need a question and at least 2 options" }, { status: 400 });
      }
      room.poll = {
        question: body.question.trim(),
        options: opts,
        votes: Object.fromEntries(opts.map((_, i) => [i, 0])),
        voted: {},
      };
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }

    if (action === "vote") {
      const idx = body.optionIndex;
      if (idx == null || !room.poll.options[idx]) {
        return NextResponse.json({ error: "Invalid option" }, { status: 400 });
      }
      const prev = room.poll.voted[playerId];
      if (prev != null) room.poll.votes[prev] = Math.max(0, (room.poll.votes[prev] || 0) - 1);
      room.poll.voted[playerId] = idx;
      room.poll.votes[idx] = (room.poll.votes[idx] || 0) + 1;
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }
  }

  if (room.app === "board") {
    if (!room.board) room.board = { wallWidth: 2800, wallHeight: 2000, notes: [], strokes: [] };
    if (!room.board.strokes) room.board.strokes = [];
    if (!room.board.wallWidth) room.board.wallWidth = 2800;
    if (!room.board.wallHeight) room.board.wallHeight = 2000;
    for (const n of room.board.notes) {
      if (n.rotation == null) n.rotation = 0;
      if (n.x <= 100 && n.y <= 100) {
        n.x = (n.x / 100) * (room.board.wallWidth - 200) + 80;
        n.y = (n.y / 100) * (room.board.wallHeight - 200) + 80;
      }
    }

    if (action === "kick-player") {
      if (room.hostId !== playerId) {
        return NextResponse.json({ error: "Only the host can kick players" }, { status: 403 });
      }
      const target = body.targetPlayerId?.trim();
      if (!target || target === playerId) {
        return NextResponse.json({ error: "Invalid player" }, { status: 400 });
      }
      room.players = room.players.filter((p) => p.id !== target);
      if (room.players.length === 0) {
        return NextResponse.json({ error: "Cannot kick everyone" }, { status: 400 });
      }
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }

    if (action === "add-note") {
      const text = body.noteText?.trim();
      if (!text) return NextResponse.json({ error: "Empty note" }, { status: 400 });
      const author = room.players.find((p) => p.id === playerId);
      const w = room.board.wallWidth || 2800;
      const h = room.board.wallHeight || 2000;
      const note: BoardNote = {
        id: randomUUID(),
        authorId: playerId,
        authorName: author?.name || "Player",
        color: body.noteColor || "yellow",
        text: text.slice(0, 280),
        x: typeof body.noteX === "number" ? body.noteX : 120 + Math.random() * (w - 320),
        y: typeof body.noteY === "number" ? body.noteY : 120 + Math.random() * (h - 280),
        rotation: Math.round((Math.random() - 0.5) * 8),
        createdAt: Date.now(),
      };
      room.board.notes.unshift(note);
      if (room.board.notes.length > 60) room.board.notes.length = 60;
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }

    if (action === "move-note") {
      const noteId = body.noteId?.trim();
      if (!noteId || typeof body.noteX !== "number" || typeof body.noteY !== "number") {
        return NextResponse.json({ error: "Invalid move" }, { status: 400 });
      }
      const note = room.board.notes.find((n) => n.id === noteId);
      if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
      if (note.authorId !== playerId && room.hostId !== playerId) {
        return NextResponse.json({ error: "You can only move your own notes" }, { status: 403 });
      }
      const w = room.board.wallWidth || 2800;
      const h = room.board.wallHeight || 2000;
      note.x = Math.max(0, Math.min(w - 160, body.noteX));
      note.y = Math.max(0, Math.min(h - 160, body.noteY));
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }

    if (action === "add-strokes") {
      const incoming = body.strokes || [];
      if (!incoming.length) return NextResponse.json(snapshot(room));
      for (const s of incoming.slice(0, 8)) {
        if (!s.points?.length) continue;
        room.board.strokes.push({
          id: s.id || randomUUID(),
          authorId: playerId,
          tool: (s.tool as BoardStroke["tool"]) || "pen",
          color: s.color || "#FFFFFF",
          width: s.width || 2,
          points: s.points.slice(0, 400),
          createdAt: Date.now(),
        });
      }
      if (room.board.strokes.length > 800) {
        room.board.strokes = room.board.strokes.slice(-800);
      }
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }

    if (action === "clear-board" && room.hostId === playerId) {
      room.board.notes = [];
      room.board.strokes = [];
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }

    if (action === "clear-drawings" && room.hostId === playerId) {
      room.board.strokes = [];
      room = saveRoom(room);
      return NextResponse.json(snapshot(room));
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
