import { db } from "@/lib/db";
import { captureFrontCameraJpeg } from "@/lib/captureFrontCamera";

const MAX_SNAPSHOTS = 30;

/** On failed journal unlock, capture front camera and store locally (best-effort, non-blocking). */
export async function recordJournalUnlockFailure(): Promise<void> {
  try {
    const blob = await captureFrontCameraJpeg();
    if (!blob) return;

    await db.journalSecuritySnapshots.put({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      reason: "journal_unlock_fail",
      imageBlob: blob,
    });

    const all = await db.journalSecuritySnapshots.orderBy("createdAt").toArray();
    if (all.length > MAX_SNAPSHOTS) {
      const toDelete = all.slice(0, all.length - MAX_SNAPSHOTS);
      await db.journalSecuritySnapshots.bulkDelete(toDelete.map((s) => s.id));
    }
  } catch {
    // Camera or storage may fail; do not surface to the unlock UI.
  }
}
