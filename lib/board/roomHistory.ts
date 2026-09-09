export type SavedBoardRoom = {
  id: string;
  label: string;
  role: "host" | "member";
  lastVisited: number;
};

const KEY = "orbit-board-rooms";

export function loadBoardRooms(): SavedBoardRoom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedBoardRoom[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.lastVisited - a.lastVisited) : [];
  } catch {
    return [];
  }
}

export function rememberBoardRoom(entry: SavedBoardRoom) {
  if (typeof window === "undefined") return;
  const list = loadBoardRooms().filter((r) => r.id !== entry.id);
  list.unshift({ ...entry, lastVisited: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
}

export function removeBoardRoom(id: string) {
  if (typeof window === "undefined") return;
  const list = loadBoardRooms().filter((r) => r.id !== id.toUpperCase());
  localStorage.setItem(KEY, JSON.stringify(list));
}
