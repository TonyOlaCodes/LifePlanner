/** iPhone / iOS PWA detection and capability checks. */

export type PwaDisplayMode = "standalone" | "browser" | "minimal-ui" | "fullscreen" | "unknown";

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

export function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function getDisplayMode(): PwaDisplayMode {
  if (typeof window === "undefined") return "unknown";
  const modes: PwaDisplayMode[] = ["standalone", "fullscreen", "minimal-ui", "browser"];
  for (const m of modes) {
    if (window.matchMedia(`(display-mode: ${m})`).matches) return m;
  }
  return isStandalonePwa() ? "standalone" : "browser";
}

export function supportsWebNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/** iOS 16.4+ home-screen PWAs support push/local notifications when installed. */
export function canUseIosPwaNotifications(): boolean {
  return supportsWebNotifications() && (isStandalonePwa() || !isIOS());
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!supportsWebNotifications()) return "unsupported";
  return Notification.permission;
}
