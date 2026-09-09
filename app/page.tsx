"use client";

import { CalendarDays, Mic2 } from "lucide-react";
import { AppCarousel, type AppTile } from "@/components/launcher/AppCarousel";

const APPS: AppTile[] = [
  {
    href: "/life",
    name: "Life Planner",
    blurb: "Habits, focus, tasks, and daily lock-in.",
    Icon: CalendarDays,
    gradient: "linear-gradient(145deg, #0f3d2e 0%, #06241a 55%, #041510 100%)",
    glow: "rgba(110, 231, 183, 0.38)",
    accent: "#6EE7B7",
    border: "rgba(110, 231, 183, 0.28)",
    iconBg: "rgba(110, 231, 183, 0.14)",
  },
  {
    href: "/transcript",
    name: "Transcript",
    blurb: "Upload a video, get text you can copy.",
    Icon: Mic2,
    gradient: "linear-gradient(145deg, #2e1065 0%, #1e1b4b 55%, #0f0a24 100%)",
    glow: "rgba(167, 139, 250, 0.38)",
    accent: "#A78BFA",
    border: "rgba(167, 139, 250, 0.32)",
    iconBg: "rgba(167, 139, 250, 0.16)",
  },
];

export default function StartPage() {
  return (
    <main className="start-page">
      <div className="start-page__atmosphere" aria-hidden />
      <header className="start-page__header">
        <p className="start-page__brand">Studio</p>
        <h1 className="start-page__title">Your apps</h1>
        <p className="start-page__sub">Pick one to open. Swipe forever — it loops.</p>
      </header>

      <AppCarousel apps={APPS} />
    </main>
  );
}
