import { create } from "zustand";
import { AppSettings } from "@/lib/db";

interface AppState {
  settings: AppSettings | null;
  setSettings: (s: AppSettings) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openSheet: string | null;
  setOpenSheet: (sheet: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  settings: null,
  setSettings: (s) => set({ settings: s }),
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),
  openSheet: null,
  setOpenSheet: (sheet) => set({ openSheet: sheet }),
}));
