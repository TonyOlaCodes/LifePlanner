/** Daily bypass: letters/digits of username (lower) + day of month, e.g. "Tony" on the 14th → "tony14". */
export function getJournalDailyUnlockCode(userName: string): string {
  const alpha = (userName || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const day = new Date().getDate();
  return `${alpha}${day}`;
}

export function matchesJournalDailyUnlock(attempt: string, userName: string): boolean {
  const a = attempt.replace(/\s/g, "").toLowerCase();
  const k = getJournalDailyUnlockCode(userName);
  return a.length > 0 && k.length > 0 && a === k;
}
