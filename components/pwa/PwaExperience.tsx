"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { runReminderChecks, shouldPromptForNotifications } from "@/lib/notifications/scheduler";
import { usePwaContext } from "@/hooks/usePwaContext";
import { IosInstallSheet } from "./IosInstallSheet";
import { NotificationPermissionSheet } from "./NotificationPermissionSheet";
import { OfflineIndicator } from "./OfflineIndicator";
import { SyncStatus } from "./SyncStatus";

const INSTALL_DISMISS = "lockin-install-sheet-dismissed";
const INTERACTION_KEY = "lockin-interactions";
const MIN_INTERACTIONS_FOR_NOTIF = 2;

export function PwaExperience({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const settings = useLiveQuery(() => db.settings.get(1));
  const pwa = usePwaContext();
  const [installOpen, setInstallOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(true);

  useEffect(() => {
    setInstallDismissed(sessionStorage.getItem(INSTALL_DISMISS) === "1");
  }, []);

  useEffect(() => {
    pwa.registerInteraction();
    const n = parseInt(sessionStorage.getItem(INTERACTION_KEY) || "0", 10) + 1;
    sessionStorage.setItem(INTERACTION_KEY, String(n));
  }, [pathname, pwa.registerInteraction]);

  useEffect(() => {
    if (!pwa.isStandalone && pwa.showIosInstallGuide && !installDismissed) {
      const t = setTimeout(() => setInstallOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [pwa.isStandalone, pwa.showIosInstallGuide, installDismissed]);

  useEffect(() => {
    if (!settings) return;
    const interactions = parseInt(sessionStorage.getItem(INTERACTION_KEY) || "0", 10);
    if (interactions < MIN_INTERACTIONS_FOR_NOTIF) return;
    if (installOpen) return;
    if (!shouldPromptForNotifications(settings)) return;
    if (pwa.needsInstallForIosNotifications) return;
    const t = setTimeout(() => setNotifOpen(true), 800);
    return () => clearTimeout(t);
  }, [settings, installOpen, pwa.needsInstallForIosNotifications, pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void runReminderChecks();
    };
    const onOpenNotif = () => setNotifOpen(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("lockin:open-notifications", onOpenNotif);
    void runReminderChecks();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("lockin:open-notifications", onOpenNotif);
    };
  }, []);

  const closeInstall = () => {
    sessionStorage.setItem(INSTALL_DISMISS, "1");
    setInstallDismissed(true);
    setInstallOpen(false);
  };

  return (
    <>
      <OfflineIndicator />
      <SyncStatus />
      <IosInstallSheet open={installOpen} onClose={closeInstall} />
      <NotificationPermissionSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        needsInstallFirst={pwa.needsInstallForIosNotifications}
        onRequestInstall={() => {
          setNotifOpen(false);
          setInstallOpen(true);
        }}
        onGranted={pwa.refreshPermission}
      />
      {children}
    </>
  );
}
