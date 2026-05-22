"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { db, getTodayString, initializeSettings, seedDefaultHabits, seedBootstrapPack } from "@/lib/db";
import BottomNav from "./BottomNav";
import { PageTransition } from "./PageTransition";
import { useLiveQuery } from "dexie-react-hooks";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { SyncStatus } from "@/components/pwa/SyncStatus";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setSettings } = useAppStore();

  const settings = useLiveQuery(() => db.settings.get(1));

  useEffect(() => {
    initializeSettings().then((s) => setSettings(s));
    void seedDefaultHabits().then(() => seedBootstrapPack());
  }, [setSettings]);

  useEffect(() => {
    if (!settings) return;
    setSettings(settings);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    document.documentElement.style.setProperty("--accent-secondary", settings.accentColorSecondary);
    document.documentElement.style.setProperty("--bg", "#000000");
    document.documentElement.style.setProperty("--surface", "#0A0A0A");
  }, [settings, setSettings]);

  useEffect(() => {
    document.documentElement.classList.add("pwa-ready");
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) document.documentElement.classList.add("standalone");
  }, []);

  useEffect(() => {
    if (!settings?.notificationsEnabled || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const checkAndNotify = async () => {
      const today = getTodayString();
      const reminderTime = settings.reminderTime || "20:30";
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      if (`${hh}:${mm}` < reminderTime) return;
      const key = `lockin-reminder-${today}`;
      if (localStorage.getItem(key) === "1") return;

      const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
      const [habits, habitLogs, sleep, workouts, metrics, tasks] = await Promise.all([
        db.habits.toArray(),
        db.habitLogs.where("date").equals(today).toArray(),
        db.sleepLogs.where("date").equals(today).first(),
        db.workoutLogs.where("date").equals(today).toArray(),
        db.metricsLogs.where("date").equals(today).toArray(),
        db.tasks.filter((t) => !t.completed && (!t.dueDate || t.dueDate <= today)).toArray(),
      ]);

      const scheduled = habits.filter((h) => h.archived !== 1 && Array.isArray(h.frequency) && h.frequency.includes(dayKey));
      const completedHabitIds = new Set(habitLogs.filter((l) => l.completed).map((l) => l.habitId));
      const missing: string[] = [];
      const habitLeft = scheduled.filter((h) => !completedHabitIds.has(h.id)).length;
      if (habitLeft > 0) missing.push(`${habitLeft} habit${habitLeft === 1 ? "" : "s"}`);
      if (!sleep) missing.push("sleep");
      if (!workouts.length) missing.push("workout");
      if (!metrics.some((m) => m.name === "weight")) missing.push("weight");
      if (!metrics.some((m) => m.name === "calories")) missing.push("calories");
      if (tasks.length) missing.push(`${tasks.length} task${tasks.length === 1 ? "" : "s"}`);

      if (!missing.length) {
        localStorage.setItem(key, "1");
        return;
      }
      new Notification("Lock In check-in", {
        body: `Still to log: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "..." : ""}`,
        tag: `lockin-${today}`,
      });
      localStorage.setItem(key, "1");
    };

    void checkAndNotify();
    const id = window.setInterval(() => void checkAndNotify(), 60_000);
    return () => window.clearInterval(id);
  }, [settings?.notificationsEnabled, settings?.reminderTime]);

  return (
    <>
      <OfflineIndicator />
      <SyncStatus />
      <InstallPrompt />
      <PageTransition>{children}</PageTransition>
      <BottomNav />
    </>
  );
}
