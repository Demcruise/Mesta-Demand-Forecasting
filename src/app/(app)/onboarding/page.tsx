import type { Metadata } from "next";
import { OnboardingView } from "@/features/onboarding/onboarding-view";

export const metadata: Metadata = { title: "Persiapan Ruang Kerja" };

export default function OnboardingPage() {
  return <OnboardingView />;
}
