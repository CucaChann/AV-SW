/** Recently opened or saved project files (desktop only; browsers have no paths). */

export type RecentProject = { path: string; name: string; openedAt: string };

const STORAGE_KEY = "avsw-recent-projects";
export const MAX_RECENTS = 8;

/** Most recent first, one entry per path (case-insensitive, as on Windows). */
export function withRecent(list: RecentProject[], entry: RecentProject): RecentProject[] {
  const key = entry.path.toLowerCase();
  return [entry, ...list.filter((item) => item.path.toLowerCase() !== key)].slice(0, MAX_RECENTS);
}

export function withoutRecent(list: RecentProject[], path: string): RecentProject[] {
  const key = path.toLowerCase();
  return list.filter((item) => item.path.toLowerCase() !== key);
}

export function loadRecents(): RecentProject[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is RecentProject =>
            typeof item?.path === "string" && typeof item?.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function storeRecents(list: RecentProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Recents are a convenience; failing to store them must not break saving.
  }
}
