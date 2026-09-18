import { useEffect, useState } from "react";

export type ThemePreference = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "avsw-theme";

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function loadPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") {
    return stored;
  }
  return "system";
}

export function useTheme() {
  const [preference, setPreference] =
    useState<ThemePreference>(loadPreference);
  const [resolved, setResolved] =
    useState<ResolvedTheme>(() => resolveTheme(loadPreference()));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const nextResolved = resolveTheme(preference);
      setResolved(nextResolved);
      document.documentElement.dataset.theme = nextResolved;
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.style.colorScheme = nextResolved;
      localStorage.setItem(STORAGE_KEY, preference);
    };

    apply();

    if (preference === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    return undefined;
  }, [preference]);

  return {
    preference,
    resolved,
    setPreference,
  };
}
