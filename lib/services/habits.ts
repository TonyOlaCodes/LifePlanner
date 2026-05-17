import { db, type Habit, type HabitLog } from "@/lib/db";

export const habitsService = {
  listActive: () => db.habits.where("archived").equals(0).sortBy("order"),
  listLogsForDate: (date: string) => db.habitLogs.where("date").equals(date).toArray(),
  upsertLog: (log: HabitLog) => db.habitLogs.put(log),
  putHabit: (habit: Habit) => db.habits.put(habit),
  deleteHabit: (id: string) => db.habits.delete(id),
};
