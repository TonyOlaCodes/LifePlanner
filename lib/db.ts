import Dexie, { Table } from "dexie";

export interface Habit {
  id: string;
  title: string;
  emoji: string;
  category: string;
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
  description?: string;
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

export interface FocusDayLog {
  date: string;
  seconds: number;
}

export interface JournalSecuritySnapshot {
  id: string;
  createdAt: number;
  reason: "journal_unlock_fail";
  imageBlob: Blob;
}

export interface FoodItem {
  id: string;
  name: string;
  emoji?: string;
  quantity: number;
  unit: string;
  /** Full-stock level for progress bar */
  parLevel?: number;
  lowStockThreshold?: number;
  outOfStockAlert?: boolean;
  quickAddAmount?: number;
  quickConsumeAmount?: number;
  pinnedToShoppingList?: boolean;
  /** Hidden foods stay saved but are left out of visible food and shopping views. */
  hidden?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MealIngredient {
  foodItemId: string;
  amount: number;
  unit: string;
}

export interface MealTemplate {
  id: string;
  name: string;
  emoji?: string;
  ingredients: MealIngredient[];
  createdAt: number;
}

export interface MealLog {
  id: string;
  date: string;
  name: string;
  ingredients: MealIngredient[];
  createdAt: number;
}

export interface Routine {
  id: string;
  name: string;
  emoji?: string;
  steps: { title: string; durationMinutes?: number }[];
  schedule: string[];
  order: number;
  createdAt: number;
  archived: 0 | 1;
}

export interface PlannerItem {
  id: string;
  date: string;
  title: string;
  notes?: string;
  time?: string;
  completed: boolean;
  category: string;
  order: number;
  createdAt: number;
}

export interface AnalyticsSnapshot {
  id: string;
  date: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: number;
}

export interface StreakRecord {
  id: string;
  entityType: "habit" | "focus" | "journal" | "discipline";
  entityId: string;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
  updatedAt: number;
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
  /** PBKDF2 hash (`lockin$v1$...`) or legacy plaintext until migrated */
  journalPassword?: string;
  totalFocusMinutes?: number;
  totalFocusSeconds?: number;
  /** Deep work targets (minutes) */
  focusGoalDailyMinutes?: number;
  focusGoalWeeklyMinutes?: number;
  focusGoalMonthlyMinutes?: number;
  /** When false, that progress bar is hidden on Focus (defaults true if unset). */
  focusShowDailyBar?: boolean;
  focusShowWeeklyBar?: boolean;
  focusShowMonthlyBar?: boolean;
  /** Which quick-log tiles appear on Home (subset of sleep | workout | weight | calories) */
  quickLogKeys?: ("sleep" | "workout" | "weight" | "calories")[];
  habitCategories?: { id: string; label: string; emoji: string; color: string }[];
  /** True after first-install starter pack was applied or skipped */
  bootstrapPackApplied?: boolean;
  /** First day we attribute insights / “missed” to (YYYY-MM-DD); set on install or inferred once for existing data */
  accountStartDate?: string;
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
  focusDaily!: Table<FocusDayLog, string>;
  journalSecuritySnapshots!: Table<JournalSecuritySnapshot, string>;
  foodItems!: Table<FoodItem, string>;
  mealTemplates!: Table<MealTemplate, string>;
  mealLogs!: Table<MealLog, string>;
  routines!: Table<Routine, string>;
  plannerItems!: Table<PlannerItem, string>;
  analyticsSnapshots!: Table<AnalyticsSnapshot, string>;
  streakRecords!: Table<StreakRecord, string>;

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
    this.version(3).stores({
      focusDaily: "date",
    });
    this.version(4).stores({
      journalSecuritySnapshots: "id, createdAt",
    });
    this.version(5).stores({
      foodItems: "id, name, updatedAt",
      mealTemplates: "id, name, createdAt",
      mealLogs: "id, date, createdAt",
    });
    this.version(6).stores({
      routines: "id, order, createdAt, archived",
      plannerItems: "id, date, completed, category, order, createdAt",
      analyticsSnapshots: "id, date, type, createdAt",
      streakRecords: "id, entityType, entityId, lastActiveDate, updatedAt",
    });
  }
}

export const db = new LockInDatabase();

// Initialize default settings if not exists
export async function initializeSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(1);
  const today = getTodayString();
  if (existing) {
    if (!existing.accountStartDate) {
      const inferred = await inferEarliestActivityDate();
      await db.settings.update(1, { accountStartDate: inferred });
      return { ...existing, accountStartDate: inferred };
    }
    return existing;
  }
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
    focusGoalDailyMinutes: 60,
    focusGoalWeeklyMinutes: 360,
    focusGoalMonthlyMinutes: 1400,
    focusShowDailyBar: true,
    focusShowWeeklyBar: true,
    focusShowMonthlyBar: true,
    quickLogKeys: ["sleep", "workout", "weight", "calories"],
    bootstrapPackApplied: false,
    accountStartDate: today,
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
  const daily = ["mon","tue","wed","thu","fri","sat","sun"];
  const weekdays = ["mon","tue","wed","thu","fri"];
  const now = Date.now();
  defaults.push(
    { id: crypto.randomUUID(), title: "Steps", emoji: "👟", category: "gym", frequency: daily, color: "#22C55E", order: 6, createdAt: now + 6, archived: 0 },
    { id: crypto.randomUUID(), title: "Drink Water", emoji: "💧", category: "sleep", frequency: daily, color: "#38BDF8", order: 7, createdAt: now + 7, archived: 0 },
    { id: crypto.randomUUID(), title: "Skin Care Routine", emoji: "🧴", category: "discipline", frequency: daily, color: "#F472B6", order: 8, createdAt: now + 8, archived: 0 },
    { id: crypto.randomUUID(), title: "Haircare Routine", emoji: "🪮", category: "discipline", frequency: ["mon","wed","fri","sun"], color: "#F97316", order: 9, createdAt: now + 9, archived: 0 },
    { id: crypto.randomUUID(), title: "Supplements", emoji: "💊", category: "discipline", frequency: daily, color: "#A3E635", order: 10, createdAt: now + 10, archived: 0 },
    { id: crypto.randomUUID(), title: "Cardio", emoji: "🏃", category: "gym", frequency: ["tue","thu","sat"], color: "#EF4444", order: 11, createdAt: now + 11, archived: 0 },
    { id: crypto.randomUUID(), title: "Exam Study", emoji: "📝", category: "study", frequency: weekdays, color: "#10B981", order: 12, createdAt: now + 12, archived: 0 },
    { id: crypto.randomUUID(), title: "Work On Project", emoji: "🛠️", category: "coding", frequency: weekdays, color: "#8B5CF6", order: 13, createdAt: now + 13, archived: 0 },
    { id: crypto.randomUUID(), title: "Post Content Video", emoji: "🎥", category: "content", frequency: ["mon","wed","fri"], color: "#EC4899", order: 14, createdAt: now + 14, archived: 0 },
    { id: crypto.randomUUID(), title: "Screen Time Under 10h", emoji: "⏳", category: "discipline", frequency: daily, color: "#06B6D4", order: 15, createdAt: now + 15, archived: 0 }
  );
  await db.habits.bulkPut(defaults);
}

/** First install: default habits + two starter tasks + welcome journal entry. */
export async function seedBootstrapPack() {
  const s = await db.settings.get(1);
  if (s?.bootstrapPackApplied) return;
  const [hc, tc, jc] = await Promise.all([db.habits.count(), db.tasks.count(), db.journalEntries.count()]);
  if (hc > 0 || tc > 0 || jc > 0) {
    await db.settings.update(1, { bootstrapPackApplied: true });
    return;
  }
  await seedDefaultHabits();
  const today = getTodayString();
  await db.tasks.bulkPut([
    {
      id: crypto.randomUUID(),
      title: "Pick your top 3 priorities for today",
      category: "personal",
      dueDate: today,
      completed: false,
      priority: "high",
      createdAt: Date.now(),
    },
    {
      id: crypto.randomUUID(),
      title: "Skim the Habits tab and adjust days",
      category: "study",
      dueDate: today,
      completed: false,
      priority: "medium",
      createdAt: Date.now() + 1,
    },
  ]);
  await db.journalEntries.put({
    id: crypto.randomUUID(),
    date: today,
    content:
      "Welcome to your private journal. One line today: note one thing you're grateful for, however small.",
    moodScore: 7,
    tags: ["welcome"],
    createdAt: Date.now(),
  });
  await db.settings.update(1, { bootstrapPackApplied: true });
}

export async function addFocusSecondsForDate(date: string, deltaSeconds: number) {
  if (deltaSeconds <= 0) return;
  const row = await db.focusDaily.get(date);
  const next = (row?.seconds ?? 0) + deltaSeconds;
  await db.focusDaily.put({ date, seconds: next });
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/** Earliest calendar day we can infer from local data (for backfilling accountStartDate). */
export async function inferEarliestActivityDate(): Promise<string> {
  const today = getTodayString();
  const candidates: string[] = [];
  const pushFromMs = (ms: number | undefined) => {
    if (!ms) return;
    candidates.push(new Date(ms).toISOString().split("T")[0]!);
  };
  const h = await db.habits.orderBy("createdAt").first();
  pushFromMs(h?.createdAt);
  const t = await db.tasks.orderBy("createdAt").first();
  pushFromMs(t?.createdAt);
  const j = await db.journalEntries.orderBy("createdAt").first();
  pushFromMs(j?.createdAt);
  const sl = await db.sleepLogs.orderBy("date").first();
  if (sl?.date) candidates.push(sl.date);
  const hl = await db.habitLogs.orderBy("date").first();
  if (hl?.date) candidates.push(hl.date);
  if (!candidates.length) return today;
  return candidates.reduce((a, b) => (a < b ? a : b));
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
