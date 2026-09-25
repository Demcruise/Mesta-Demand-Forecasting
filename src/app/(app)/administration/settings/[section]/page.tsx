import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsView } from "@/features/settings/settings-view";
import { isSettingsSection } from "@/features/settings/sections";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  return <SettingsView section={section} />;
}
