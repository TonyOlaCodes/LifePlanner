import { db, type AnalyticsSnapshot } from "@/lib/db";

export const analyticsService = {
  listForDate: (date: string) => db.analyticsSnapshots.where("date").equals(date).toArray(),
  listByType: (type: string) => db.analyticsSnapshots.where("type").equals(type).toArray(),
  save: (snapshot: AnalyticsSnapshot) => db.analyticsSnapshots.put(snapshot),
  saveDaily: async (date: string, type: string, data: Record<string, unknown>) => {
    await db.analyticsSnapshots.put({
      id: `${date}:${type}`,
      date,
      type,
      data,
      createdAt: Date.now(),
    });
  },
};
