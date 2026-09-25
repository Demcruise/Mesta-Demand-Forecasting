"use client";

import * as React from "react";
import { en } from "./en";
import { id } from "./id";
import type { Locale, Translations } from "./types";
import { setFormatLocale } from "@/lib/format";

export * from "./types";

const DICTIONARIES: Record<Locale, Translations> = { en, id };

let currentActiveLocale: Locale = "en";

export function getActiveLocale(): Locale {
  return currentActiveLocale;
}

export function setActiveLocale(l: Locale) {
  currentActiveLocale = l;
  setFormatLocale(l);
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export function getTranslations(locale: Locale = getActiveLocale()): Translations {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}

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
    return {
      locale: currentActiveLocale,
      setLocale: setActiveLocale,
      t: getTranslations(currentActiveLocale),
    };
  }
  return ctx;
}
