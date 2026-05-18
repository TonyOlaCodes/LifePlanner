import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, differenceInDays } from "date-fns";
import type { AppSettings } from "./db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, fmt = "EEEE, MMMM d"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

export function getDayName(date: string): string {
  return format(parseISO(date), "EEE").toLowerCase();
}

export function getDaysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

export function getSleepHours(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const bedMinutes = bh * 60 + bm;
  let wakeMinutes = wh * 60 + wm;
  if (wakeMinutes < bedMinutes) wakeMinutes += 24 * 60;
  return parseFloat(((wakeMinutes - bedMinutes) / 60).toFixed(1));
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "#6EE7B7";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

export function vibrate(pattern: number | number[] = 50) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

export { getRotatingQuote, MOTIVATIONAL_QUOTES } from "./motivationalQuotes";

export type HabitCategoryConfig = { label: string; emoji: string; color: string };

export const CATEGORY_CONFIG: Record<string, HabitCategoryConfig> = {
  sleep:      { label: "Sleep",      emoji: "😴", color: "#6366F1" },
  gym:        { label: "Gym",        emoji: "💪", color: "#EF4444" },
  faith:      { label: "Faith",      emoji: "🙏", color: "#F59E0B" },
  coding:     { label: "Coding",     emoji: "💻", color: "#8B5CF6" },
  discipline: { label: "Discipline", emoji: "📵", color: "#06B6D4" },
  content:    { label: "Content",    emoji: "🎥", color: "#EC4899" },
  study:      { label: "Study",      emoji: "📚", color: "#10B981" },
  custom:     { label: "Custom",     emoji: "⭐", color: "#F97316" },
};

export function getHabitCategoryConfig(settings?: Pick<AppSettings, "habitCategories"> | null): Record<string, HabitCategoryConfig> {
  const custom = settings?.habitCategories || [];
  if (!custom.length) return CATEGORY_CONFIG;
  return {
    ...CATEGORY_CONFIG,
    ...Object.fromEntries(custom.map((c) => [c.id, { label: c.label, emoji: c.emoji, color: c.color }])),
  };
}
