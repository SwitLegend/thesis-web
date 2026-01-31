// src/hooks/useTheme.js
import { useEffect, useMemo, useRef, useState } from "react";

const THEME_KEY = "pms_theme";
const SWITCH_CLASS = "theme-switching";

/** Must match index.css --theme-dur */
const DUR_MS = 240;

function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }

  try {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    return prefersDark ? "dark" : "light";
  } catch {
    return "light";
  }
}

function getAppliedTheme() {
  const t = document.documentElement.dataset.theme;
  return t === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const root = document.documentElement;

  // Support BOTH selectors
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");

  // Native controls
  root.style.colorScheme = theme;

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

/**
 * Flicker-free switch:
 * 1) add .theme-switching to arm opacity transitions
 * 2) force style flush
 * 3) apply theme in next frame
 * 4) remove class after duration
 */
function startSwitch(nextTheme) {
  const root = document.documentElement;
  if (getAppliedTheme() === nextTheme) return;

  root.classList.add(SWITCH_CLASS);

  // Force style flush
  // eslint-disable-next-line no-unused-expressions
  root.offsetHeight;

  requestAnimationFrame(() => {
    applyTheme(nextTheme);

    window.clearTimeout(startSwitch._t);
    startSwitch._t = window.setTimeout(() => {
      root.classList.remove(SWITCH_CLASS);
    }, DUR_MS);
  });
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => getInitialTheme());
  const mounted = useRef(false);

  // Apply on mount (no animation)
  useEffect(() => {
    applyTheme(theme);
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep DOM synced
  useEffect(() => {
    if (!mounted.current) return;
    if (getAppliedTheme() === theme) return;
    applyTheme(theme);
  }, [theme]);

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== THEME_KEY) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        startSwitch(e.newValue);
        setThemeState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = (next) => {
    const nextTheme = typeof next === "function" ? next(theme) : next;
    if (nextTheme !== "light" && nextTheme !== "dark") return;

    startSwitch(nextTheme);
    setThemeState(nextTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    startSwitch(nextTheme);
    setThemeState(nextTheme);
  };

  return useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);
}
