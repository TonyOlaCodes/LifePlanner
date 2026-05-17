"use client";

import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download, Share, X } from "lucide-react";
import { vibrate } from "@/lib/utils";

const DISMISS_KEY = "lockin-install-dismissed";

export function InstallPrompt() {
  const { canInstall, showIosHint, isStandalone, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (isStandalone || dismissed) return null;
  if (!canInstall && !showIosHint) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const onInstall = async () => {
    vibrate(30);
    const ok = await promptInstall();
    if (ok) dismiss();
  };

  return (
    <div className="install-banner glass slide-up">
      <button type="button" className="install-dismiss tap-scale" onClick={dismiss} aria-label="Dismiss">
        <X size={18} />
      </button>
      {canInstall ? (
        <>
          <p className="install-title">Install Lock In</p>
          <p className="install-sub">Add to your home screen for the full native experience.</p>
          <button type="button" className="install-cta tap-scale" onClick={onInstall}>
            <Download size={16} />
            Install app
          </button>
        </>
      ) : (
        <>
          <p className="install-title">Add to Home Screen</p>
          <p className="install-sub">
            Tap <Share size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Share, then &quot;Add to Home Screen&quot;.
          </p>
        </>
      )}
    </div>
  );
}
