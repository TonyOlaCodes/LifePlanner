"use client";

import { useEffect, useState } from "react";

export function useOfflineReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setReady(true);
      return;
    }

    if (process.env.NODE_ENV === "development") {
      setReady(true);
      return;
    }

    const onController = () => setReady(true);

    if (navigator.serviceWorker.controller) {
      setReady(true);
    } else {
      navigator.serviceWorker.addEventListener("controllerchange", onController);
    }

    navigator.serviceWorker.ready.then(() => setReady(true)).catch(() => setReady(true));

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onController);
  }, []);

  return ready;
}
