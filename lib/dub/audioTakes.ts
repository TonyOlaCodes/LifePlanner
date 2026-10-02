export type VoiceTake = {
  id: string;
  /** Seconds into the song when this take starts */
  offset: number;
  duration: number;
  blob: Blob;
  url: string;
};

export function revokeTake(take: VoiceTake) {
  URL.revokeObjectURL(take.url);
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
