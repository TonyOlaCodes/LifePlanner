"use client";

import Link from "next/link";
import { CalendarDays, Mic2 } from "lucide-react";

const APPS = [
  {
    href: "/life",
    name: "Life Planner",
    blurb: "Habits, focus, tasks, and daily lock-in.",
    Icon: CalendarDays,
    gradient: "linear-gradient(145deg, #0f3d2e 0%, #06241a 55%, #041510 100%)",
    glow: "rgba(110, 231, 183, 0.35)",
    accent: "#6EE7B7",
  },
  {
    href: "/transcript",
    name: "Transcript",
    blurb: "Upload a video, get text you can copy.",
    Icon: Mic2,
    gradient: "linear-gradient(145deg, #1a2f28 0%, #0c1a16 55%, #07110e 100%)",
    glow: "rgba(52, 211, 153, 0.3)",
    accent: "#34D399",
  },
] as const;

export default function StartPage() {
  return (
    <main className="start-page">
      <div className="start-page__atmosphere" aria-hidden />
      <header className="start-page__header">
        <p className="start-page__brand">Studio</p>
        <h1 className="start-page__title">Your apps</h1>
        <p className="start-page__sub">Pick one to open. Swipe to see more.</p>
      </header>

      <div className="start-page__rail" role="list">
        {APPS.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            role="listitem"
            className="start-tile tap-scale"
            style={{
              background: app.gradient,
              boxShadow: `0 18px 40px ${app.glow}`,
            }}
          >
            <div className="start-tile__icon" style={{ color: app.accent }}>
              <app.Icon size={36} strokeWidth={1.75} />
            </div>
            <div className="start-tile__copy">
              <h2 style={{ color: app.accent }}>{app.name}</h2>
              <p>{app.blurb}</p>
            </div>
            <span className="start-tile__open" style={{ color: app.accent }}>
              Open →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
