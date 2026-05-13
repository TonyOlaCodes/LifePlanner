import Dexie, { Table } from "dexie";

export interface Habit {
  id: string;
  title: string;
  emoji: string;
  category: "sleep" | "gym" | "faith" | "coding" | "discipline" | "content" | "study" | "custom";
  frequency: string[]; // ['mon','tue','wed','thu','fri','sat','sun']
  targetValue?: number;
  unit?: string;
  color: string;
  order: number;
  createdAt: number;
  archived: 0 | 1;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // 'YYYY-MM-DD'
  completed: boolean;
  value?: number;
  notes?: string;
  timestamp: number;
}

export interface SleepLog {
  id: string;
  date: string;
  bedtime: string;   // HH:MM 24hr
  wakeTime: string;  // HH:MM 24hr
  quality: number;   // 1-5
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  date: string;
  name: string;
  durationMinutes: number;
  exercises: {
    name: string;
    sets: { weight: number; reps: number; isBodyweight?: boolean }[];
  }[];
  bodyweight?: number;
  notes?: string;
}

export interface PersonalRecord {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  date: string;
}

export interface StudySession {
  id: string;
  date: string;
  subject: string;
  durationMinutes: number;
  topic: string;
  notes?: string;
}

export interface Exam {
  id: string;
  subject: string;
  date: string; // 'YYYY-MM-DD'
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  category: string;
  dueDate?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  createdAt: number;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
}

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  moodScore: number; // 1-10
  tags: string[];
  createdAt: number;
}

export interface DisciplineLog {
  id: string;
  date: string;
  noScroll: boolean;
  screenTimeHours: number;
  hadRelapse: boolean;
  relapseNotes?: string;
  disciplineScore: number; // computed 0-100
}

export interface MetricLog {
  id: string;
  date: string;
  name: string; // "weight", "calories", etc
  value: number;
}

export interface ContentPost {
  id: string;
  date: string;
  platform: string;
  type: string;
  title: string;
  status: "idea" | "draft" | "scheduled" | "posted";
  notes?: string;
}

export interface AppSettings {
  id: 1;
  accentColor: string;
  accentColorSecondary: string;
  theme: "oled" | "dark";
  dashboardWidgets: string[];
  motivationalQuotes: boolean;
  haptics: boolean;
  notificationsEnabled: boolean;
  reminderTime: string;
  userName: string;
  journalPassword?: string;
  totalFocusMinutes?: number;
  totalFocusSeconds?: number;
}

export class LockInDatabase extends Dexie {
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  sleepLogs!: Table<SleepLog, string>;
  workoutLogs!: Table<WorkoutLog, string>;
  personalRecords!: Table<PersonalRecord, string>;
  studySessions!: Table<StudySession, string>;
  exams!: Table<Exam, string>;
  tasks!: Table<Task, string>;
  journalEntries!: Table<JournalEntry, string>;
  disciplineLogs!: Table<DisciplineLog, string>;
  contentPosts!: Table<ContentPost, string>;
  metricsLogs!: Table<MetricLog, string>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super("LockInDB");
    this.version(1).stores({
      habits: "id, category, order, createdAt, archived",
      habitLogs: "id, habitId, date, timestamp",
      sleepLogs: "id, date",
      workoutLogs: "id, date",
      personalRecords: "id, exercise, date",
      studySessions: "id, date, subject",
      exams: "id, date, subject",
      tasks: "id, category, dueDate, completed, priority, createdAt",
      journalEntries: "id, date, createdAt",
      disciplineLogs: "id, date",
      contentPosts: "id, date, platform, status",
      settings: "id",
    });
    this.version(2).stores({
      metricsLogs: "id, date, name",
    });
  }
}

export const db = new LockInDatabase();

// Initialize default settings if not exists
export async function initializeSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(1);
  if (existing) return existing;
  const defaults: AppSettings = {
    id: 1,
    accentColor: "#6EE7B7",
    accentColorSecondary: "#3B82F6",
    theme: "oled",
    dashboardWidgets: ["score", "habits", "sleep", "gym", "study", "tasks"],
    motivationalQuotes: true,
    haptics: true,
    notificationsEnabled: false,
    reminderTime: "08:00",
    userName: "Champion",
  };
  await db.settings.put(defaults);
  return defaults;
}

// Seed some default habits
export async function seedDefaultHabits() {
  const count = await db.habits.count();
  if (count > 0) return;
  const defaults: Habit[] = [
    { id: crypto.randomUUID(), title: "Morning Prayer", emoji: "🙏", category: "faith", frequency: ["mon","tue","wed","thu","fri","sat","sun"], color: "#F59E0B", order: 0, createdAt: Date.now(), archived: 0 },
    { id: crypto.randomUUID(), title: "Read Bible", emoji: "📖", category: "faith", frequency: ["mon","tue","wed","thu","fri","sat","sun"], color: "#F59E0B", order: 1, createdAt: Date.now(), archived: 0 },
    { id: crypto.randomUUID(), title: "Workout", emoji: "💪", category: "gym", frequency: ["mon","wed","fri"], color: "#EF4444", order: 2, createdAt: Date.now(), archived: 0 },
    { id: crypto.randomUUID(), title: "LeetCode", emoji: "💻", category: "coding", frequency: ["mon","tue","wed","thu","fri"], color: "#8B5CF6", order: 3, createdAt: Date.now(), archived: 0 },
    { id: crypto.randomUUID(), title: "No Mindless Scroll", emoji: "📵", category: "discipline", frequency: ["mon","tue","wed","thu","fri","sat","sun"], color: "#06B6D4", order: 4, createdAt: Date.now(), archived: 0 },
    { id: crypto.randomUUID(), title: "Study Session", emoji: "📚", category: "study", frequency: ["mon","tue","wed","thu","fri"], color: "#10B981", order: 5, createdAt: Date.now(), archived: 0 },
  ];
  await db.habits.bulkPut(defaults);
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getStreakForHabit(logs: HabitLog[], habitId: string): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const log = logs.find(l => l.habitId === habitId && l.date === ds && l.completed);
    if (log) streak++;
    else if (i > 0) break;
  }
  return streak;
}
