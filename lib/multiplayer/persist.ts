import fs from "fs";
import path from "path";
import type { Room } from "./types";

const ROOMS_KEY = "studio:rooms";

function roomsFilePath(): string {
  if (process.env.VERCEL) return "/tmp/studio-rooms.json";
  return path.join(process.cwd(), ".data", "studio-rooms.json");
}

function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashGet(): Promise<string | null> {
  if (!hasUpstash()) return null;
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify(["GET", ROOMS_KEY]),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | null };
  return data.result ?? null;
}

async function upstashSet(json: string): Promise<void> {
  if (!hasUpstash()) return;
  await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify(["SET", ROOMS_KEY, json]),
    cache: "no-store",
  }).catch(() => undefined);
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

let upstashLoaded = false;
let upstashLoadPromise: Promise<void> | null = null;

export function roomsToRecord(map: Map<string, Room>): Record<string, Room> {
  return Object.fromEntries(map);
}

export function recordToRooms(record: Record<string, Room>): Map<string, Room> {
  const map = new Map<string, Room>();
  for (const [id, room] of Object.entries(record)) {
    map.set(id.toUpperCase(), room);
  }
  return map;
}

/** Merge persisted rooms into the in-memory map (newest updatedAt wins). */
export function mergePersistedRooms(memory: Map<string, Room>): Map<string, Room> {
  const fileRecord = readFile();
  const merged = new Map(memory);

  for (const [id, room] of Object.entries(fileRecord)) {
    const key = id.toUpperCase();
    const existing = merged.get(key);
    if (!existing || room.updatedAt >= existing.updatedAt) {
      merged.set(key, room);
    }
  }

  return merged;
}

export function persistRooms(map: Map<string, Room>): void {
  const record = roomsToRecord(map);
  writeFile(record);
  void upstashSet(JSON.stringify(record));
}

export async function hydrateFromUpstash(memory: Map<string, Room>): Promise<Map<string, Room>> {
  if (!hasUpstash() || upstashLoaded) return memory;
  if (!upstashLoadPromise) {
    upstashLoadPromise = (async () => {
      const raw = await upstashGet();
      upstashLoaded = true;
      if (!raw) return;
      try {
        const record = JSON.parse(raw) as Record<string, Room>;
        for (const [id, room] of Object.entries(record)) {
          const key = id.toUpperCase();
          const existing = memory.get(key);
          if (!existing || room.updatedAt >= existing.updatedAt) {
            memory.set(key, room);
          }
        }
      } catch {
        // ignore corrupt remote data
      }
    })();
  }
  await upstashLoadPromise;
  return memory;
}
