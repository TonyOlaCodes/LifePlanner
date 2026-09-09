"use client";

import { AppShell } from "@/components/layout/AppShell";

export default function LifeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="life-shell">
      <AppShell>{children}</AppShell>
    </div>
  );
}
