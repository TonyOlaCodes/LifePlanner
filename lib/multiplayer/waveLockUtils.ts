export function waveLockExpectedTapMs(playerIndex: number, playerCount: number, durationMs = 3600): number {
  const slot = (playerIndex + 0.5) / playerCount;
  return slot * durationMs;
}

export function scoreWaveLockTap(expectedMs: number, actualMs: number): number {
  const delta = Math.abs(expectedMs - actualMs);
  return Math.max(0, Math.round(1000 - delta * 1.4));
}
