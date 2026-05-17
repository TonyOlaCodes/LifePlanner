"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const { isOffline } = useNetworkStatus();
  if (!isOffline) return null;

  return (
    <div role="status" aria-live="polite" className="offline-pill slide-up">
      <WifiOff size={14} aria-hidden />
      <span>Offline — your data is saved on this device</span>
    </div>
  );
}
