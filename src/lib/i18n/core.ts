// Server-safe i18n primitives — no React, no "use client". Shared by components
// (via ./index) and by non-component modules (mock API, lib helpers, metadata).
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

/**
 * Inline literal translation: pick("Indonesian", "English"). Evaluated at call time,
 * so literals inside render bodies follow the active locale. Module-level calls
 * resolve once at import — keep those in functions or getters.
 */
export function pick(id: string, en: string): string {
  return currentActiveLocale === "id" ? id : en;
}

/**
 * Locale-live wrapper for module-scope constants (label maps, step lists, reason
 * lists). Property access resolves through a Proxy against the tree for the active
 * locale, so `X[key]`, `X[i].field`, `Object.entries`, `in`, spreads and iteration
 * stay correct after the locale changes. Keep the two trees structurally identical.
 */
export function localized<T>(idTree: T, enTree: T): T {
  const tree = () => (currentActiveLocale === "id" ? idTree : enTree);
  return new Proxy({} as Record<PropertyKey, unknown>, {
    get(_t, key) {
      const v = (tree() as Record<PropertyKey, unknown>)[key];
      return typeof v === "function" ? v.bind(tree()) : v;
    },
    has(_t, key) {
      return key in (tree() as Record<PropertyKey, unknown>);
    },
    ownKeys() {
      return Object.keys(tree() as Record<PropertyKey, unknown>);
    },
    getOwnPropertyDescriptor(_t, key) {
      const t = tree() as Record<PropertyKey, unknown>;
      if (!(key in t)) return undefined;
      return { value: t[key], enumerable: true, configurable: true };
    },
  }) as T;
}

/**
 * Locale-live Record for module-scope label maps. Reads resolve through a Proxy at
 * access time so `LABELS[key]`, `Object.entries`, `in` and spreads stay correct after
 * the locale changes without any re-render dependency.
 */
export function localizedRecord<K extends string>(idMap: Record<K, string>, enMap: Record<K, string>): Record<K, string> {
  return new Proxy({} as Record<K, string>, {
    get(_t, key: K) {
      return (currentActiveLocale === "id" ? idMap : enMap)[key];
    },
    has(_t, key: K) {
      return key in enMap;
    },
    ownKeys() {
      return Object.keys(enMap);
    },
    getOwnPropertyDescriptor(_t, key: K) {
      if (!(key in enMap)) return undefined;
      return {
        value: (currentActiveLocale === "id" ? idMap : enMap)[key],
        enumerable: true,
        configurable: true,
      };
    },
  });
}
