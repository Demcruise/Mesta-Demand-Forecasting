/**
 * Server-safe pieces of the preferences layer. Kept free of "use client" so the
 * root layout can inject THEME_BOOTSTRAP into <head> — a client-module export
 * would arrive as an opaque reference and the script would never run.
 */

export const PREFERENCES_KEY = "mdf.preferences";

/** Inline script for <head>: applies theme + language before first paint to avoid a flash. */
export const THEME_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem('${PREFERENCES_KEY}')||'{}');var t=p.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');document.documentElement.lang=p.locale==='id'?'id':'en';}catch(e){}})();`;
