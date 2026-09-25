"use client";

import { Fingerprint, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Suspense } from "react";
import { DEMO_IDENTITIES, findUser, ORGANIZATION, userByEmail } from "@/lib/mock/directory";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/entities/identity";

/**
 * Simulated external identity provider. Clearly labelled as a demo; in production this
 * page is the organisation's IdP (OIDC/SAML), not part of Mesta.
 */
function DemoIdp() {
  const router = useRouter();
  const params = useSearchParams();
  const hint = params.get("login_hint") ?? "";
  const state = params.get("state") ?? "";
  const hinted = userByEmail(hint);
  const [selected, setSelected] = React.useState<string>(hinted?.id ?? "");
  const [phase, setPhase] = React.useState<"choose" | "mfa" | "verifying">("choose");

  const identities = DEMO_IDENTITIES.map((id) => findUser(id)).filter((u) => !!u);

  const approve = () => {
    setPhase("verifying");
    setTimeout(() => {
      const q = new URLSearchParams({ code: `demo_${selected}`, state });
      router.replace(`/auth/callback?${q.toString()}`);
    }, 700);
  };

  return (
    <div className="flex min-h-dvh items-start justify-center bg-[#eef0f3] px-4 pt-[10vh] text-[#1d2330] dark:bg-[#11151b] dark:text-[#e6e9ee]">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200" role="note">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Penyedia identitas demo. IdP asli Anda akan menggantikan layar ini.
        </div>
        <div className="rounded-lg border border-black/10 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#1a2029]">
          <p className="text-xs font-bold uppercase tracking-wider text-[#5b6472] dark:text-[#9aa3b0]">{ORGANIZATION.idp}</p>
          {phase === "choose" && (
            <>
              <h1 className="mt-2 text-xl font-bold">Pilih akun</h1>
              <p className="mt-1 text-sm text-[#5b6472] dark:text-[#9aa3b0]">untuk melanjutkan ke Mesta Demand Forecasting</p>
              <ul className="mt-5 flex flex-col gap-1.5" role="radiogroup" aria-label="Akun demo">
                {identities.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected === u.id}
                      onClick={() => setSelected(u.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#34528f]",
                        selected === u.id ? "border-[#34528f] bg-[#eef2f9] dark:bg-[#1c2c48]" : "border-transparent hover:bg-black/5 dark:hover:bg-white/5",
                      )}
                    >
                      <Avatar name={u.name} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{u.name}</span>
                        <span className="truncate text-xs text-[#5b6472] dark:text-[#9aa3b0]">{u.email}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[#5b6472] dark:text-[#9aa3b0]">
                        {u.status === "suspended" ? "Nonaktif" : ROLE_LABELS[u.role]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="primary" size="lg" className="mt-5 w-full" disabled={!selected} onClick={() => setPhase("mfa")}>
                Masuk sebagai {findUser(selected)?.name.split(" ")[0] ?? "akun terpilih"}
              </Button>
            </>
          )}
          {(phase === "mfa" || phase === "verifying") && (
            <>
              <h1 className="mt-2 text-xl font-bold">Verifikasi identitas Anda</h1>
              <p className="mt-1 text-sm text-[#5b6472] dark:text-[#9aa3b0]">Setujui permintaan masuk di aplikasi autentikator Anda.</p>
              <div className="mt-6 flex flex-col items-center gap-3 rounded-md border border-black/10 p-6 dark:border-white/10">
                <Fingerprint className="size-10 text-[#34528f]" aria-hidden />
                <p className="text-center text-sm">
                  Permintaan dikirim ke perangkat terdaftar <strong>{findUser(selected)?.name}</strong>.
                </p>
                <p className="text-xs text-[#5b6472] dark:text-[#9aa3b0]">Nomor yang harus cocok: 42</p>
              </div>
              <Button variant="primary" size="lg" className="mt-5 w-full" onClick={approve} loading={phase === "verifying"} loadingText="Memverifikasi">
                <ShieldCheck aria-hidden />
                Saya sudah menyetujuinya
              </Button>
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setPhase("choose")} disabled={phase === "verifying"}>
                Pilih akun lain
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DemoIdpPage() {
  return (
    <Suspense>
      <DemoIdp />
    </Suspense>
  );
}
