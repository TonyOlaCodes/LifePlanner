import fs from "fs";
import path from "path";
import type { Room } from "./types";

const ROOMS_KEY = "studio:rooms";

function roomsFilePath(): string {
  if (process.env.VERCEL) return "/tmp/studio-rooms.json";
  return path.join(process.cwd(), ".data", "studio-rooms.json");
}

function redisRestConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function redisRestGet(): Promise<string | null> {
  const cfg = redisRestConfig();
  if (!cfg) return null;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(["GET", ROOMS_KEY]),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | null };
  return data.result ?? null;
}

async function redisRestSet(json: string): Promise<void> {
  const cfg = redisRestConfig();
  if (!cfg) return;
  await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(["SET", ROOMS_KEY, json]),
    cache: "no-store",
  });
}

async function kvGet(): Promise<string | null> {
  try {
    const { kv } = await import("@vercel/kv");
    const value = await kv.get<string>(ROOMS_KEY);
    return value ?? null;
  } catch {
    return null;
  }
}

async function kvSet(json: string): Promise<void> {
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(ROOMS_KEY, json);
  } catch {
    // KV not configured
  }
}

function readFile(): Record<string, Room> {
  try {
    const file = roomsFilePath();
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as Record<string, Room>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFile(rooms: Record<string, Room>): void {
  try {
    const file = roomsFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(rooms));
  } catch {
    // ignore write failures on read-only hosts
  }
}

export function roomsToRecord(map: Map<string, Room>): Record<string, Room> {
  return Object.fromEntries(map);
}

function mergeRecord(into: Map<string, Room>, record: Record<string, Room>) {
  for (const [id, room] of Object.entries(record)) {
    const key = id.toUpperCase();
    const existing = into.get(key);
    if (!existing || room.updatedAt >= existing.updatedAt) {
      into.set(key, room);
    }
  }
}

export function mergePersistedRooms(memory: Map<string, Room>): Map<string, Room> {
  const merged = new Map(memory);
  mergeRecord(merged, readFile());
  return merged;
}

/** Load rooms from every configured backend (newest updatedAt wins). */
export async function loadAllRooms(memory: Map<string, Room>): Promise<Map<string, Room>> {
  const merged = mergePersistedRooms(memory);

  const [kvRaw, redisRaw] = await Promise.all([kvGet(), redisRestGet()]);
  for (const raw of [kvRaw, redisRaw]) {
    if (!raw) continue;
    try {
      mergeRecord(merged, JSON.parse(raw) as Record<string, Room>);
    } catch {
      // ignore corrupt remote data
    }
  }

  return merged;
}

export async function persistRooms(map: Map<string, Room>): Promise<void> {
  const record = roomsToRecord(map);
  const json = JSON.stringify(record);
  writeFile(record);
  await Promise.all([kvSet(json), redisRestSet(json)]);
}

export function hasSharedStorage(): boolean {
  return Boolean(redisRestConfig() || process.env.KV_REST_API_URL || process.env.KV_URL);
}
