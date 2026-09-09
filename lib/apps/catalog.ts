import { CalendarDays, Mic2, Radio, Vote, StickyNote, Zap } from "lucide-react";
import type { AppTile } from "@/components/launcher/AppCarousel";

export const STUDIO_APPS: AppTile[] = [
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
  {
    href: "/wave-lock",
    name: "Wave Lock",
    blurb: "Multiplayer sync game — lock the pulse together.",
    Icon: Radio,
    gradient: "linear-gradient(145deg, #431407 0%, #2a0a4e 52%, #14061f 100%)",
    glow: "rgba(251, 113, 133, 0.42)",
    accent: "#FB7185",
    border: "rgba(251, 113, 133, 0.35)",
    iconBg: "rgba(251, 113, 133, 0.18)",
  },
  {
    href: "/poll",
    name: "Live Poll",
    blurb: "Instant group votes — create, share, watch live.",
    Icon: Vote,
    gradient: "linear-gradient(145deg, #0c4a6e 0%, #082f49 55%, #041018 100%)",
    glow: "rgba(56, 189, 248, 0.38)",
    accent: "#38BDF8",
    border: "rgba(56, 189, 248, 0.32)",
    iconBg: "rgba(56, 189, 248, 0.16)",
  },
  {
    href: "/board",
    name: "Orbit Board",
    blurb: "Shared sticky wall — brainstorm live with your crew.",
    Icon: StickyNote,
    gradient: "linear-gradient(145deg, #713f12 0%, #422006 55%, #1c0f03 100%)",
    glow: "rgba(251, 191, 36, 0.38)",
    accent: "#FBBF24",
    border: "rgba(251, 191, 36, 0.32)",
    iconBg: "rgba(251, 191, 36, 0.16)",
  },
];

/** Accent used on launcher brand dot animation */
export const STUDIO_BRAND_ICON = Zap;
