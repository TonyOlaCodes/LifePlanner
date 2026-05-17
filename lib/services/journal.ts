import { db, type JournalEntry } from "@/lib/db";

export const journalService = {
  list: () => db.journalEntries.orderBy("createdAt").reverse().toArray(),
  getByDate: (date: string) => db.journalEntries.where("date").equals(date).first(),
  put: (entry: JournalEntry) => db.journalEntries.put(entry),
  delete: (id: string) => db.journalEntries.delete(id),
};
