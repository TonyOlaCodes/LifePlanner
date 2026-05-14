"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, getTodayString, getStreakForHabit, type Task } from "@/lib/db";
import { getDailyQuote, CATEGORY_CONFIG, vibrate, formatDate } from "@/lib/utils";
import ProgressRing from "@/components/ui/ProgressRing";
import BottomSheet from "@/components/ui/BottomSheet";
import { Plus, Moon, CheckCircle2, Circle, Scale, Flame, Dumbbell } from "lucide-react";

export default function DashboardPage() {
  const today = getTodayString();
  const TODAY_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  const [quickSheet, setQuickSheet] = useState<string | null>(null);
  const [sleepForm, setSleepForm] = useState({ bedtime: "23:00", wakeTime: "07:00" });
  const [workoutForm, setWorkoutForm] = useState({ name: "", duration: "60" });
  const [taskForm, setTaskForm] = useState({ title: "", category: "study", priority: "medium" as "low" | "medium" | "high" });
  const [metricForm, setMetricForm] = useState({ value: "" });

  const habits = useLiveQuery(() => db.habits.orderBy("order").toArray(), []);
  const todayLogs = useLiveQuery(() => db.habitLogs.where("date").equals(today).toArray(), [today]);
  const allLogs = useLiveQuery(() => db.habitLogs.toArray(), []);
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []);
  const sleepLog = useLiveQuery(() => db.sleepLogs.where("date").equals(today).first(), [today]);
  const settings = useLiveQuery(() => db.settings.get(1), []);
  const allSleepLogs = useLiveQuery(() => db.sleepLogs.orderBy("date").reverse().toArray(), []);
  const allWorkoutLogs = useLiveQuery(() => db.workoutLogs.orderBy("date").reverse().toArray(), []);
  const allMetrics = useLiveQuery(() => db.metricsLogs.orderBy("date").reverse().toArray(), []);

  const calculateSleepDuration = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    let dur = (h2 + m2 / 60) - (h1 + m1 / 60);
    if (dur < 0) dur += 24;
    return dur;
  };

  const todayHabits = (habits || []).filter(h => h.frequency.includes(TODAY_KEY));
  const completedToday = (todayLogs || []).filter(l => l.completed && todayHabits.some(h => h.id === l.habitId)).map(l => l.habitId);

  // Sort habits: incomplete first, completed last
  const sortedTodayHabits = [
    ...todayHabits.filter(h => !completedToday.includes(h.id)),
    ...todayHabits.filter(h => completedToday.includes(h.id)),
  ];

  // Tasks: only those explicitly due today or overdue (not "no date" ones)
  const todayTasksRaw = (allTasks || []).filter(t => t.dueDate && t.dueDate <= today);
  const sortedTodayTasks = [
    ...todayTasksRaw.filter(t => !t.completed),
    ...todayTasksRaw.filter(t => t.completed),
  ];

  const completionPct = todayHabits.length > 0 ? Math.round((completedToday.length / todayHabits.length) * 100) : 0;
  const score = Math.min(100, Math.round(completionPct * 0.7 + (sleepLog ? 30 : 0)));
  const userName = settings?.userName || "Champion";
  const quote = getDailyQuote();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const CAT_COLORS: Record<string, string> = { sleep: "#6366F1", gym: "#EF4444", faith: "#F59E0B", coding: "#8B5CF6", discipline: "#06B6D4", content: "#EC4899", study: "#10B981", custom: "#F97316" };

  async function toggleHabit(habitId: string) {
    vibrate(40);
    const existing = (todayLogs || []).find(l => l.habitId === habitId);
    if (existing) {
      await db.habitLogs.update(existing.id, { completed: !existing.completed });
    } else {
      await db.habitLogs.put({ id: crypto.randomUUID(), habitId, date: today, completed: true, timestamp: Date.now() });
    }
  }

  async function toggleTask(task: Task) {
    vibrate(40);
    if (!task.completed && task.recurrence && task.recurrence !== "none" && task.dueDate) {
      let nextDate = new Date(task.dueDate);
      if (task.recurrence === "daily") nextDate.setDate(nextDate.getDate() + 1);
      if (task.recurrence === "weekly") nextDate.setDate(nextDate.getDate() + 7);
      if (task.recurrence === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
      
      await db.tasks.put({
        id: crypto.randomUUID(), title: task.title, category: task.category,
        completed: false, priority: task.priority, dueDate: nextDate.toISOString().split("T")[0], createdAt: Date.now(),
        recurrence: task.recurrence
      });
      await db.tasks.update(task.id, { completed: true, recurrence: "none" });
    } else {
      await db.tasks.update(task.id, { completed: !task.completed });
    }
  }

  async function logSleep() {
    vibrate(50);
    const existing = await db.sleepLogs.where("date").equals(today).first();
    await db.sleepLogs.put({ id: existing?.id || crypto.randomUUID(), date: today, bedtime: sleepForm.bedtime, wakeTime: sleepForm.wakeTime, quality: 4 });
    setQuickSheet(null);
  }

  async function logWorkout() {
    vibrate(50);
    if (!workoutForm.name) return;
    await db.workoutLogs.put({ id: crypto.randomUUID(), date: today, name: workoutForm.name, durationMinutes: parseInt(workoutForm.duration), exercises: [], notes: "" });
    setQuickSheet(null);
    setWorkoutForm({ name: "", duration: "60" });
  }

  async function logMetric(name: string) {
    vibrate(50);
    if (!metricForm.value) return;
    const existing = (allMetrics||[]).find(m => m.date === today && m.name === name);
    await db.metricsLogs.put({ id: existing?.id || crypto.randomUUID(), date: today, name, value: parseFloat(metricForm.value) });
    setQuickSheet(null);
    setMetricForm({ value: "" });
  }

  async function addTask() {
    vibrate(50);
    if (!taskForm.title) return;
    await db.tasks.put({ id: crypto.randomUUID(), title: taskForm.title, category: taskForm.category, completed: false, priority: taskForm.priority, createdAt: Date.now() });
    setQuickSheet(null);
    setTaskForm({ title: "", category: "study", priority: "medium" });
  }

  return (
    <div style={{ padding: "0 16px", paddingTop: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>{greeting}</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: "4px 0 0" }}>{userName} 🔒</h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 12, margin: "4px 0 0" }}>{formatDate(today)}</p>
        </div>
        <ProgressRing value={score} size={70} strokeWidth={6}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{score}</span>
        </ProgressRing>
      </div>

      {/* Quote */}
      {settings?.motivationalQuotes !== false && (
        <div className="glass" style={{ borderRadius: 16, padding: "14px 16px", marginBottom: 20, borderLeft: "3px solid var(--accent)" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{quote}"</p>
        </div>
      )}

      {/* Score Card */}
      <div className="glass" style={{ borderRadius: 24, padding: 20, marginBottom: 16, background: "linear-gradient(135deg,rgba(110,231,183,0.07),rgba(59,130,246,0.07))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Lock-In Score</p>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1, marginTop: 4 }} className="gradient-text">{score}</div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>{completedToday.length}/{todayHabits.length} habits · {completionPct}%</p>
          </div>
          <div>
            <div className="progress-track" style={{ width: 100, height: 6 }}>
              <div className="progress-fill" style={{ width: `${completionPct}%` }} />
            </div>
            {sleepLog && <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}><Moon size={11} style={{ color: "#6366F1" }} /> Sleep logged ✓</p>}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[
          { key: "sleep", label: "Sleep", color: "#6366F1", emoji: "🌙" },
          { key: "workout", label: "Workout", color: "#EF4444", emoji: "💪" },
          { key: "weight", label: "Weight", color: "#F59E0B", emoji: "⚖️" },
          { key: "calories", label: "Calories", color: "#F97316", emoji: "🔥" },
        ].map(({ key, label, color, emoji }) => (
          <button key={key} className="tap-scale" onClick={() => setQuickSheet(key)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 18, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{emoji}</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Today Habits — completed sink to bottom */}
      {sortedTodayHabits.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Today</h2>
            <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>{completedToday.length}/{todayHabits.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedTodayHabits.map(habit => {
              const done = completedToday.includes(habit.id);
              const streak = getStreakForHabit(allLogs || [], habit.id);
              return (
                <div key={habit.id} className="tap-scale" onClick={() => toggleHabit(habit.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 18, background: done ? `${habit.color}10` : "var(--surface-2)", border: `1px solid ${done ? habit.color + "25" : "var(--border)"}`, cursor: "pointer", opacity: done ? 0.65 : 1, transition: "all 0.25s ease" }}>
                  <div className={`check-ring${done ? " done" : ""}`} style={{ borderColor: done ? habit.color : undefined, background: done ? habit.color : undefined }}>
                    {done && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4L4.5 7.5L11 1" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{habit.emoji}</span>
                      <span style={{ fontSize: 15, fontWeight: 600, textDecoration: done ? "line-through" : "none", color: done ? "var(--text-secondary)" : "var(--text-primary)" }}>{habit.title}</span>
                    </div>
                    {streak > 1 && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>🔥 {streak} day streak</p>}
                  </div>
                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 100, background: `${CAT_COLORS[habit.category]}20`, color: CAT_COLORS[habit.category] || "var(--accent)", fontWeight: 600 }}>
                    {CATEGORY_CONFIG[habit.category]?.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tasks — completed sink to bottom */}
      {sortedTodayTasks.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>To Do Today</h2>
            <a href="/planner" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>All →</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedTodayTasks.slice(0, 5).map(task => (
              <div key={task.id} onClick={() => toggleTask(task)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 16, background: task.completed ? "var(--surface-2)" : "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", opacity: task.completed ? 0.5 : 1, transition: "all 0.25s ease" }}>
                <div style={{ color: task.completed ? "var(--accent)" : "var(--text-tertiary)", display: "flex", flexShrink: 0 }}>
                  {task.completed
                    ? <CheckCircle2 size={22} style={{ color: "var(--accent)" }} />
                    : <Circle size={22} />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, textDecoration: task.completed ? "line-through" : "none", color: task.completed ? "var(--text-secondary)" : "var(--text-primary)" }}>{task.title}</p>
                  {task.dueDate && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>{task.dueDate}</p>}
                </div>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 100, fontWeight: 700, textTransform: "uppercase",
                  background: task.priority === "high" ? "#EF444415" : task.priority === "medium" ? "#F59E0B15" : "#10B98115",
                  color: task.priority === "high" ? "#EF4444" : task.priority === "medium" ? "#F59E0B" : "#10B981"
                }}>{task.priority}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Streaks */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Streaks</h2>
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {Object.entries(CATEGORY_CONFIG)
            .map(([key, cfg]) => ({ key, cfg, catHabits: (habits || []).filter(h => h.category === key) }))
            .filter(({ catHabits }) => catHabits.length > 0)
            .slice(0, 6)
            .map(({ key, cfg, catHabits }) => {
            const best = catHabits.reduce((max, h) => Math.max(max, getStreakForHabit(allLogs || [], h.id)), 0);
            return (
              <div key={key} style={{ minWidth: 80, padding: "14px 10px", borderRadius: 18, background: "var(--surface-2)", border: "1px solid var(--border)", flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{cfg.emoji}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: best > 0 ? cfg.color : "var(--text-tertiary)", marginTop: 4 }}>{best > 0 ? `🔥${best}` : "—"}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, fontWeight: 600 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Sheets */}
      <BottomSheet open={quickSheet === "sleep"} onClose={() => setQuickSheet(null)} title="Log Sleep">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {allSleepLogs && allSleepLogs.length > 0 && (
            <div style={{ padding: 12, borderRadius: 12, background: "var(--surface-2)", fontSize: 13, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
              <div><span style={{ display:"block", fontSize:10, color:"var(--text-tertiary)" }}>Avg Duration</span><b style={{ color:"var(--text-primary)", fontSize:15 }}>{(allSleepLogs.reduce((a,b)=>a+calculateSleepDuration(b.bedtime,b.wakeTime),0)/allSleepLogs.length).toFixed(1)}h</b></div>
              <div><span style={{ display:"block", fontSize:10, color:"var(--text-tertiary)" }}>Logs</span><b style={{ color:"var(--text-primary)", fontSize:15 }}>{allSleepLogs.length}</b></div>
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Bedtime</label>
            <input type="time" className="lock-input" value={sleepForm.bedtime} onChange={e => setSleepForm(p => ({ ...p, bedtime: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Wake Time</label>
            <input type="time" className="lock-input" value={sleepForm.wakeTime} onChange={e => setSleepForm(p => ({ ...p, wakeTime: e.target.value }))} />
          </div>
          <button className="tap-scale" onClick={logSleep} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>Save Sleep Log</button>
        </div>
      </BottomSheet>

      <BottomSheet open={quickSheet === "workout"} onClose={() => setQuickSheet(null)} title="Log Workout">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {allWorkoutLogs && allWorkoutLogs.length > 0 && (
            <div style={{ padding: 12, borderRadius: 12, background: "var(--surface-2)", fontSize: 13, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
              <div><span style={{ display:"block", fontSize:10, color:"var(--text-tertiary)" }}>Avg Mins</span><b style={{ color:"var(--text-primary)", fontSize:15 }}>{Math.round(allWorkoutLogs.reduce((a,b)=>a+b.durationMinutes,0)/allWorkoutLogs.length)}</b></div>
              <div><span style={{ display:"block", fontSize:10, color:"var(--text-tertiary)" }}>Total</span><b style={{ color:"var(--text-primary)", fontSize:15 }}>{allWorkoutLogs.length}</b></div>
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Workout Name</label>
            <input type="text" className="lock-input" placeholder="e.g. Push Day" value={workoutForm.name} onChange={e => setWorkoutForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Duration (mins)</label>
            <input type="number" className="lock-input" value={workoutForm.duration} onChange={e => setWorkoutForm(p => ({ ...p, duration: e.target.value }))} />
          </div>
          <button className="tap-scale" onClick={logWorkout} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>Save Workout</button>
        </div>
      </BottomSheet>

      <BottomSheet open={["weight", "calories"].includes(quickSheet || "")} onClose={() => setQuickSheet(null)} title={`Log ${quickSheet === "weight" ? "Weight" : "Calories"}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(() => {
            const history = (allMetrics||[]).filter(m => m.name === quickSheet);
            const avg = history.length > 0 ? (history.reduce((a,b)=>a+b.value,0)/history.length).toFixed(1) : "—";
            const max = history.length > 0 ? Math.max(...history.map(m=>m.value)) : "—";
            const min = history.length > 0 ? Math.min(...history.map(m=>m.value)) : "—";
            return (
              <div style={{ padding: 12, borderRadius: 12, background: "var(--surface-2)", fontSize: 13, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                <div><span style={{ display:"block", fontSize:10, color:"var(--text-tertiary)" }}>Avg</span><b style={{ color:"var(--text-primary)", fontSize:15 }}>{avg}</b></div>
                <div><span style={{ display:"block", fontSize:10, color:"var(--text-tertiary)" }}>High</span><b style={{ color:"var(--text-primary)", fontSize:15 }}>{max}</b></div>
                <div><span style={{ display:"block", fontSize:10, color:"var(--text-tertiary)" }}>Low</span><b style={{ color:"var(--text-primary)", fontSize:15 }}>{min}</b></div>
              </div>
            );
          })()}
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Value</label>
            <input type="number" className="lock-input" placeholder={quickSheet==="weight"?"e.g. 75 kg":"e.g. 2500 kcal"} value={metricForm.value} onChange={e => setMetricForm({value: e.target.value})} />
          </div>
          <button className="tap-scale" onClick={() => logMetric(quickSheet as string)} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>Save</button>
        </div>
      </BottomSheet>

      <BottomSheet open={quickSheet === "task"} onClose={() => setQuickSheet(null)} title="Add Task">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Task</label>
            <input type="text" className="lock-input" placeholder="What needs doing?" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["low", "medium", "high"] as const).map(p => (
                <button key={p} onClick={() => setTaskForm(f => ({ ...f, priority: p }))} style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: `1px solid ${taskForm.priority === p ? "var(--accent)" : "var(--border)"}`, background: taskForm.priority === p ? "var(--accent)" : "var(--surface-3)", color: taskForm.priority === p ? "#000" : "var(--text-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>{p}</button>
              ))}
            </div>
          </div>
          <button className="tap-scale" onClick={addTask} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>Add Task</button>
        </div>
      </BottomSheet>
    </div>
  );
}
