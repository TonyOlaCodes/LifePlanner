"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getOnlineServerSnapshot() {
  return true;
}

export function useNetworkStatus() {
  const isOnline = useSyncExternalStore(subscribe, getOnlineSnapshot, getOnlineServerSnapshot);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) setWasOffline(true);
  }, [isOnline]);

  return { isOnline, wasOffline, isOffline: !isOnline };
}
