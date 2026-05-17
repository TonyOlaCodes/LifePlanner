"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect, useMemo, useRef } from "react";
import { db, getTodayString, getStreakForHabit, type Task, type SleepLog, type WorkoutLog, type MetricLog, type Habit } from "@/lib/db";
import { getRotatingQuote, CATEGORY_CONFIG, vibrate, formatDate } from "@/lib/utils";
import ProgressRing from "@/components/ui/ProgressRing";
import BottomSheet from "@/components/ui/BottomSheet";
import { MiniTrendChart, type MiniTrendPoint } from "@/components/dashboard/MiniTrendChart";
import FoodInventorySection from "@/components/dashboard/FoodInventorySection";
import { Plus, Moon, CheckCircle2, Circle, Scale, Flame, Dumbbell } from "lucide-react";
import { format, subDays } from "date-fns";

const METRIC_WINDOW = 28;

function calcSleepHours(start: string, end: string) {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  let dur = h2 + m2 / 60 - (h1 + m1 / 60);
  if (dur < 0) dur += 24;
  return dur;
}

function rollingDates(today: string, days: number): string[] {
  const base = new Date(`${today}T12:00:00`);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(format(subDays(base, i), "yyyy-MM-dd"));
  }
  return out;
}

function sleepHoursSeries(logs: SleepLog[] | undefined, today: string): MiniTrendPoint[] {
  const map = Object.fromEntries((logs || []).map((l) => [l.date, l]));
  return rollingDates(today, METRIC_WINDOW).map((d) => {
    const row = map[d] as SleepLog | undefined;
    if (!row) return { d, v: null };
    const hrs = calcSleepHours(row.bedtime, row.wakeTime);
    if (!row.bedtime || !row.wakeTime || hrs <= 0) return { d, v: null };
    const detail = `Bed ${row.bedtime} → Wake ${row.wakeTime}`;
    return { d, v: hrs, detail };
  });
}

function workoutMinutesSeries(logs: WorkoutLog[] | undefined, today: string): MiniTrendPoint[] {
  const byDay: Record<string, { mins: number; names: string[] }> = {};
  for (const l of logs || []) {
    if (!byDay[l.date]) byDay[l.date] = { mins: 0, names: [] };
    byDay[l.date].mins += l.durationMinutes;
    const label = (l.name || "Workout").trim();
    byDay[l.date].names.push(`${label} (${l.durationMinutes}m)`);
  }
  return rollingDates(today, METRIC_WINDOW).map((d) => {
    const row = byDay[d];
    if (!row || row.mins <= 0) return { d, v: null };
    return { d, v: row.mins, detail: row.names.join("\n") };
  });
}

function metricValueSeries(logs: MetricLog[] | undefined, name: string, today: string): MiniTrendPoint[] {
  const byDate: Record<string, number> = {};
  const named = (logs || []).filter((l) => l.name === name);
  for (const l of [...named].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return String(a.id).localeCompare(String(b.id));
  })) {
    byDate[l.date] = l.value;
  }
  return rollingDates(today, METRIC_WINDOW).map((d) => {
    if (byDate[d] === undefined) return { d, v: null };
    const v = byDate[d];
    const detail = name === "weight" ? `Weight: ${v.toFixed(2)}` : `${name}: ${v}`;
    return { d, v, detail };
  });
}

function seriesStats(series: MiniTrendPoint[], today: string, accountStartDate?: string) {
  const start =
    accountStartDate && accountStartDate.length >= 10 && accountStartDate <= today ? accountStartDate : today;
  const past = series.filter((x) => x.d < today && x.d >= start);
  const vals = past.map((x) => x.v).filter((v): v is number => v !== null && v !== undefined && v > 0);
  const missed = past.filter((x) => x.v === null || x.v === undefined || x.v === 0).length;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  const min = vals.length ? Math.min(...vals) : 0;
  return { avg, max, min, missed };
}

function SheetTabs({ tab, setTab }: { tab: "log" | "analytics"; setTab: (t: "log" | "analytics") => void }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {(["log", "analytics"] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => setTab(key)}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 12,
            border: `1px solid ${tab === key ? "var(--accent)" : "var(--border)"}`,
            background: tab === key ? "var(--accent)" : "var(--surface-3)",
            color: tab === key ? "#000" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {key === "log" ? "Log" : "Insights"}
        </button>
      ))}
    </div>
  );
}

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
      {items.map((it) => (
        <div key={it.label} style={{ padding: 12, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 600 }}>{it.label}</span>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const today = getTodayString();
  const TODAY_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  const [quickSheet, setQuickSheet] = useState<string | null>(null);
  const [sheetTab, setSheetTab] = useState<"log" | "analytics">("log");
  const [sleepForm, setSleepForm] = useState({ bedtime: "23:00", wakeTime: "07:00" });
  const [workoutForm, setWorkoutForm] = useState({ name: "", duration: "60" });
  const [taskForm, setTaskForm] = useState({
    title: "",
    category: "study",
    priority: "medium" as "low" | "medium" | "high",
    dueDate: today,
    noDueDate: true,
  });
  const [metricForm, setMetricForm] = useState({ value: "" });
  const [sleepFormDate, setSleepFormDate] = useState(today);
  const [workoutFormDate, setWorkoutFormDate] = useState(today);
  const [metricFormDate, setMetricFormDate] = useState(today);
  const prevQuickSheet = useRef<string | null>(null);

  const habits = useLiveQuery(() => db.habits.orderBy("order").toArray(), []);
  const todayLogs = useLiveQuery(() => db.habitLogs.where("date").equals(today).toArray(), [today]);
  const allLogs = useLiveQuery(() => db.habitLogs.toArray(), []);
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []);
  const sleepLog = useLiveQuery(() => db.sleepLogs.where("date").equals(today).first(), [today]);
  const settings = useLiveQuery(() => db.settings.get(1), []);
  const allSleepLogs = useLiveQuery(() => db.sleepLogs.orderBy("date").reverse().toArray(), []);
  const allWorkoutLogs = useLiveQuery(() => db.workoutLogs.orderBy("date").reverse().toArray(), []);
  const allMetrics = useLiveQuery(() => db.metricsLogs.orderBy("date").reverse().toArray(), []);

  const sleepRowForDate = useLiveQuery(() => db.sleepLogs.where("date").equals(sleepFormDate).first(), [sleepFormDate]);
  const weightEntryForDate = useLiveQuery(
    () => db.metricsLogs.filter((m) => m.date === metricFormDate && m.name === "weight").first(),
    [metricFormDate]
  );
  const caloriesEntryForDate = useLiveQuery(
    () => db.metricsLogs.filter((m) => m.date === metricFormDate && m.name === "calories").first(),
    [metricFormDate]
  );

  useEffect(() => {
    setSheetTab("log");
  }, [quickSheet]);

  useEffect(() => {
    const q = quickSheet;
    const prev = prevQuickSheet.current;
    if (q === "sleep" && prev !== "sleep") setSleepFormDate(today);
    if (q === "workout" && prev !== "workout") setWorkoutFormDate(today);
    if ((q === "weight" || q === "calories") && prev !== "weight" && prev !== "calories") setMetricFormDate(today);
    prevQuickSheet.current = q;
  }, [quickSheet, today]);

  useEffect(() => {
    if (quickSheet !== "sleep") return;
    if (sleepRowForDate) setSleepForm({ bedtime: sleepRowForDate.bedtime, wakeTime: sleepRowForDate.wakeTime });
    else setSleepForm({ bedtime: "23:00", wakeTime: "07:00" });
  }, [quickSheet, sleepFormDate, sleepRowForDate?.id]);

  useEffect(() => {
    if (quickSheet !== "weight" && quickSheet !== "calories") return;
    const row = quickSheet === "weight" ? weightEntryForDate : caloriesEntryForDate;
    if (row) setMetricForm({ value: quickSheet === "weight" ? row.value.toFixed(2) : String(row.value) });
    else setMetricForm({ value: "" });
  }, [quickSheet, metricFormDate, weightEntryForDate?.id, caloriesEntryForDate?.id]);

  const accountStart = settings?.accountStartDate;

  const sleepSeries = useMemo(() => sleepHoursSeries(allSleepLogs, today), [allSleepLogs, today]);
  const workoutSeries = useMemo(() => workoutMinutesSeries(allWorkoutLogs, today), [allWorkoutLogs, today]);
  const weightSeries = useMemo(() => metricValueSeries(allMetrics, "weight", today), [allMetrics, today]);
  const caloriesSeries = useMemo(() => metricValueSeries(allMetrics, "calories", today), [allMetrics, today]);

  const sleepStats = useMemo(() => seriesStats(sleepSeries, today, accountStart), [sleepSeries, today, accountStart]);
  const workoutStats = useMemo(() => seriesStats(workoutSeries, today, accountStart), [workoutSeries, today, accountStart]);
  const weightStats = useMemo(() => seriesStats(weightSeries, today, accountStart), [weightSeries, today, accountStart]);
  const caloriesStats = useMemo(() => seriesStats(caloriesSeries, today, accountStart), [caloriesSeries, today, accountStart]);

  const hasAnyValidSleepLog = useMemo(
    () => (allSleepLogs || []).some((l) => calcSleepHours(l.bedtime, l.wakeTime) > 0),
    [allSleepLogs]
  );
  const hasAnyWorkoutLogEver = (allWorkoutLogs?.length ?? 0) > 0;
  const hasAnyWeightLogEver = useMemo(() => (allMetrics || []).some((m) => m.name === "weight"), [allMetrics]);
  const hasAnyCaloriesLogEver = useMemo(() => (allMetrics || []).some((m) => m.name === "calories"), [allMetrics]);

  const lastWeightMetric = useMemo(() => {
    const w = (allMetrics || []).filter((m) => m.name === "weight");
    if (!w.length) return null;
    return [...w].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [allMetrics]);
  const lastCaloriesMetric = useMemo(() => {
    const w = (allMetrics || []).filter((m) => m.name === "calories");
    if (!w.length) return null;
    return [...w].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [allMetrics]);
  const lastWorkout = useMemo(() => {
    if (!allWorkoutLogs?.length) return null;
    return [...allWorkoutLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [allWorkoutLogs]);
  const sleepInsightDays = useMemo(() => {
    const rows = (allSleepLogs || [])
      .map((l) => {
        const hrs = calcSleepHours(l.bedtime, l.wakeTime);
        if (!l.bedtime || !l.wakeTime || hrs <= 0) return null;
        return { date: l.date, bedtime: l.bedtime, wakeTime: l.wakeTime, hours: hrs };
      })
      .filter((x): x is { date: string; bedtime: string; wakeTime: string; hours: number } => x != null);
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows.slice(0, 45);
  }, [allSleepLogs]);

  const hasWorkoutToday = useMemo(() => (allWorkoutLogs || []).some((w) => w.date === today), [allWorkoutLogs, today]);
  const hasWeightToday = useMemo(() => (allMetrics || []).some((m) => m.date === today && m.name === "weight"), [allMetrics, today]);
  const hasCaloriesToday = useMemo(() => (allMetrics || []).some((m) => m.date === today && m.name === "calories"), [allMetrics, today]);

  const HABIT_CAT_ORDER = useMemo(() => Object.keys(CATEGORY_CONFIG) as (keyof typeof CATEGORY_CONFIG)[], []);

  const scheduledTodayHabits = useMemo(
    () => (habits || []).filter((h) => Array.isArray(h.frequency) && h.frequency.includes(TODAY_KEY)),
    [habits, TODAY_KEY]
  );
  const completedLogsToday = useMemo(() => (todayLogs || []).filter((l) => l.completed), [todayLogs]);
  const completedIdsToday = useMemo(() => new Set(completedLogsToday.map((l) => l.habitId)), [completedLogsToday]);
  const extraHabitsToday = useMemo(
    () =>
      (habits || []).filter(
        (h) => Array.isArray(h.frequency) && !h.frequency.includes(TODAY_KEY) && completedIdsToday.has(h.id)
      ),
    [habits, TODAY_KEY, completedIdsToday]
  );

  const sortedTodayHabits = useMemo(() => {
    const base = [
      ...scheduledTodayHabits.filter((h) => !completedIdsToday.has(h.id)),
      ...scheduledTodayHabits.filter((h) => completedIdsToday.has(h.id)),
      ...extraHabitsToday,
    ];
    const catRank = (c: string) => {
      const i = HABIT_CAT_ORDER.indexOf(c as keyof typeof CATEGORY_CONFIG);
      return i === -1 ? 99 : i;
    };
    function tier(h: Habit) {
      const sch = Array.isArray(h.frequency) && h.frequency.includes(TODAY_KEY);
      const done = completedIdsToday.has(h.id);
      if (sch && !done) return 0;
      if (sch && done) return 1;
      return 2;
    }
    return [...base].sort((a, b) => {
      const cr = catRank(a.category) - catRank(b.category);
      if (cr !== 0) return cr;
      return tier(a) - tier(b);
    });
  }, [scheduledTodayHabits, extraHabitsToday, completedIdsToday, HABIT_CAT_ORDER, TODAY_KEY]);

  const TASK_CATEGORY_ORDER = useMemo(
    () => ["study", "coding", "exam", "gym", "faith", "personal", "work", "other"],
    []
  );
  const taskCatRank = (c: string) => {
    const i = TASK_CATEGORY_ORDER.indexOf(c);
    return i === -1 ? 99 : i;
  };

  const sortedTodayTasks = useMemo(() => {
    const raw = (allTasks || []).filter(
      (t) => (t.dueDate && t.dueDate <= today) || (!t.dueDate && !t.completed)
    );
    const byCatThenDue = (a: Task, b: Task) => {
      const cx = taskCatRank(a.category) - taskCatRank(b.category);
      if (cx !== 0) return cx;
      const da = a.dueDate ?? "";
      const db = b.dueDate ?? "";
      if (da !== db) return da.localeCompare(db);
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    };
    return [
      ...raw.filter((t) => !t.completed).sort(byCatThenDue),
      ...raw.filter((t) => t.completed).sort(byCatThenDue),
    ];
  }, [allTasks, today, TASK_CATEGORY_ORDER]);

  const habitRatioLabel =
    scheduledTodayHabits.length > 0
      ? `${completedLogsToday.length}/${scheduledTodayHabits.length}`
      : String(completedLogsToday.length);
  const completionPct =
    scheduledTodayHabits.length > 0
      ? Math.min(100, Math.round((completedLogsToday.length / scheduledTodayHabits.length) * 100))
      : 0;
  const score = Math.min(100, Math.round(completionPct * 0.7 + (sleepLog ? 30 : 0)));
  const userName = settings?.userName || "Champion";
  const quote = getRotatingQuote();
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
    await db.tasks.update(task.id, { completed: !task.completed });
  }

  async function logSleep() {
    vibrate(50);
    const existing = await db.sleepLogs.where("date").equals(sleepFormDate).first();
    await db.sleepLogs.put({
      id: existing?.id || crypto.randomUUID(),
      date: sleepFormDate,
      bedtime: sleepForm.bedtime,
      wakeTime: sleepForm.wakeTime,
      quality: existing?.quality ?? 4,
    });
  }

  async function logWorkout() {
    vibrate(50);
    if (!workoutForm.name) return;
    await db.workoutLogs.put({
      id: crypto.randomUUID(),
      date: workoutFormDate,
      name: workoutForm.name,
      durationMinutes: parseInt(workoutForm.duration, 10) || 0,
      exercises: [],
      notes: "",
    });
    setWorkoutForm({ name: "", duration: workoutForm.duration });
  }

  async function logMetric(name: string) {
    vibrate(50);
    if (!metricForm.value) return;
    const raw = parseFloat(metricForm.value);
    if (!Number.isFinite(raw)) return;
    const value = name === "weight" ? Math.round(raw * 100) / 100 : raw;
    const existing = await db.metricsLogs.filter((m) => m.date === metricFormDate && m.name === name).first();
    await db.metricsLogs.put({
      id: existing?.id || crypto.randomUUID(),
      date: metricFormDate,
      name,
      value,
    });
  }

  async function addTask() {
    vibrate(50);
    if (!taskForm.title) return;
    await db.tasks.put({
      id: crypto.randomUUID(),
      title: taskForm.title,
      category: taskForm.category,
      completed: false,
      priority: taskForm.priority,
      dueDate: taskForm.noDueDate ? undefined : taskForm.dueDate,
      createdAt: Date.now(),
    });
    setQuickSheet(null);
    setTaskForm({ title: "", category: "study", priority: "medium", dueDate: today, noDueDate: true });
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

      {/* Quote — large pool, rotates every 6 hours */}
      <div className="glass" style={{ borderRadius: 16, padding: "14px 16px", marginBottom: 20, borderLeft: "3px solid var(--accent)" }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{quote}"</p>
        <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: "8px 0 0", fontWeight: 600 }}>New quote every 6 hours</p>
      </div>

      {/* Score Card */}
      <div className="glass" style={{ borderRadius: 24, padding: 20, marginBottom: 16, background: "linear-gradient(135deg,rgba(110,231,183,0.07),rgba(59,130,246,0.07))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Lock-In Score</p>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1, marginTop: 4 }} className="gradient-text">{score}</div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>{habitRatioLabel} habits · {completionPct}%</p>
          </div>
          <div>
            <div className="progress-track" style={{ width: 100, height: 6 }}>
              <div className="progress-fill" style={{ width: `${completionPct}%` }} />
            </div>
            {sleepLog && <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}><Moon size={11} style={{ color: "#6366F1" }} /> Sleep logged ✓</p>}
          </div>
        </div>
      </div>

      {/* Quick Actions — order follows Settings → Home quick log */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        {(
          [
            { key: "sleep" as const, label: "Sleep", color: "#6366F1", emoji: "🌙" },
            { key: "workout" as const, label: "Workout", color: "#EF4444", emoji: "💪" },
            { key: "weight" as const, label: "Weight", color: "#F59E0B", emoji: "⚖️" },
            { key: "calories" as const, label: "Calories", color: "#F97316", emoji: "🔥" },
          ] as const
        )
          .filter(({ key }) => (settings?.quickLogKeys ?? ["sleep", "workout", "weight", "calories"]).includes(key))
          .map(({ key, label, color, emoji }) => {
            const done =
              (key === "sleep" && !!sleepLog) ||
              (key === "workout" && hasWorkoutToday) ||
              (key === "weight" && hasWeightToday) ||
              (key === "calories" && hasCaloriesToday);
            return (
          <button key={key} className="tap-scale" onClick={() => setQuickSheet(key)}
            style={{
              flex: 1, minWidth: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 18,
              background: done ? "rgba(34,197,94,0.14)" : "var(--surface-2)",
              border: done ? "1px solid rgba(34,197,94,0.5)" : "1px solid var(--border)",
              cursor: "pointer",
            }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: done ? "rgba(34,197,94,0.35)" : `${color}20`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>{emoji}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: done ? "#4ADE80" : "var(--text-secondary)" }}>{done ? "Done today" : label}</span>
          </button>
            );
          })}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 24 }}>Edit which tiles show here in Settings → Home quick log.</p>

      {/* Today Habits — completed sink to bottom */}
      {sortedTodayHabits.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Today</h2>
            <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>{habitRatioLabel}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedTodayHabits.map(habit => {
              const done = completedIdsToday.has(habit.id);
              const streak = getStreakForHabit(allLogs || [], habit.id);
              const isExtra = !Array.isArray(habit.frequency) || !habit.frequency.includes(TODAY_KEY);
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
                    {isExtra ? "Extra · " : ""}{CATEGORY_CONFIG[habit.category]?.label}
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
                  {task.dueDate ? (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>Due {task.dueDate}</p>
                  ) : (
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-tertiary)" }}>No due date</p>
                  )}
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

      <FoodInventorySection />

      {/* Bottom Sheets */}
      <BottomSheet open={quickSheet === "sleep"} onClose={() => setQuickSheet(null)} title="Sleep">
        <SheetTabs tab={sheetTab} setTab={setSheetTab} />
        {sheetTab === "log" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Date</label>
              <input type="date" className="lock-input" value={sleepFormDate} max={today} onChange={(e) => setSleepFormDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Bedtime</label>
              <input type="time" className="lock-input" value={sleepForm.bedtime} onChange={(e) => setSleepForm((p) => ({ ...p, bedtime: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Wake time</label>
              <input type="time" className="lock-input" value={sleepForm.wakeTime} onChange={(e) => setSleepForm((p) => ({ ...p, wakeTime: e.target.value }))} />
            </div>
            <button className="tap-scale" onClick={logSleep} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>
              {sleepRowForDate ? "Update sleep log" : "Save sleep log"}
            </button>
          </div>
        ) : (
          <div>
            {hasAnyValidSleepLog ? (
              <>
            <StatGrid
              items={[
                { label: "Average (h)", value: sleepStats.avg.toFixed(2) },
                { label: "High (h)", value: sleepStats.max > 0 ? sleepStats.max.toFixed(2) : "—" },
                { label: "Low (h)", value: sleepStats.max > 0 ? sleepStats.min.toFixed(2) : "—" },
                { label: "Days missed*", value: String(sleepStats.missed) },
              ]}
            />
            <MiniTrendChart
              data={sleepSeries}
              color="#6366F1"
              valueLabel="Hours"
              formatValue={(v) => v.toFixed(2)}
              chartKey={`sleep-analytics-${sheetTab}`}
            />
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 10px" }}>By night</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" }}>
                {sleepInsightDays.map((row) => (
                  <div
                    key={row.date}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.55,
                    }}
                  >
                    <div style={{ color: "var(--text-primary)" }}>{row.date} — slept at {row.bedtime}</div>
                    <div>Woke at {row.wakeTime}</div>
                    <div style={{ color: "var(--accent)", fontWeight: 700 }}>{row.hours.toFixed(2)} h asleep</div>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
              Averages and the line use only nights with bedtime and wake time saved. Days with no log are gaps (not averaged). Missed counts only days on or after your account start, before today, with no log.
            </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, margin: 0, padding: 16, borderRadius: 16, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                Log sleep at least once to unlock averages, high/low, days missed, and the trend chart.
              </p>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={quickSheet === "workout"} onClose={() => setQuickSheet(null)} title="Workout">
        <SheetTabs tab={sheetTab} setTab={setSheetTab} />
        {sheetTab === "log" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Date</label>
              <input type="date" className="lock-input" value={workoutFormDate} max={today} onChange={(e) => setWorkoutFormDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Workout name</label>
              <input
                type="text"
                className="lock-input"
                placeholder={lastWorkout?.name ? lastWorkout.name : "Name"}
                value={workoutForm.name}
                onChange={(e) => setWorkoutForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Duration (minutes)</label>
              <input
                type="number"
                className="lock-input"
                placeholder={lastWorkout ? String(lastWorkout.durationMinutes) : "Minutes"}
                value={workoutForm.duration}
                onChange={(e) => setWorkoutForm((p) => ({ ...p, duration: e.target.value }))}
              />
            </div>
            <button className="tap-scale" onClick={logWorkout} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>
              Save workout
            </button>
          </div>
        ) : (
          <div>
            {hasAnyWorkoutLogEver ? (
              <>
            <StatGrid
              items={[
                { label: "Avg minutes / day", value: workoutStats.avg.toFixed(0) },
                { label: "Peak day (min)", value: workoutStats.max > 0 ? String(Math.round(workoutStats.max)) : "—" },
                { label: "Lowest day (min)", value: workoutStats.max > 0 ? String(Math.round(workoutStats.min)) : "—" },
                { label: "Days missed*", value: String(workoutStats.missed) },
              ]}
            />
            <MiniTrendChart
              data={workoutSeries}
              color="#EF4444"
              valueLabel="Minutes (total)"
              formatValue={(v) => String(Math.round(v))}
              chartKey={`workout-analytics-${sheetTab}`}
            />
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
              *Missed counts only from your account start through yesterday; days with no workout are missed. Hover a point to see workout names for that day.
            </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, margin: 0, padding: 16, borderRadius: 16, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                Log at least one workout to unlock averages, peak/low days, days missed, and the chart.
              </p>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={["weight", "calories"].includes(quickSheet || "")} onClose={() => setQuickSheet(null)} title={`${quickSheet === "weight" ? "Weight" : "Calories"}`}>
        <SheetTabs tab={sheetTab} setTab={setSheetTab} />
        {sheetTab === "log" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Date</label>
              <input type="date" className="lock-input" value={metricFormDate} max={today} onChange={(e) => setMetricFormDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Value</label>
              <input
                type="number"
                className="lock-input"
                step={quickSheet === "weight" ? "0.01" : "1"}
                inputMode="decimal"
                placeholder={
                  quickSheet === "weight"
                    ? lastWeightMetric
                      ? lastWeightMetric.value.toFixed(2)
                      : ""
                    : lastCaloriesMetric
                      ? String(Math.round(lastCaloriesMetric.value))
                      : ""
                }
                value={metricForm.value}
                onChange={(e) => setMetricForm({ value: e.target.value })}
              />
            </div>
            <button className="tap-scale" onClick={() => logMetric(quickSheet as string)} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>
              {(quickSheet === "weight" ? weightEntryForDate : caloriesEntryForDate) ? "Update entry" : "Save"}
            </button>
          </div>
        ) : (
          <div>
            {(() => {
              const mSeries = quickSheet === "weight" ? weightSeries : caloriesSeries;
              const mStats = quickSheet === "weight" ? weightStats : caloriesStats;
              const color = quickSheet === "weight" ? "#F59E0B" : "#F97316";
              const hasAny = quickSheet === "weight" ? hasAnyWeightLogEver : hasAnyCaloriesLogEver;
              if (!hasAny) {
                return (
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, margin: 0, padding: 16, borderRadius: 16, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    Log at least one {quickSheet === "weight" ? "weight" : "calories"} entry to unlock averages, high/low, days missed, and the chart.
                  </p>
                );
              }
              return (
                <>
                  <StatGrid
                    items={[
                      { label: "Average", value: mStats.avg > 0 ? (quickSheet === "weight" ? mStats.avg.toFixed(2) : mStats.avg.toFixed(1)) : "—" },
                      { label: "High", value: mStats.max > 0 ? (quickSheet === "weight" ? mStats.max.toFixed(2) : mStats.max.toFixed(1)) : "—" },
                      { label: "Low", value: mStats.max > 0 ? (quickSheet === "weight" ? mStats.min.toFixed(2) : mStats.min.toFixed(1)) : "—" },
                      { label: "Days missed*", value: String(mStats.missed) },
                    ]}
                  />
                  <MiniTrendChart
                    data={mSeries}
                    color={color}
                    valueLabel={quickSheet === "weight" ? "Weight" : "Calories"}
                    formatValue={(v) => (quickSheet === "weight" ? v.toFixed(2) : v.toFixed(1))}
                    chartKey={`${quickSheet}-analytics-${sheetTab}`}
                  />
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                    *Missed counts only from your account start through yesterday; days with no entry are missed.
                  </p>
                </>
              );
            })()}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={quickSheet === "task"} onClose={() => setQuickSheet(null)} title="Add Task">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Task</label>
            <input type="text" className="lock-input" placeholder="What needs doing?" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Category</label>
            <select
              className="lock-input"
              value={taskForm.category}
              onChange={(e) => setTaskForm((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="study">Study</option>
              <option value="coding">Coding</option>
              <option value="exam">Exam</option>
              <option value="gym">Gym</option>
              <option value="faith">Faith</option>
              <option value="personal">Personal</option>
              <option value="work">Work</option>
              <option value="other">Other</option>
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            <input
              type="checkbox"
              checked={taskForm.noDueDate}
              onChange={(e) => setTaskForm((p) => ({ ...p, noDueDate: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
            />
            No due date
          </label>
          {!taskForm.noDueDate && (
            <div>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Due date</label>
              <input type="date" className="lock-input" value={taskForm.dueDate} onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setTaskForm((f) => ({ ...f, priority: p }))}
                  style={{
                    flex: 1,
                    padding: "10px 4px",
                    borderRadius: 12,
                    border: `1px solid ${taskForm.priority === p ? "var(--accent)" : "var(--border)"}`,
                    background: taskForm.priority === p ? "var(--accent)" : "var(--surface-3)",
                    color: taskForm.priority === p ? "#000" : "var(--text-secondary)",
                    fontWeight: 600,
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
          <button className="tap-scale" onClick={addTask} style={{ padding: 16, borderRadius: 16, background: "var(--accent)", border: "none", color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>
            Add Task
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
