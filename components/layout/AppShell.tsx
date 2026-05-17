"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { db, initializeSettings, seedDefaultHabits, seedBootstrapPack } from "@/lib/db";
import BottomNav from "./BottomNav";
import { PageTransition } from "./PageTransition";
import { useLiveQuery } from "dexie-react-hooks";
import { PwaExperience } from "@/components/pwa/PwaExperience";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setSettings } = useAppStore();
  const settings = useLiveQuery(() => db.settings.get(1));

  useEffect(() => {
    initializeSettings().then((s) => setSettings(s));
    void seedDefaultHabits().then(() => seedBootstrapPack());
  }, [setSettings]);

  useEffect(() => {
    if (!settings) return;
    setSettings(settings);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    document.documentElement.style.setProperty("--accent-secondary", settings.accentColorSecondary);
    document.documentElement.style.setProperty("--bg", "#000000");
    document.documentElement.style.setProperty("--surface", "#0A0A0A");
  }, [settings, setSettings]);

  useEffect(() => {
    document.documentElement.classList.add("pwa-ready");
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) document.documentElement.classList.add("standalone");
  }, []);

  return (
    <PwaExperience>
      <PageTransition>{children}</PageTransition>
      <BottomNav />
    </PwaExperience>
  );
}
