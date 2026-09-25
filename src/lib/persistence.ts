import { isTauri } from "@tauri-apps/api/core";

export type PersistenceMode = "sqlite" | "browser";

export interface PersistenceStatus {
  mode: PersistenceMode;
  label: string;
}

let desktopDatabase:
  | import("@tauri-apps/plugin-sql").default
  | null = null;

export async function initializePersistence(): Promise<PersistenceStatus> {
  if (!isTauri()) {
    if (!localStorage.getItem("avsw-browser-storage-ready")) {
      localStorage.setItem(
        "avsw-browser-storage-ready",
        new Date().toISOString(),
      );
    }

    return {
      mode: "browser",
      label: "Browser development storage",
    };
  }

  const { default: Database } = await import("@tauri-apps/plugin-sql");
  desktopDatabase = await Database.load("sqlite:av-sw.db");
  await desktopDatabase.select("SELECT 1 AS ok");

  return {
    mode: "sqlite",
    label: "Local SQLite",
  };
}

export function getDesktopDatabase() {
  if (!desktopDatabase) {
    throw new Error("Desktop database has not been initialized.");
  }

  return desktopDatabase;
}
