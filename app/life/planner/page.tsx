"use client";

import type { CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, getTodayString, type Task } from "@/lib/db";
import { vibrate } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import { Plus, CheckCircle2, Circle, Trash2, ClipboardList } from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

const PRIORITIES = ["high", "medium", "low"] as const;
const P_COLOR: Record<string, string> = { high: "#EF4444", medium: "#F59E0B", low: "#10B981" };
const CAT_COLOR: Record<string, string> = {
  study: "#10B981",
  coding: "#8B5CF6",
  exam: "#3B82F6",
  gym: "#EF4444",
  faith: "#F59E0B",
  personal: "#EC4899",
  work: "#06B6D4",
  other: "#F97316",
};
const CATEGORIES = [
  { value: "study", label: "📚 Study" },
  { value: "coding", label: "💻 Coding" },
  { value: "exam", label: "📝 Exam" },
  { value: "gym", label: "💪 Gym" },
  { value: "faith", label: "🙏 Faith" },
  { value: "personal", label: "⭐ Personal" },
  { value: "work", label: "💼 Work" },
  { value: "other", label: "📌 Other" },
];

type TaskSort = "due" | "priority" | "created" | "category";
type TaskFilter = "due" | "completed" | "both";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const TASK_SORT_OPTIONS: { id: TaskSort; label: string }[] = [
  { id: "due", label: "Due date" },
  { id: "priority", label: "Importance" },
  { id: "created", label: "Date created" },
  { id: "category", label: "Category" },
];

const TASK_CATEGORY_ORDER = CATEGORIES.map((c) => c.value);
function taskCategoryRank(category: string): number {
  const i = TASK_CATEGORY_ORDER.indexOf(category);
  return i === -1 ? 99 : i;
}

const TASK_FILTER_OPTIONS: { id: TaskFilter; label: string }[] = [
  { id: "due", label: "Due (incomplete)" },
  { id: "completed", label: "Completed" },
  { id: "both", label: "Due + completed" },
];

function compareIncompleteTasks(a: Task, b: Task, taskSort: TaskSort): number {
  if (taskSort === "category") {
    const cx = taskCategoryRank(a.category) - taskCategoryRank(b.category);
    if (cx !== 0) return cx;
    const da = a.dueDate ?? "";
    const dbDue = b.dueDate ?? "";
    if (da !== dbDue) return da.localeCompare(dbDue);
    return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
  }
  if (taskSort === "created") {
    const c = (b.createdAt ?? 0) - (a.createdAt ?? 0);
    if (c !== 0) return c;
    const pr = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (pr !== 0) return pr;
    return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  }
  if (taskSort === "priority") {
    const pr = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (pr !== 0) return pr;
    const da = a.dueDate ?? "";
    const dbDue = b.dueDate ?? "";
    if (da !== dbDue) return da.localeCompare(dbDue);
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  }
  const da = a.dueDate ?? "";
  const dbDue = b.dueDate ?? "";
  if (!da && !dbDue) return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  if (!da) return 1;
  if (!dbDue) return -1;
  if (da !== dbDue) return da.localeCompare(dbDue);
  const pr = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
  if (pr !== 0) return pr;
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

function compareCompletedTasks(a: Task, b: Task, taskSort: TaskSort): number {
  if (taskSort === "category") {
    const cx = taskCategoryRank(a.category) - taskCategoryRank(b.category);
    if (cx !== 0) return cx;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  }
  if (taskSort === "created") {
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  }
  if (taskSort === "priority") {
    const pr = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (pr !== 0) return pr;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  }
  const da = a.dueDate ?? "";
  const dbDue = b.dueDate ?? "";
  if (!da && !dbDue) return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  if (!da) return 1;
  if (!dbDue) return -1;
  if (da !== dbDue) return dbDue.localeCompare(da);
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

export default function PlannerPage() {
  const today = getTodayString();
  const [addOpen, setAddOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    category: "study",
    priority: "medium" as (typeof PRIORITIES)[number],
    dueDate: today,
    noDueDate: false,
  });
  const [editingTask, setEditingTask] = useState<(Task & { noDueDate: boolean }) | null>(null);
  const [taskSort, setTaskSort] = useState<TaskSort>("due");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("both");

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);

  const { listTasks, doneCount, totalCount } = useMemo(() => {
    const all = tasks || [];
    const incomplete = all.filter((t) => !t.completed);
    const completed = all.filter((t) => t.completed);
    let list: Task[] = [];
    if (taskFilter === "due") {
      list = [...incomplete].sort((a, b) => compareIncompleteTasks(a, b, taskSort));
    } else if (taskFilter === "completed") {
      list = [...completed].sort((a, b) => compareCompletedTasks(a, b, taskSort));
    } else {
      const inc = [...incomplete].sort((a, b) => compareIncompleteTasks(a, b, taskSort));
      const comp = [...completed].sort((a, b) => compareCompletedTasks(a, b, taskSort));
      list = [...inc, ...comp];
    }
    return {
      listTasks: list,
      doneCount: completed.length,
      totalCount: all.length,
    };
  }, [tasks, taskFilter, taskSort]);

  function taskDueUrgency(task: Task): "overdue" | "soon" | "none" {
    if (task.completed || !task.dueDate) return "none";
    const delta = differenceInCalendarDays(parseISO(task.dueDate), parseISO(today));
    if (delta < 0) return "overdue";
    if (delta <= 3) return "soon";
    return "none";
  }

  const pendingCount = (tasks || []).filter((t) => !t.completed).length;

  async function addTask() {
    vibrate(50);
    if (!taskForm.title.trim()) return;
    await db.tasks.put({
      id: crypto.randomUUID(),
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      category: taskForm.category,
      completed: false,
      priority: taskForm.priority,
      dueDate: taskForm.noDueDate ? undefined : taskForm.dueDate,
      createdAt: Date.now(),
    });
    setTaskForm({ title: "", description: "", category: "study", priority: "medium", dueDate: today, noDueDate: false });
    setAddOpen(false);
  }

  function openTask(task: Task) {
    vibrate(20);
    setEditingTask({ ...task, dueDate: task.dueDate ?? today, noDueDate: !task.dueDate });
  }

  async function saveTaskEdit() {
    if (!editingTask || !editingTask.title.trim()) return;
    vibrate(40);
    await db.tasks.update(editingTask.id, {
      title: editingTask.title.trim(),
      description: editingTask.description?.trim() || undefined,
      category: editingTask.category,
      priority: editingTask.priority,
      dueDate: editingTask.noDueDate ? undefined : editingTask.dueDate,
      completed: editingTask.completed,
    });
    setEditingTask(null);
  }

  async function toggleTask(task: Task) {
    vibrate(40);
    await db.tasks.update(task.id, { completed: !task.completed });
  }

  async function deleteTask(id: string) {
    vibrate([20, 20, 20]);
    await db.tasks.delete(id);
    setEditingTask((t) => (t?.id === id ? null : t));
  }

  const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

  const selectStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface-3)",
    color: "var(--text-primary)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "0 16px", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>Tasks 📋</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0 0" }}>
            {pendingCount} pending · {doneCount} done ({totalCount} total)
          </p>
        </div>
        <button
          className="tap-scale"
          onClick={() => {
            setTaskForm((f) => ({ ...f, dueDate: today, noDueDate: false }));
            setAddOpen(true);
          }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "var(--accent)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Plus size={22} style={{ color: "#000" }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Show</label>
          <select className="lock-input" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as TaskFilter)} style={{ ...selectStyle, width: "100%" }}>
            {TASK_FILTER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Sort by</label>
          <select className="lock-input" value={taskSort} onChange={(e) => setTaskSort(e.target.value as TaskSort)} style={{ ...selectStyle, width: "100%" }}>
            {TASK_SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section style={{ marginBottom: 32 }}>
        {listTasks.length === 0 ? (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              borderRadius: 20,
              background: "var(--surface-2)",
              border: "1px dashed var(--border)",
            }}
          >
            <ClipboardList size={28} style={{ color: "var(--text-tertiary)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: 0 }}>No tasks match this filter</p>
            <button
              onClick={() => {
                setTaskForm((f) => ({ ...f, dueDate: today, noDueDate: false }));
                setAddOpen(true);
              }}
              style={{
                marginTop: 12,
                padding: "10px 20px",
                borderRadius: 12,
                background: "var(--accent)",
                border: "none",
                color: "#000",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Add Task
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {listTasks.map((task) => {
              const urg = taskDueUrgency(task);
              const urgentGlow = !task.completed && urg !== "none";
              const borderCol = urgentGlow
                ? urg === "overdue"
                  ? "rgba(248,113,113,0.7)"
                  : "rgba(248,113,113,0.45)"
                : task.completed
                  ? "var(--border)"
                  : P_COLOR[task.priority] + "30";
              return (
                <div
                  key={task.id}
                  className={urgentGlow ? (urg === "overdue" ? "task-due-overdue" : "task-due-soon") : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: task.completed ? "var(--surface-2)" : `${P_COLOR[task.priority]}08`,
                    border: `1px solid ${borderCol}`,
                    opacity: task.completed ? 0.55 : 1,
                    transition: "all 0.25s ease",
                    cursor: "pointer",
                  }}
                  onClick={() => openTask(task)}
                >
                  <button
                    className="tap-scale"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTask(task);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: task.completed ? "var(--accent)" : "var(--text-tertiary)",
                      flexShrink: 0,
                    }}
                  >
                    {task.completed ? (
                      <CheckCircle2 size={22} style={{ color: "var(--accent)" }} />
                    ) : (
                      <Circle size={22} style={{ color: P_COLOR[task.priority] }} />
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: task.completed ? "line-through" : "none",
                        color: task.completed ? "var(--text-tertiary)" : "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {task.title}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{CAT_LABEL[task.category] || task.category}</span>
                      <span style={{ fontSize: 10, color: P_COLOR[task.priority], fontWeight: 700, textTransform: "uppercase" }}>{task.priority}</span>
                      {task.dueDate ? (
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>Due {format(parseISO(task.dueDate), "MMM d")}</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>No due date</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTask(task.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 6,
                      color: "var(--text-tertiary)",
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Task">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Task</label>
            <input
              type="text"
              className="lock-input"
              placeholder="What needs to be done?"
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
            <textarea
              className="lock-input"
              placeholder="Optional details"
              value={taskForm.description}
              onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
              style={{ minHeight: 90, resize: "vertical" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Category</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setTaskForm((f) => ({ ...f, category: c.value }))}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: `1px solid ${taskForm.category === c.value ? "var(--accent)" : "var(--border)"}`,
                    background: taskForm.category === c.value ? "var(--accent)" : "var(--surface-3)",
                    color: taskForm.category === c.value ? "#000" : "var(--text-secondary)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={taskForm.noDueDate}
                onChange={(e) => setTaskForm((f) => ({ ...f, noDueDate: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              No due date
            </label>
          </div>
          {!taskForm.noDueDate && (
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Due date</label>
              <input
                type="date"
                className="lock-input"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setTaskForm((f) => ({ ...f, priority: p }))}
                  style={{
                    flex: 1,
                    padding: "10px 4px",
                    borderRadius: 12,
                    border: `1px solid ${taskForm.priority === p ? P_COLOR[p] : "var(--border)"}`,
                    background: taskForm.priority === p ? `${P_COLOR[p]}20` : "var(--surface-3)",
                    color: taskForm.priority === p ? P_COLOR[p] : "var(--text-secondary)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <button
            className="tap-scale"
            onClick={addTask}
            style={{
              padding: 16,
              borderRadius: 16,
              background: "var(--accent)",
              border: "none",
              color: "#000",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              marginTop: 8,
            }}
          >
            Add Task
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!editingTask} onClose={() => setEditingTask(null)} title={editingTask ? "Task details" : ""}>
        {editingTask && (
          <TaskEditor
            task={editingTask}
            setTask={setEditingTask}
            onSave={() => void saveTaskEdit()}
            onDelete={() => void deleteTask(editingTask.id)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function TaskEditor({
  task,
  setTask,
  onSave,
  onDelete,
}: {
  task: Task & { noDueDate: boolean };
  setTask: (task: Task & { noDueDate: boolean }) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Name</label>
        <input className="lock-input" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
      </div>
      <div>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
        <textarea className="lock-input" value={task.description || ""} onChange={(e) => setTask({ ...task, description: e.target.value })} style={{ minHeight: 110, resize: "vertical" }} />
      </div>
      <div>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Category</label>
        <select className="lock-input" value={task.category} onChange={(e) => setTask({ ...task, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
        <input type="checkbox" checked={task.noDueDate} onChange={(e) => setTask({ ...task, noDueDate: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
        No due date
      </label>
      {!task.noDueDate && (
        <div>
          <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Due date</label>
          <input type="date" className="lock-input" value={task.dueDate || ""} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} />
        </div>
      )}
      <div>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Importance</label>
        <div style={{ display: "flex", gap: 8 }}>
          {PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => setTask({ ...task, priority: p })} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: `1px solid ${task.priority === p ? P_COLOR[p] : "var(--border)"}`, background: task.priority === p ? `${P_COLOR[p]}20` : "var(--surface-3)", color: task.priority === p ? P_COLOR[p] : "var(--text-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
        <input type="checkbox" checked={task.completed} onChange={(e) => setTask({ ...task, completed: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
        Completed
      </label>
      <button type="button" className="tap-scale" onClick={onSave} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>
        Save changes
      </button>
      <button type="button" className="tap-scale" onClick={onDelete} style={{ padding: 14, borderRadius: 14, background: "#EF444412", border: "1px solid #EF444425", color: "#EF4444", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>
        Delete task
      </button>
    </div>
  );
}
