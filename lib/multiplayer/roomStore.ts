import {
  hydrateFromUpstash,
  mergePersistedRooms,
  persistRooms,
} from "./persist";
import type { BoardState, Player, PollState, Room, RoomApp, WaveLockState } from "./types";

const ROOM_TTL_MS = 1000 * 60 * 60 * 2;
const STALE_PLAYER_MS = 1000 * 60 * 5;

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

const rooms: Map<string, Room> = global.__studioRooms ?? mergePersistedRooms(new Map());
if (!global.__studioRooms) global.__studioRooms = rooms;

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function prune() {
  const now = Date.now();
  let changed = false;

  for (const [id, room] of rooms) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(id);
      changed = true;
      continue;
    }
    const active = room.players.filter((p) => now - p.lastSeen < STALE_PLAYER_MS);
    if (active.length !== room.players.length) {
      room.players = active;
      changed = true;
    }
  }

  if (changed) persistRooms(rooms);
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

async function ensureHydrated() {
  await hydrateFromUpstash(rooms);
  mergePersistedRooms(rooms).forEach((room, id) => rooms.set(id, room));
}

export async function createRoom(app: RoomApp, host: Player): Promise<Room> {
  await ensureHydrated();
  prune();
  let id = randomCode();
  while (rooms.has(id)) id = randomCode();

  const room: Room = {
    id,
    app,
    hostId: host.id,
    players: [host],
    bannedIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (app === "wave-lock") room.waveLock = defaultWaveLock();
  if (app === "poll") room.poll = defaultPoll();
  if (app === "board") room.board = defaultBoard();

  rooms.set(id, room);
  persistRooms(rooms);
  return structuredClone(room);
}

export async function getRoom(id: string): Promise<Room | null> {
  await ensureHydrated();
  prune();
  const room = rooms.get(id.toUpperCase());
  return room ? structuredClone(room) : null;
}

export function saveRoom(room: Room): Room {
  room.updatedAt = Date.now();
  rooms.set(room.id, structuredClone(room));
  persistRooms(rooms);
  return room;
}

export function pickColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export function isBanned(room: Room, playerId: string): boolean {
  return room.bannedIds?.includes(playerId) ?? false;
}

export function upsertPlayer(room: Room, player: Player): Room | null {
  if (isBanned(room, player.id)) return null;

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
