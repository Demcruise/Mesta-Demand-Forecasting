import type { Metadata } from "next";
import { OnboardingView } from "@/features/onboarding/onboarding-view";

export const metadata: Metadata = { title: "Workspace Setup" };

export default function OnboardingPage() {
  return <OnboardingView />;
}
