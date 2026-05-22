"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getTodayString, addFocusSecondsForDate } from "@/lib/db";
import { vibrate } from "@/lib/utils";
import Link from "next/link";
import { Target, Play, Square, AlertOctagon, Plus } from "lucide-react";
import { format, startOfWeek, parseISO, addDays } from "date-fns";

const PRESETS = [15, 30, 45, 60] as const;

export default function FocusPage() {
  const settings = useLiveQuery(() => db.settings.get(1));
  const focusRows = useLiveQuery(() => db.focusDaily.toArray(), []);

  const [durationStr, setDurationStr] = useState("25");
  const [customOpen, setCustomOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSessionSecs, setTotalSessionSecs] = useState(0);
  const [failed, setFailed] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSecondsRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const today = getTodayString();

  const flushPendingSeconds = useCallback(async () => {
    const n = pendingSecondsRef.current;
    if (n <= 0) return;
    pendingSecondsRef.current = 0;
    const s = await db.settings.get(1);
    if (s) {
      const currentSecs = s.totalFocusSeconds ?? ((s.totalFocusMinutes ?? 0) * 60);
      await db.settings.update(1, { totalFocusSeconds: currentSecs + n });
    }
    await addFocusSecondsForDate(today, n);
  }, [today]);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLock.current = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
      }
    } catch {
      /* ignore */
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock.current) {
      try {
        await wakeLock.current.release();
        wakeLock.current = null;
      } catch {
        /* ignore */
      }
    }
  };

  const ensureAlarmAudio = useCallback(async () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const ctx = audioRef.current ?? new AudioContextClass();
      audioRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      /* ignore */
    }
  }, []);

  const playCompletionAlarm = useCallback(async () => {
    if (settings?.focusAlarmSound === false) return;
    await ensureAlarmAudio();
    const ctx = audioRef.current;
    if (!ctx) return;
    const start = ctx.currentTime + 0.03;
    const notes = [880, 1175, 988, 1175, 880, 1175];
    notes.forEach((freq, i) => {
      const t = start + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }, [ensureAlarmAudio, settings?.focusAlarmSound]);

  const startFocus = async () => {
    vibrate(50);
    const mins = parseInt(durationStr, 10);
    if (!mins || mins <= 0) return;
    pendingSecondsRef.current = 0;
    const secs = mins * 60;
    setTimeLeft(secs);
    setTotalSessionSecs(secs);
    setIsActive(true);
    setFailed(false);
    setShowAbandon(false);
    await ensureAlarmAudio();
    await requestWakeLock();
  };

  const stopFocus = () => {
    vibrate([30, 50, 30]);
    void flushPendingSeconds();
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = null;
    setIsActive(false);
    setTimeLeft(0);
    setTotalSessionSecs(0);
    void releaseWakeLock();
  };

  const completeFocus = useCallback(() => {
    void flushPendingSeconds();
    vibrate([50, 100, 50, 100, 50, 100]);
    void playCompletionAlarm();
    setIsActive(false);
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    flushTimerRef.current = null;
    void releaseWakeLock();
    alert("Focus session complete! Great job.");
  }, [flushPendingSeconds, playCompletionAlarm]);

  const addFiveMinutes = () => {
    vibrate(30);
    setTimeLeft((t) => t + 300);
    setTotalSessionSecs((t) => t + 300);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive && timeLeft > 0) {
        void flushPendingSeconds();
        setFailed(true);
        setIsActive(false);
        if (flushTimerRef.current) clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
        void releaseWakeLock();
        vibrate([100, 100, 100, 100]);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isActive, timeLeft, flushPendingSeconds]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft((t) => {
          pendingSecondsRef.current += 1;
          if (t <= 1) {
            completeFocus();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, timeLeft, completeFocus]);

  useEffect(() => {
    if (isActive) {
      flushTimerRef.current = setInterval(() => {
        void flushPendingSeconds();
      }, 5000);
    } else {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [isActive, flushPendingSeconds]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalSecs = (focusRows || []).reduce((sum, row) => sum + row.seconds, 0);
  const yrs = Math.floor(totalSecs / (3600 * 24 * 365));
  let rem = totalSecs % (3600 * 24 * 365);
  const mos = Math.floor(rem / (3600 * 24 * 30));
  rem %= 3600 * 24 * 30;
  const wks = Math.floor(rem / (3600 * 24 * 7));
  rem %= 3600 * 24 * 7;
  const dys = Math.floor(rem / (3600 * 24));
  rem %= 3600 * 24;
  const hrs = Math.floor(rem / 3600);
  rem %= 3600;
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;

  const timeUnits = [
    { v: yrs, l: "yrs" },
    { v: mos, l: "mos" },
    { v: wks, l: "wks" },
    { v: dys, l: "days" },
    { v: hrs, l: "hrs" },
    { v: mins, l: "mins" },
    { v: secs, l: "secs" },
  ].filter((u, i) => u.v > 0 || i >= 5);

  const goalDaily = (settings?.focusGoalDailyMinutes ?? 60) * 60;
  const goalWeekly = (settings?.focusGoalWeeklyMinutes ?? 360) * 60;
  const goalMonthly = (settings?.focusGoalMonthlyMinutes ?? 1400) * 60;
  const showGoalDaily = settings?.focusShowDailyBar !== false;
  const showGoalWeekly = settings?.focusShowWeeklyBar !== false;
  const showGoalMonthly = settings?.focusShowMonthlyBar !== false;
  const anyFocusGoalBar = showGoalDaily || showGoalWeekly || showGoalMonthly;

  const byDate = Object.fromEntries((focusRows || []).map((r) => [r.date, r.seconds]));
  const todaySecs = byDate[today] ?? 0;

  let weekSecs = 0;
  const ws = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  for (let i = 0; i < 7; i++) {
    const d = format(addDays(ws, i), "yyyy-MM-dd");
    weekSecs += byDate[d] ?? 0;
  }

  const ym = today.slice(0, 7);
  let monthSecs = 0;
  for (const r of focusRows || []) {
    if (r.date.startsWith(ym)) monthSecs += r.seconds;
  }

  const pct = (done: number, goal: number) => Math.min(100, goal > 0 ? Math.round((done / goal) * 100) : 0);

  if (isActive) {
    const progress = totalSessionSecs > 0 ? 1 - timeLeft / totalSessionSecs : 0;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0,0,0,0.78)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            filter: "brightness(0.72)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", width: 280, height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 100 100">
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
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 64, fontWeight: 800, margin: 0, letterSpacing: -2, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                {formatTime(timeLeft)}
              </h1>
              <p style={{ color: "var(--accent)", fontSize: 16, fontWeight: 700, margin: "8px 0 0", textTransform: "uppercase", letterSpacing: 2 }}>
                Deep Work
              </p>
            </div>
          </div>

          <button
            type="button"
            className="tap-scale"
            onClick={addFiveMinutes}
            style={{
              marginTop: 28,
              padding: "14px 22px",
              borderRadius: 100,
              background: "rgba(110,231,183,0.15)",
              border: "1px solid rgba(110,231,183,0.4)",
              color: "var(--accent)",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Plus size={18} /> +5 minutes
          </button>

          <p style={{ marginTop: 28, color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
            Do Not Disturb recommended. If you leave this app, your timer will fail.
          </p>

          {showAbandon ? (
            <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                type="button"
                className="tap-scale"
                onClick={stopFocus}
                style={{ padding: "16px 28px", borderRadius: 100, background: "#EF4444", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                Confirm Give Up
              </button>
              <button
                type="button"
                className="tap-scale"
                onClick={() => setShowAbandon(false)}
                style={{ padding: "16px 28px", borderRadius: 100, background: "rgba(255,255,255,0.1)", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="tap-scale"
              onClick={() => setShowAbandon(true)}
              style={{
                marginTop: 36,
                padding: "16px 32px",
                borderRadius: 100,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.55)",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Square size={18} /> Give Up
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>Focus 🎯</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0 0" }}>Zero distractions.</p>
        </div>
      </div>

      {/* Goals */}
      {anyFocusGoalBar ? (
      <div className="glass" style={{ borderRadius: 18, padding: 16, marginBottom: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>Deep work goals</p>
        {showGoalDaily && <GoalBar label="Today" done={todaySecs} goal={goalDaily} pct={pct(todaySecs, goalDaily)} />}
        {showGoalWeekly && <GoalBar label="This week" done={weekSecs} goal={goalWeekly} pct={pct(weekSecs, goalWeekly)} />}
        {showGoalMonthly && <GoalBar label="This month" done={monthSecs} goal={goalMonthly} pct={pct(monthSecs, goalMonthly)} />}
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          Change targets and which bars appear in{" "}
          <Link href="/settings" style={{ color: "var(--accent)", fontWeight: 700 }}>
            Settings
          </Link>
          .
        </p>
      </div>
      ) : (
        <div className="glass" style={{ borderRadius: 18, padding: 14, marginBottom: 22, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          No goal bars enabled. Turn them on under{" "}
          <Link href="/settings" style={{ color: "var(--accent)", fontWeight: 700 }}>
            Settings → Focus goals
          </Link>
          .
        </div>
      )}

      <div className="glass" style={{ borderRadius: 20, padding: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
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

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Duration</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
        {PRESETS.map((mins) => (
          <button
            key={mins}
            type="button"
            onClick={() => {
              setDurationStr(String(mins));
              setCustomOpen(false);
            }}
            style={{
              padding: "18px 12px",
              borderRadius: 16,
              background: durationStr === String(mins) && !customOpen ? "var(--accent)" : "var(--surface-2)",
              border: `1px solid ${durationStr === String(mins) && !customOpen ? "var(--accent)" : "var(--border)"}`,
              color: durationStr === String(mins) && !customOpen ? "#000" : "var(--text-primary)",
              fontSize: 17,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {mins} <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 600 }}>min</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setCustomOpen(true)}
        style={{
          width: "100%",
          marginBottom: 14,
          padding: 14,
          borderRadius: 14,
          border: `1px solid ${customOpen ? "var(--accent)" : "var(--border)"}`,
          background: customOpen ? "var(--accent)20" : "var(--surface-2)",
          color: "var(--text-secondary)",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Custom time (minutes)
      </button>
      {customOpen && (
        <input
          type="number"
          min={1}
          max={600}
          className="lock-input"
          placeholder="e.g. 90"
          value={durationStr}
          onChange={(e) => setDurationStr(e.target.value)}
          style={{ marginBottom: 20 }}
        />
      )}

      <button type="button" className="tap-scale" onClick={() => void startFocus()}
        style={{ padding: 20, borderRadius: 20, background: "var(--text-primary)", border: "none", color: "var(--bg)", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Play size={20} fill="currentColor" /> Enter Focus Mode
      </button>

      <p style={{ marginTop: 24, color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
        Turn on Do Not Disturb before starting.<br />If you switch apps, the timer will fail.
      </p>
    </div>
  );
}

function GoalBar({ label, done, goal, pct }: { label: string; done: number; goal: number; pct: number }) {
  const doneM = Math.round(done / 60);
  const goalM = Math.round(goal / 60);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "var(--text-secondary)" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span>
          {doneM} / {goalM} min ({pct}%)
        </span>
      </div>
      <div className="progress-track" style={{ height: 8, borderRadius: 8 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, borderRadius: 8 }} />
      </div>
    </div>
  );
}
