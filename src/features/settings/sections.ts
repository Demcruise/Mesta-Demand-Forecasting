/** Settings section keys. Shared by the server route (validation) and the client view. */
export const SETTINGS_SECTIONS = ["personal", "notifications", "workspace", "forecasting", "data", "approvals", "roles", "audit", "security", "api"] as const;

export type SectionKey = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string): value is SectionKey {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}
