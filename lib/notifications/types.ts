export type ReminderKind = "daily" | "habits" | "study" | "sleep" | "streaks" | "focus";

export interface NotificationReminders {
  daily: boolean;
  habits: boolean;
  study: boolean;
  sleep: boolean;
  streaks: boolean;
  focus: boolean;
}

export const DEFAULT_NOTIFICATION_REMINDERS: NotificationReminders = {
  daily: true,
  habits: true,
  study: true,
  sleep: true,
  streaks: true,
  focus: true,
};

export interface LocalNotificationPayload {
  title: string;
  body: string;
  tag: string;
  url?: string;
  kind: ReminderKind;
}
