import { db, type PlannerItem, type Routine } from "@/lib/db";

export const plannerService = {
  itemsForDate: (date: string) =>
    db.plannerItems.where("date").equals(date).sortBy("order"),
  putItem: (item: PlannerItem) => db.plannerItems.put(item),
  deleteItem: (id: string) => db.plannerItems.delete(id),
  listRoutines: () => db.routines.where("archived").equals(0).sortBy("order"),
  putRoutine: (routine: Routine) => db.routines.put(routine),
};
