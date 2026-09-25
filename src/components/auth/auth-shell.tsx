import * as React from "react";
import { MestaMark } from "@/components/shell/app-sidebar";

/** AuthShell: enterprise sign-in frame. No marketing hero, no signup. */
export function AuthShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-16 items-center px-6">
        <span className="flex items-center gap-2.5">
          <MestaMark className="size-7" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-fg">Mesta</span>
            <span className="text-[0.6875rem] font-semibold text-fg-tertiary">Demand Forecasting</span>
          </span>
        </span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[8vh]">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-6 py-5 caption">
        {footer ?? (
          <>
            <span>Akses dikelola oleh penyedia identitas organisasi Anda.</span>
            <span aria-hidden>·</span>
            <span>Butuh akses? Hubungi administrator ruang kerja Anda.</span>
          </>
        )}
      </footer>
    </div>
  );
}

export function AuthCard({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <h1 className="page-title">{title}</h1>
      {description && <p className="mt-1.5 body text-fg-secondary">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
