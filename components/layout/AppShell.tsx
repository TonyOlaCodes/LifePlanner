"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { db, initializeSettings, seedDefaultHabits } from "@/lib/db";
import BottomNav from "./BottomNav";
import { useLiveQuery } from "dexie-react-hooks";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setSettings } = useAppStore();

  // Reactively sync settings to store so CSS vars update globally
  const settings = useLiveQuery(() => db.settings.get(1));

  useEffect(() => {
    initializeSettings().then((s) => setSettings(s));
    seedDefaultHabits();
  }, []);

  useEffect(() => {
    if (!settings) return;
    setSettings(settings);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    document.documentElement.style.setProperty("--accent-secondary", settings.accentColorSecondary);
    if (settings.theme === "dark") {
      document.documentElement.style.setProperty("--bg", "#0D0D0D");
      document.documentElement.style.setProperty("--surface", "#161618");
    } else {
      document.documentElement.style.setProperty("--bg", "#000000");
      document.documentElement.style.setProperty("--surface", "#0A0A0A");
    }
  }, [settings]);

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
