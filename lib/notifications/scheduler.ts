import { db, getTodayString } from "@/lib/db";
import type { NotificationReminders } from "./types";
import { DEFAULT_NOTIFICATION_REMINDERS } from "./types";
import { isPastReminderTime, showLocalNotification } from "./local";
import { getNotificationPermission, isStandalonePwa } from "@/lib/pwa/platform";

function remindersFromSettings(s: {
  notificationReminders?: NotificationReminders;
  notificationsEnabled?: boolean;
}): NotificationReminders | null {
  if (!s.notificationsEnabled) return null;
  return { ...DEFAULT_NOTIFICATION_REMINDERS, ...s.notificationReminders };
}

/** Run when app becomes visible — best-effort local reminders for iOS PWA. */
export async function runReminderChecks(): Promise<void> {
  if (getNotificationPermission() !== "granted") return;

  const settings = await db.settings.get(1);
  if (!settings) return;

  const prefs = remindersFromSettings(settings);
  if (!prefs) return;

  const today = getTodayString();

  if (prefs.daily && isPastReminderTime(settings.reminderTime)) {
    if (settings.lastDailyReminderDate !== today) {
      const ok = await showLocalNotification({
        title: "Lock In",
        body: `Good ${getGreeting()} — check habits, focus, and your streaks.`,
        tag: "lockin-daily",
        url: "/",
        kind: "daily",
      });
      if (ok) await db.settings.update(1, { lastDailyReminderDate: today });
    }
  }

  if (prefs.habits) {
    const habits = await db.habits.where("archived").equals(0).count();
    const logsToday = (await db.habitLogs.where("date").equals(today).toArray()).filter((l) => l.completed).length;
    if (habits > 0 && logsToday === 0 && settings.lastHabitReminderDate !== today && isPastReminderTime("12:00")) {
      const ok = await showLocalNotification({
        title: "Habits waiting",
        body: "Log today's habits before the day slips away.",
        tag: "lockin-habits",
        url: "/habits",
        kind: "habits",
      });
      if (ok) await db.settings.update(1, { lastHabitReminderDate: today });
    }
  }

  if (prefs.study && settings.lastStudyReminderDate !== today && isPastReminderTime("16:00")) {
    const studyToday = await db.studySessions.where("date").equals(today).count();
    if (studyToday === 0) {
      const ok = await showLocalNotification({
        title: "Study block",
        body: "Schedule a focused study session while you still have energy.",
        tag: "lockin-study",
        url: "/",
        kind: "study",
      });
      if (ok) await db.settings.update(1, { lastStudyReminderDate: today });
    }
  }

  if (prefs.sleep && settings.lastSleepReminderDate !== today && isPastReminderTime("21:30")) {
    const sleepToday = await db.sleepLogs.where("date").equals(today).count();
    if (sleepToday === 0) {
      const ok = await showLocalNotification({
        title: "Wind down",
        body: "Log sleep tonight to keep your recovery streak honest.",
        tag: "lockin-sleep",
        url: "/",
        kind: "sleep",
      });
      if (ok) await db.settings.update(1, { lastSleepReminderDate: today });
    }
  }

  if (prefs.streaks && settings.lastStreakReminderDate !== today && isPastReminderTime("20:00")) {
    const ok = await showLocalNotification({
      title: "Don't break the chain",
      body: "A quick check-in keeps your streaks alive.",
      tag: "lockin-streaks",
      url: "/habits",
      kind: "streaks",
    });
    if (ok) await db.settings.update(1, { lastStreakReminderDate: today });
  }
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export async function notifyFocusComplete(minutes: number): Promise<void> {
  const settings = await db.settings.get(1);
  if (!settings?.notificationsEnabled) return;
  const prefs = remindersFromSettings(settings);
  if (!prefs?.focus) return;
  if (getNotificationPermission() !== "granted") return;

  await showLocalNotification({
    title: "Focus complete",
    body: `You locked in for ${minutes} minute${minutes === 1 ? "" : "s"}. Well done.`,
    tag: "lockin-focus-done",
    url: "/focus",
    kind: "focus",
  });
}

export function shouldPromptForNotifications(settings: {
  notificationExplained?: boolean;
  notificationsEnabled?: boolean;
}): boolean {
  if (settings.notificationExplained) return false;
  if (getNotificationPermission() === "granted") return false;
  if (getNotificationPermission() === "denied") return false;
  // On iOS, strongly prefer home-screen install first
  if (isStandalonePwa()) return true;
  return true;
}
