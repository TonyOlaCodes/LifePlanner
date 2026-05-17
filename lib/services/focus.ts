import { addFocusSecondsForDate, db } from "@/lib/db";

export const focusService = {
  getDay: (date: string) => db.focusDaily.get(date),
  addSeconds: (date: string, seconds: number) => addFocusSecondsForDate(date, seconds),
  listAll: () => db.focusDaily.toArray(),
};
