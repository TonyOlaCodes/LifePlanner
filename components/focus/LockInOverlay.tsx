"use client";

import { useEffect } from "react";
import { Moon, Plus, Square } from "lucide-react";
import { vibrate } from "@/lib/utils";

interface LockInOverlayProps {
  timeLeft: number;
  totalSessionSecs: number;
  showAbandon: boolean;
  onAddFive: () => void;
  onRequestAbandon: () => void;
  onConfirmAbandon: () => void;
  onCancelAbandon: () => void;
}

export function LockInOverlay({
  timeLeft,
  totalSessionSecs,
  showAbandon,
  onAddFive,
  onRequestAbandon,
  onConfirmAbandon,
  onCancelAbandon,
}: LockInOverlayProps) {
  const progress = totalSessionSecs > 0 ? 1 - timeLeft / totalSessionSecs : 0;

  useEffect(() => {
    document.documentElement.classList.add("lock-in-mode");
    return () => document.documentElement.classList.remove("lock-in-mode");
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="lock-in-overlay fade-in" role="dialog" aria-label="Lock In focus mode">
      <div className="lock-in-glow" aria-hidden />
      <div className="lock-in-content">
        <p className="lock-in-label">Lock In Mode</p>
        <div className="lock-in-ring-wrap">
          <svg className="lock-in-ring" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeDasharray="283"
              strokeDashoffset={283 * (1 - Math.max(0, Math.min(1, progress)))}
            />
          </svg>
          <div className="lock-in-time">{formatTime(timeLeft)}</div>
        </div>
        <p className="lock-in-sub">Deep work in progress</p>
        <div className="lock-in-dnd glass">
          <Moon size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <p>
            Turn on <strong>Focus</strong> or Do Not Disturb in Control Center for fewer interruptions.
          </p>
        </div>
        <button type="button" className="lock-in-add tap-scale" onClick={onAddFive}>
          <Plus size={18} /> +5 min
        </button>
        {showAbandon ? (
          <div className="lock-in-abandon-row">
            <button type="button" className="lock-in-stop tap-scale" onClick={onConfirmAbandon}>
              End session
            </button>
            <button type="button" className="lock-in-cancel tap-scale" onClick={onCancelAbandon}>
              Keep going
            </button>
          </div>
        ) : (
          <button type="button" className="lock-in-giveup tap-scale" onClick={onRequestAbandon}>
            <Square size={16} /> End early
          </button>
        )}
      </div>
    </div>
  );
}
