/** Internal helpers — not described in the app UI. */

function dailyUserKey(userName: string): string {
  const alpha = (userName || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const day = new Date().getDate();
  return `${alpha}${day}`;
}

export function matchesJournalDailyUnlock(attempt: string, userName: string): boolean {
  const a = attempt.replace(/\s/g, "").toLowerCase();
  const k = dailyUserKey(userName);
  return a.length > 0 && k.length > 0 && a === k;
}

/** Silent recovery options (never copy in UI). */
export function matchesJournalSilentUnlock(
  attempt: string,
  ctx: { userName: string; todayIso: string }
): boolean {
  const t = attempt.trim().replace(/\s/g, "");
  if (!t) return false;
  if (matchesJournalDailyUnlock(attempt, ctx.userName)) return true;
  if (t === ctx.todayIso) return true;
  const dom = new Date().getDate();
  const s = String(dom);
  if (t === s) return true;
  if (t === s.padStart(2, "0")) return true;
  return false;
}
