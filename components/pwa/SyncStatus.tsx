"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineReady } from "@/hooks/useOfflineReady";
import { CloudOff, HardDrive } from "lucide-react";

export function SyncStatus() {
  const { isOnline } = useNetworkStatus();
  const offlineReady = useOfflineReady();

  if (offlineReady && isOnline) return null;

  return (
    <div className="sync-status" aria-hidden>
      {!offlineReady ? (
        <>
          <HardDrive size={12} />
          <span>Preparing offline…</span>
        </>
      ) : (
        <>
          <CloudOff size={12} />
          <span>Local only</span>
        </>
      )}
    </div>
  );
}
