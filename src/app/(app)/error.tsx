"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer, Panel } from "@/components/page/page";
import { ErrorState } from "@/components/feedback/states";

/** Route-level recovery: what failed, why, and how to recover (STATE-ERROR-001). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer width="narrow">
      <Panel>
        <ErrorState
          what="This page failed to display."
          error={error}
          onRetry={reset}
          retryLabel="Try again"
          recovery={
            <Link href="/overview" className={buttonVariants({ variant: "ghost" })}>
              Go to overview
            </Link>
          }
        />
        {error.digest && <p className="pb-4 text-center caption">Reference: <span className="mono-id">{error.digest}</span></p>}
      </Panel>
    </PageContainer>
  );
}
