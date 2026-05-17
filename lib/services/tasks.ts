import { db, type Task } from "@/lib/db";

export const tasksService = {
  listAll: () => db.tasks.orderBy("createdAt").reverse().toArray(),
  listDue: (today: string) =>
    db.tasks
      .filter((t) => !t.completed && (!t.dueDate || t.dueDate <= today))
      .toArray(),
  put: (task: Task) => db.tasks.put(task),
  delete: (id: string) => db.tasks.delete(id),
  toggle: async (id: string) => {
    const t = await db.tasks.get(id);
    if (!t) return;
    await db.tasks.update(id, { completed: !t.completed });
  },
};
