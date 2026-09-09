const KEY = "studio-player-id";
const NAME_KEY = "studio-player-name";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "Player";
  return sessionStorage.getItem(NAME_KEY) || "Player";
}

export function setPlayerName(name: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NAME_KEY, name.trim() || "Player");
}
