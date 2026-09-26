import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer, Panel } from "@/components/page/page";
import { pick } from "@/lib/i18n/core";

export default function NotFound() {
  return (
    <PageContainer width="narrow">
      <Panel>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-subtle text-fg-tertiary">
            <SearchX className="size-5" aria-hidden />
          </span>
          <h1 className="section-title">{pick("Halaman ini tidak ada di ruang kerja ini.", "This page does not exist in this workspace.")}</h1>
          <p className="mt-1 max-w-md body-sm text-fg-secondary">{pick("Tautannya mungkin sudah usang, atau item ini milik ruang kerja lain. Gunakan pencarian (Ctrl K) atau kembali ke Ringkasan.", "The link may be out of date, or the item may belong to another workspace. Use search (Ctrl K) or go back to the overview.")}</p>
          <Link href="/overview" className={buttonVariants({ variant: "primary", className: "mt-4" })}>
            {pick("Ke Ringkasan", "Go to overview")}
          </Link>
        </div>
      </Panel>
    </PageContainer>
  );
}
