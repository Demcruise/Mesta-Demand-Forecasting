import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInFlow } from "./sign-in-flow";

export const metadata: Metadata = { title: "Masuk" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInFlow />
    </Suspense>
  );
}
