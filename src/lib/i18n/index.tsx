"use client";

import * as React from "react";
import type { Locale, Translations } from "./types";
import {
  getActiveLocale,
  getTranslations,
  setActiveLocale,
} from "./core";

export * from "./types";
export {
  getActiveLocale,
  getTranslations,
  localized,
  localizedRecord,
  pick,
  setActiveLocale,
} from "./core";

export type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
};

export const I18nContext = React.createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for components outside provider
    const l = getActiveLocale();
    return {
      locale: l,
      setLocale: setActiveLocale,
      t: getTranslations(l),
    };
  }
  return ctx;
}
