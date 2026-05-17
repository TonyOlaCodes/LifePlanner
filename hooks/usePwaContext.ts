"use client";

import { useCallback, useEffect, useState } from "react";
import {
  canUseIosPwaNotifications,
  getDisplayMode,
  getNotificationPermission,
  isIOS,
  isSafariBrowser,
  isStandalonePwa,
} from "@/lib/pwa/platform";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePwaContext() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setIsStandalone(isStandalonePwa());
    setIsIos(isIOS());
    setIsSafari(isSafariBrowser());
    setPermission(getNotificationPermission());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const registerInteraction = useCallback(() => {
    setInteractionCount((c) => c + 1);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === "accepted";
  }, [deferred]);

  const refreshPermission = useCallback(() => {
    setPermission(getNotificationPermission());
  }, []);

  return {
    isStandalone,
    isIos,
    isSafari,
    displayMode: getDisplayMode(),
    canInstall: !!deferred && !isStandalone,
    showIosInstallGuide: isIos && !isStandalone,
    canUseNotifications: canUseIosPwaNotifications(),
    permission,
    interactionCount,
    registerInteraction,
    promptInstall,
    refreshPermission,
    needsInstallForIosNotifications: isIos && !isStandalone,
  };
}
