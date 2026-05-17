import { db, initializeSettings, type AppSettings } from "@/lib/db";

export const settingsService = {
  get: () => db.settings.get(1),
  ensure: () => initializeSettings(),
  update: (patch: Partial<Omit<AppSettings, "id">>) => db.settings.update(1, patch),
  put: (settings: AppSettings) => db.settings.put(settings),
};
