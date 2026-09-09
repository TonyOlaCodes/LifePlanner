import type { BoardState, Player, PollState, Room, RoomApp, WaveLockState } from "./types";

const ROOM_TTL_MS = 1000 * 60 * 60 * 2;
const STALE_PLAYER_MS = 1000 * 45;

const PLAYER_COLORS = [
  "#FB7185",
  "#A78BFA",
  "#38BDF8",
  "#FBBF24",
  "#6EE7B7",
  "#F472B6",
  "#34D399",
  "#60A5FA",
  "#F97316",
  "#E879F9",
  "#2DD4BF",
  "#F87171",
];

declare global {
  // eslint-disable-next-line no-var
  var __studioRooms: Map<string, Room> | undefined;
}

const rooms: Map<string, Room> = global.__studioRooms ?? new Map();
if (!global.__studioRooms) global.__studioRooms = rooms;

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function prune() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(id);
      continue;
    }
    room.players = room.players.filter((p) => now - p.lastSeen < STALE_PLAYER_MS);
    if (room.players.length === 0) rooms.delete(id);
  }
}

function defaultWaveLock(): WaveLockState {
  return {
    phase: "lobby",
    round: 0,
    maxRounds: 5,
    phaseStartedAt: 0,
    presses: {},
    roundSyncMs: null,
    roundScores: [],
    totalScore: 0,
    countdown: 3,
  };
}

function defaultPoll(): PollState {
  return {
    question: "What should we do tonight?",
    options: ["Pizza", "Movie", "Game night", "Surprise me"],
    votes: { 0: 0, 1: 0, 2: 0, 3: 0 },
    voted: {},
  };
}

function defaultBoard(): BoardState {
  return { wallWidth: 2800, wallHeight: 2000, notes: [], strokes: [] };
}

export function createRoom(app: RoomApp, host: Player): Room {
  prune();
  let id = randomCode();
  while (rooms.has(id)) id = randomCode();

  const room: Room = {
    id,
    app,
    hostId: host.id,
    players: [host],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (app === "wave-lock") room.waveLock = defaultWaveLock();
  if (app === "poll") room.poll = defaultPoll();
  if (app === "board") room.board = defaultBoard();

  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | null {
  prune();
  const room = rooms.get(id.toUpperCase());
  return room ? structuredClone(room) : null;
}

export function saveRoom(room: Room): Room {
  room.updatedAt = Date.now();
  rooms.set(room.id, structuredClone(room));
  return room;
}

export function pickColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export function upsertPlayer(room: Room, player: Player): Room {
  const idx = room.players.findIndex((p) => p.id === player.id);
  if (idx >= 0) {
    room.players[idx] = { ...room.players[idx], ...player, lastSeen: Date.now() };
  } else {
    room.players.push({
      ...player,
      color: player.color || pickColor(room.players.length),
      lastSeen: Date.now(),
    });
  }
  return saveRoom(room);
}

export function touchPlayer(room: Room, playerId: string): Room | null {
  const p = room.players.find((x) => x.id === playerId);
  if (!p) return null;
  p.lastSeen = Date.now();
  return saveRoom(room);
}

export function allReady(room: Room): boolean {
  return room.players.length >= 2 && room.players.every((p) => p.ready);
}

export function waveLockExpectedTapMs(playerIndex: number, playerCount: number, durationMs = 3600): number {
  const slot = (playerIndex + 0.5) / playerCount;
  return slot * durationMs;
}

export function scoreWaveLockTap(expectedMs: number, actualMs: number): number {
  const delta = Math.abs(expectedMs - actualMs);
  return Math.max(0, Math.round(1000 - delta * 1.4));
}
