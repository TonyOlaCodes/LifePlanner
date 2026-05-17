import { db, getStreakForHabit, type HabitLog, type StreakRecord } from "@/lib/db";

export const streaksService = {
  get: (entityType: StreakRecord["entityType"], entityId: string) =>
    db.streakRecords.get(`${entityType}:${entityId}`),
  upsert: (record: StreakRecord) => db.streakRecords.put(record),
  syncHabitStreak: async (habitId: string, logs: HabitLog[], lastActiveDate: string) => {
    const current = getStreakForHabit(logs, habitId);
    const id = `habit:${habitId}`;
    const existing = await db.streakRecords.get(id);
    const best = Math.max(existing?.bestStreak ?? 0, current);
    await db.streakRecords.put({
      id,
      entityType: "habit",
      entityId: habitId,
      currentStreak: current,
      bestStreak: best,
      lastActiveDate,
      updatedAt: Date.now(),
    });
  },
};
