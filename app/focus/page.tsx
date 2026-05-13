"use client";

import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { vibrate } from "@/lib/utils";
import { Target, Play, Square, AlertOctagon } from "lucide-react";

export default function FocusPage() {
  const settings = useLiveQuery(() => db.settings.get(1));
  const [durationStr, setDurationStr] = useState("25");
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [failed, setFailed] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const wakeLock = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request wake lock to keep screen on
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLock.current = await navigator.wakeLock.request("screen");
      }
    } catch (err) {
      console.log("Wake lock error:", err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock.current) {
      try {
        await wakeLock.current.release();
        wakeLock.current = null;
      } catch (err) {
        console.log("Wake lock release error:", err);
      }
    }
  };

  const startFocus = async () => {
    vibrate(50);
    const mins = parseInt(durationStr);
    if (!mins || mins <= 0) return;
    
    setTimeLeft(mins * 60);
    setIsActive(true);
    setFailed(false);
    await requestWakeLock();
  };

  const stopFocus = () => {
    vibrate([30, 50, 30]);
    setIsActive(false);
    setTimeLeft(0);
    releaseWakeLock();
  };

  // Handle visibility change (leaving the app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive && timeLeft > 0) {
        // Failed focus session!
        setFailed(true);
        setIsActive(false);
        releaseWakeLock();
        vibrate([100, 100, 100, 100]); // Angry vibration
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive, timeLeft]);

  // Timer logic
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setTimeout(async () => {
        setTimeLeft(t => t - 1);
        const s = await db.settings.get(1);
        if (s) {
          const currentSecs = s.totalFocusSeconds ?? ((s.totalFocusMinutes ?? 0) * 60);
          await db.settings.update(1, { totalFocusSeconds: currentSecs + 1 });
        }
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      // Completed!
      vibrate([50, 100, 50, 100, 50, 100]);
      setIsActive(false);
      releaseWakeLock();
      alert("Focus session complete! Great job.");
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, timeLeft]);

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalSecs = settings?.totalFocusSeconds ?? ((settings?.totalFocusMinutes ?? 0) * 60);
  const yrs = Math.floor(totalSecs / (3600 * 24 * 365));
  let rem = totalSecs % (3600 * 24 * 365);
  const mos = Math.floor(rem / (3600 * 24 * 30));
  rem %= (3600 * 24 * 30);
  const wks = Math.floor(rem / (3600 * 24 * 7));
  rem %= (3600 * 24 * 7);
  const dys = Math.floor(rem / (3600 * 24));
  rem %= (3600 * 24);
  const hrs = Math.floor(rem / 3600);
  rem %= 3600;
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;

  const timeUnits = [
    { v: yrs, l: "yrs" }, { v: mos, l: "mos" }, { v: wks, l: "wks" },
    { v: dys, l: "days" }, { v: hrs, l: "hrs" }, { v: mins, l: "mins" }, { v: secs, l: "secs" }
  ].filter((u, i) => u.v > 0 || i >= 5);

  if (isActive) {
    const progress = 1 - (timeLeft / (parseInt(durationStr) * 60));
    
    return (
      <div style={{ padding: "0 16px", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
        <div style={{ position: "relative", width: 280, height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Progress Ring */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface-3)" strokeWidth="4" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="4" strokeDasharray="283" strokeDashoffset={283 * (1 - progress)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 64, fontWeight: 800, margin: 0, letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>
              {formatTime(timeLeft)}
            </h1>
            <p style={{ color: "var(--accent)", fontSize: 16, fontWeight: 700, margin: "8px 0 0", textTransform: "uppercase", letterSpacing: 2 }}>
              Deep Work
            </p>
          </div>
        </div>
        
        <p style={{ marginTop: 40, color: "var(--text-secondary)", fontSize: 14, textAlign: "center", maxWidth: 250, lineHeight: 1.6 }}>
          Do Not Disturb recommended. If you leave this app, your timer will fail.
        </p>

        {showAbandon ? (
          <div style={{ marginTop: 60, display: "flex", gap: 12 }}>
            <button className="tap-scale" onClick={stopFocus}
              style={{ padding: "16px 32px", borderRadius: 100, background: "#EF4444", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Confirm Give Up
            </button>
            <button className="tap-scale" onClick={() => setShowAbandon(false)}
              style={{ padding: "16px 32px", borderRadius: 100, background: "var(--surface-3)", border: "none", color: "var(--text-secondary)", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="tap-scale" onClick={() => setShowAbandon(true)}
            style={{ marginTop: 60, padding: "16px 32px", borderRadius: 100, background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Square size={18} /> Give Up
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px", paddingTop: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>Focus 🎯</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0 0" }}>Zero distractions.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="glass" style={{ borderRadius: 20, padding: 20, marginBottom: 32, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0, fontWeight: 600 }}>Total Deep Work</p>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent)20", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Target size={16} style={{ color: "var(--accent)" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {timeUnits.map((u, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1 }}>{u.v}</span>
              <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 600 }}>{u.l}</span>
            </div>
          ))}
        </div>
      </div>

      {failed && (
        <div style={{ padding: 16, borderRadius: 16, background: "#EF444415", border: "1px solid #EF444430", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertOctagon size={24} style={{ color: "#EF4444", flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: 0, color: "#EF4444", fontSize: 15, fontWeight: 700 }}>Focus Failed</h3>
            <p style={{ margin: "4px 0 0", color: "#EF4444", fontSize: 13, opacity: 0.9 }}>You left the app! Deep work requires unbroken attention.</p>
          </div>
        </div>
      )}

      {/* Setup */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Set Duration</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        {[15, 25, 45, 60, 90, 120].map((mins) => (
          <button key={mins} onClick={() => setDurationStr(mins.toString())}
            style={{ 
              padding: "20px 16px", borderRadius: 18, 
              background: durationStr === mins.toString() ? "var(--accent)" : "var(--surface-2)", 
              border: `1px solid ${durationStr === mins.toString() ? "var(--accent)" : "var(--border)"}`, 
              color: durationStr === mins.toString() ? "#000" : "var(--text-primary)", 
              fontSize: 18, fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease",
              textAlign: "center"
            }}>
            {mins} <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>min</span>
          </button>
        ))}
      </div>

      <button className="tap-scale" onClick={startFocus}
        style={{ padding: 20, borderRadius: 20, background: "var(--text-primary)", border: "none", color: "var(--bg)", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Play size={20} fill="currentColor" /> Enter Focus Mode
      </button>

      <p style={{ marginTop: 24, color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
        Turn on Do Not Disturb before starting.<br/>If you switch apps, the timer will fail.
      </p>
    </div>
  );
}
