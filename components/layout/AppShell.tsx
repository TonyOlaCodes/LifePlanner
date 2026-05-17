"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { db, initializeSettings, seedDefaultHabits, seedBootstrapPack } from "@/lib/db";
import BottomNav from "./BottomNav";
import { useLiveQuery } from "dexie-react-hooks";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setSettings } = useAppStore();

  // Reactively sync settings to store so CSS vars update globally
  const settings = useLiveQuery(() => db.settings.get(1));

  useEffect(() => {
    initializeSettings().then((s) => setSettings(s));
    void seedDefaultHabits().then(() => seedBootstrapPack());
  }, []);

  useEffect(() => {
    if (!settings) return;
    setSettings(settings);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    document.documentElement.style.setProperty("--accent-secondary", settings.accentColorSecondary);
    // OLED black only (theme picker removed)
    document.documentElement.style.setProperty("--bg", "#000000");
    document.documentElement.style.setProperty("--surface", "#0A0A0A");
  }, [settings]);

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
