"use client";

import * as React from "react";
import { getTranslations, setActiveLocale, type Locale } from "./i18n/core";
import { I18nContext } from "./i18n";

/**
 * Per-viewer conveniences (theme, table density, language). Stored in localStorage and
 * wrapped in try/catch: the app renders correctly when storage is unavailable.
 */

export type ThemePreference = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

type Preferences = {
  theme: ThemePreference;
  density: Density;
  sidebarCollapsed: boolean;
  locale: Locale;
};

const KEY = "mdf.preferences";
const DEFAULTS: Preferences = { theme: "system", density: "comfortable", sidebarCollapsed: false, locale: "en" };

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function applyTheme(theme: ThemePreference) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

type Ctx = Preferences & { setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void };

const PreferencesContext = React.createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState<Preferences>(DEFAULTS);

  React.useEffect(() => {
    const p = load();
    setPrefs(p);
    applyTheme(p.theme);
    setActiveLocale(p.locale);
  }, []);

  React.useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs.theme]);

  const setPreference = React.useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Non-critical.
      }
      if (key === "theme") applyTheme(value as ThemePreference);
      if (key === "locale") setActiveLocale(value as Locale);
      return next;
    });
  }, []);

  const value = React.useMemo(() => ({ ...prefs, setPreference }), [prefs, setPreference]);
  const i18nValue = React.useMemo(
    () => ({
      locale: prefs.locale,
      setLocale: (l: Locale) => setPreference("locale", l),
      t: getTranslations(prefs.locale),
    }),
    [prefs.locale, setPreference],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <I18nContext.Provider value={i18nValue}>
        {/*
         * pick()/localized() read a module global rather than the context, so components
         * that only call them never subscribe and would keep the old language. Remounting
         * the subtree on locale change re-evaluates every literal at once — cheap because
         * switching language is rare.
         */}
        <React.Fragment key={prefs.locale}>{children}</React.Fragment>
      </I18nContext.Provider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const v = React.useContext(PreferencesContext);
  if (!v) throw new Error("usePreferences must be used inside PreferencesProvider");
  return v;
}

/** Inline script for <head>: applies the theme before first paint to avoid a flash. */
export const THEME_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem('${KEY}')||'{}');var t=p.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
