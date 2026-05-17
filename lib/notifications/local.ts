import type { LocalNotificationPayload } from "./types";
import { canUseIosPwaNotifications, supportsWebNotifications } from "@/lib/pwa/platform";

const ICON = "/icons/192";

export async function showLocalNotification(payload: LocalNotificationPayload): Promise<boolean> {
  if (!supportsWebNotifications() || Notification.permission !== "granted") return false;

  const { title, body, tag, url = "/" } = payload;

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: ICON,
        badge: ICON,
        tag,
        data: { url, kind: payload.kind },
        silent: false,
      } as NotificationOptions);
      return true;
    }
    new Notification(title, { body, icon: ICON, tag });
    return true;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!canUseIosPwaNotifications()) {
    if (!supportsWebNotifications()) return "unsupported";
    // Safari in browser tab — still ask; iOS may deny until installed
    if (!("Notification" in window)) return "unsupported";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function parseReminderTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h || 8, minute: m || 0 };
}

export function isPastReminderTime(reminderTime: string, now = new Date()): boolean {
  const { hour, minute } = parseReminderTime(reminderTime);
  const t = hour * 60 + minute;
  const n = now.getHours() * 60 + now.getMinutes();
  return n >= t;
}
