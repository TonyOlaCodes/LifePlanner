"use client";

import { useState } from "react";
import { Bell, Flame, Moon, Target, X } from "lucide-react";
import { db } from "@/lib/db";
import { requestNotificationPermission } from "@/lib/notifications/local";
import { runReminderChecks } from "@/lib/notifications/scheduler";
import { vibrate } from "@/lib/utils";

interface NotificationPermissionSheetProps {
  open: boolean;
  onClose: () => void;
  onGranted?: () => void;
  needsInstallFirst?: boolean;
  onRequestInstall?: () => void;
}

export function NotificationPermissionSheet({
  open,
  onClose,
  onGranted,
  needsInstallFirst,
  onRequestInstall,
}: NotificationPermissionSheetProps) {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function enable() {
    if (needsInstallFirst) {
      onRequestInstall?.();
      return;
    }
    setBusy(true);
    vibrate(30);
    const result = await requestNotificationPermission();
    await db.settings.update(1, {
      notificationExplained: true,
      notificationsEnabled: result === "granted",
    });
    setBusy(false);
    if (result === "granted") {
      vibrate(50);
      void runReminderChecks();
      onGranted?.();
      onClose();
    } else {
      await db.settings.update(1, { notificationExplained: true });
      onClose();
    }
  }

  async function notNow() {
    vibrate(15);
    await db.settings.update(1, { notificationExplained: true });
    onClose();
  }

  return (
    <>
      <div className="pwa-sheet-backdrop fade-in" onClick={notNow} aria-hidden />
      <div className="pwa-sheet slide-up" role="dialog" aria-labelledby="notif-perm-title">
        <div className="sheet-handle" />
        <button type="button" className="pwa-sheet-close tap-scale" onClick={notNow} aria-label="Close">
          <X size={20} />
        </button>
        <div className="pwa-sheet-icon-wrap">
          <Bell size={32} style={{ color: "var(--accent)" }} />
        </div>
        <h2 id="notif-perm-title" className="pwa-sheet-title">
          Stay accountable
        </h2>
        <p className="pwa-sheet-sub">
          Gentle local reminders for habits, deep work, sleep, and streaks — only on this device.
        </p>
        {needsInstallFirst && (
          <p className="pwa-sheet-note">
            Add Lock In to your Home Screen first. iPhone only allows notifications for installed apps.
          </p>
        )}
        <ul className="pwa-benefit-list">
          <li>
            <Flame size={18} />
            <span>Habit & streak nudges</span>
          </li>
          <li>
            <Target size={18} />
            <span>Focus session complete alerts</span>
          </li>
          <li>
            <Moon size={18} />
            <span>Evening wind-down reminders</span>
          </li>
        </ul>
        <button
          type="button"
          className="pwa-sheet-cta tap-scale"
          disabled={busy}
          onClick={() => void enable()}
        >
          {needsInstallFirst ? "Add to Home Screen first" : busy ? "One moment…" : "Enable reminders"}
        </button>
        <button type="button" className="pwa-sheet-secondary tap-scale" onClick={() => void notNow()}>
          Not now
        </button>
      </div>
    </>
  );
}
