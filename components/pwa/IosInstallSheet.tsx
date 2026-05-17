"use client";

import { Bell, Share, Smartphone, Sparkles, X, Zap } from "lucide-react";
import { vibrate } from "@/lib/utils";

interface IosInstallSheetProps {
  open: boolean;
  onClose: () => void;
}

export function IosInstallSheet({ open, onClose }: IosInstallSheetProps) {
  if (!open) return null;

  return (
    <>
      <div className="pwa-sheet-backdrop fade-in" onClick={onClose} aria-hidden />
      <div className="pwa-sheet slide-up" role="dialog" aria-labelledby="ios-install-title">
        <div className="sheet-handle" />
        <button type="button" className="pwa-sheet-close tap-scale" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <div className="pwa-sheet-icon-wrap">
          <Smartphone size={32} style={{ color: "var(--accent)" }} />
        </div>
        <h2 id="ios-install-title" className="pwa-sheet-title">
          Add Lock In to your Home Screen
        </h2>
        <p className="pwa-sheet-sub">
          On iPhone, the full experience — including reminders — works best when you install the app.
        </p>
        <ul className="pwa-benefit-list">
          <li>
            <Bell size={18} />
            <span>Local reminders for habits, focus, and streaks</span>
          </li>
          <li>
            <Zap size={18} />
            <span>Opens fullscreen like a native app</span>
          </li>
          <li>
            <Sparkles size={18} />
            <span>Works offline after your first visit</span>
          </li>
        </ul>
        <ol className="pwa-ios-steps">
          <li>
            Tap <Share size={16} style={{ display: "inline", verticalAlign: "middle" }} /> <strong>Share</strong> in Safari
          </li>
          <li>
            Scroll and tap <strong>Add to Home Screen</strong>
          </li>
          <li>Open <strong>Lock In</strong> from your home screen</li>
        </ol>
        <button type="button" className="pwa-sheet-cta tap-scale" onClick={() => { vibrate(20); onClose(); }}>
          Got it
        </button>
      </div>
    </>
  );
}
