"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useState, type CSSProperties } from "react";
import { MiniAppShell } from "@/components/mini-app/MiniAppShell";
import { Wind } from "lucide-react";

const MOODS = [
  {
    id: "calm",
    label: "Calm",
    accent: "#6EE7B7",
    accent2: "#38BDF8",
    orbs: ["#6EE7B7", "#34D399", "#38BDF8", "#A78BFA"],
    copy: "Slow breath. Soft glow. You’re safe here.",
  },
  {
    id: "energy",
    label: "Energy",
    accent: "#FB7185",
    accent2: "#FBBF24",
    orbs: ["#FB7185", "#F97316", "#FBBF24", "#F472B6"],
    copy: "Charge up. Bold moves. Full send.",
  },
  {
    id: "dream",
    label: "Dream",
    accent: "#A78BFA",
    accent2: "#818CF8",
    orbs: ["#A78BFA", "#818CF8", "#C084FC", "#38BDF8"],
    copy: "Drift deep. Ideas without gravity.",
  },
  {
    id: "void",
    label: "Void",
    accent: "#22D3EE",
    accent2: "#6EE7B7",
    orbs: ["#0EA5E9", "#22D3EE", "#6366F1", "#14B8A6"],
    copy: "Pure focus. Nothing else exists.",
  },
] as const;

export default function AuraPage() {
  const [idx, setIdx] = useState(0);
  const mood = MOODS[idx];

  const cycle = useCallback(() => {
    setIdx((i) => (i + 1) % MOODS.length);
  }, []);

  return (
    <MiniAppShell title="Aura" accent={mood.accent} accentSecondary={mood.accent2}>
      <main
        className="aura-page"
        style={{ "--aura-a": mood.accent, "--aura-b": mood.accent2 } as CSSProperties}
        onClick={cycle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && cycle()}
        aria-label="Tap to change mood"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={mood.id}
            className="aura-orbs"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {mood.orbs.map((color, i) => (
              <motion.span
                key={color}
                className="aura-orb"
                style={{ background: color }}
                animate={{
                  x: [0, 30 - i * 12, -20 + i * 8, 0],
                  y: [0, -25 + i * 10, 20 - i * 6, 0],
                  scale: [1, 1.15, 0.95, 1],
                }}
                transition={{ duration: 8 + i * 2, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="aura-breathe"
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="aura-ui">
          <span className="aura-tag">
            <Wind size={14} />
            {mood.label}
          </span>
          <h1 className="aura-title">Aura Chamber</h1>
          <p className="aura-copy">{mood.copy}</p>
          <p className="aura-hint">Tap anywhere to shift dimension</p>
        </div>
      </main>
    </MiniAppShell>
  );
}
