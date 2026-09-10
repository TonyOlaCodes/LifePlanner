"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Night owl mode";
  if (h < 12) return "Good morning, legend";
  if (h < 17) return "Afternoon power-up";
  if (h < 21) return "Evening vibes";
  return "Late-night universe";
}

export function NexusHero() {
  return (
    <header className="nexus-hero">
      <motion.div
        className="nexus-hero__sigil"
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        <span className="nexus-hero__ring" />
        <span className="nexus-hero__ring nexus-hero__ring--inner" />
        <Zap size={22} className="nexus-hero__bolt" />
      </motion.div>

      <motion.p
        className="nexus-hero__greet"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <Sparkles size={14} />
        {greeting()}
      </motion.p>

      <motion.h1
        className="nexus-hero__title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="nexus-hero__title-top">Welcome to</span>
        <span className="nexus-hero__title-main">NEXUS</span>
      </motion.h1>

      <motion.p
        className="nexus-hero__sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        Six dimensions. Infinite swipe. Pick your portal.
      </motion.p>
    </header>
  );
}
