"use client";

import { FlaskConical, Globe, LogOut, Monitor, Moon, Rows3, Settings, Sun, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { demoControls, loadDemoControls, saveDemoControls, type DemoControls } from "@/lib/api/client";
import { useSession } from "@/lib/session-context";
import { usePreferences, type Density, type ThemePreference } from "@/lib/preferences";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { Avatar } from "@/components/entities/identity";

export function UserMenu() {
  const { session, workspace, signOut } = useSession();
  const { theme, density, locale, setPreference } = usePreferences();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isId = locale === "id";
  const [demo, setDemo] = React.useState<DemoControls>(demoControls);

  React.useEffect(() => {
    setDemo({ ...loadDemoControls() });
  }, []);

  const updateDemo = (next: Partial<DemoControls>) => {
    saveDemoControls(next);
    setDemo({ ...demoControls });
    queryClient.invalidateQueries();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus" aria-label={`Account menu for ${session.name}`}>
        <Avatar name={session.name} />
        <span className="hidden min-w-0 flex-col text-left leading-tight xl:flex">
          <span className="max-w-36 truncate text-[0.8125rem] font-semibold text-fg">{session.name}</span>
          <span className="text-[0.6875rem] font-semibold text-fg-tertiary">{ROLE_LABELS[session.role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <div className="flex items-start gap-3 px-2 py-2.5">
          <Avatar name={session.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate body-sm font-semibold">{session.name}</p>
            <p className="truncate caption">{session.email}</p>
            <p className="mt-0.5 caption">
              {ROLE_LABELS[session.role]} · {workspace.name} {workspace.environment}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<UserRound />} onSelect={() => router.push("/administration/settings/personal")}>
          {isId ? "Preferensi pribadi" : "Personal preferences"}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Settings />} onSelect={() => router.push("/administration/settings")}>
          {isId ? "Pengaturan" : "Settings"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{isId ? "Bahasa" : "Language"}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setPreference("locale", v as Locale)}>
          <DropdownMenuRadioItem value="en">
            English
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="id">
            Bahasa Indonesia
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{isId ? "Tema" : "Theme"}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setPreference("theme", v as ThemePreference)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4 text-fg-tertiary" aria-hidden /> {isId ? "Terang" : "Light"}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4 text-fg-tertiary" aria-hidden /> {isId ? "Gelap" : "Dark"}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4 text-fg-tertiary" aria-hidden /> {isId ? "Ikuti sistem" : "Match system"}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuLabel>{isId ? "Kerapatan tabel" : "Table density"}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density} onValueChange={(v) => setPreference("density", v as Density)}>
          <DropdownMenuRadioItem value="comfortable">
            <Rows3 className="size-4 text-fg-tertiary" aria-hidden /> {isId ? "Nyaman" : "Comfortable"}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">
            <Rows3 className="size-4 text-fg-tertiary" aria-hidden /> {isId ? "Padat" : "Compact"}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <span className="inline-flex items-center gap-1">
            <FlaskConical className="size-3" aria-hidden /> {isId ? "Kontrol demo" : "Demo controls"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={demo.latency === "slow"} onCheckedChange={(c) => updateDemo({ latency: c ? "slow" : "normal" })} onSelect={(e) => e.preventDefault()}>
          {isId ? "Jaringan lambat" : "Slow network"}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={demo.failReads} onCheckedChange={(c) => updateDemo({ failReads: c === true })} onSelect={(e) => e.preventDefault()}>
          {isId ? "Gagal membaca" : "Fail reads"}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={demo.failWrites} onCheckedChange={(c) => updateDemo({ failWrites: c === true })} onSelect={(e) => e.preventDefault()}>
          {isId ? "Gagal menulis" : "Fail writes"}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 caption">
          {isId ? `Masuk via ${session.idp}. Sesi berakhir ${formatDateTime(session.expiresAt)}.` : `Signed in via ${session.idp}. Session expires ${formatDateTime(session.expiresAt)}.`}
        </div>
        <DropdownMenuItem icon={<LogOut />} onSelect={() => signOut("user")}>
          {isId ? "Keluar" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
