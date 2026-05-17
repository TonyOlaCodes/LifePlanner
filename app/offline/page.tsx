"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="offline-fallback fade-in">
      <div className="glass" style={{ padding: 28, borderRadius: 20, textAlign: "center", maxWidth: 340 }}>
        <WifiOff size={40} style={{ color: "var(--accent)", margin: "0 auto 16px" }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>You&apos;re offline</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
          Lock In keeps working from data on your phone. Reopen the app or try again when you have signal.
        </p>
        <Link
          href="/"
          className="tap-scale"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            borderRadius: 14,
            background: "var(--accent)",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          Open Lock In
        </Link>
      </div>
    </main>
  );
}
