"use client";

import { ChevronRight, LogOut, Monitor, Moon, Settings, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { usePreferences, type ThemePreference } from "@/lib/preferences";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Locale } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlay";
import { Avatar } from "@/components/entities/identity";
import { pick } from "@/lib/i18n";

/**
 * Account menu (v5 PROFILE-001…011). Answers three questions only — who am I, what
 * account actions can I take, how do I leave:
 *   identity → Personal preferences / Settings → Language → Theme → Sign out.
 * Demo controls and session diagnostics live in Settings, not here.
 */
export function UserMenu() {
  const { session, workspace, signOut } = useSession();
  const { theme, locale, setPreference } = usePreferences();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-md p-1 hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus data-[state=open]:bg-hover"
        aria-label={pick(`Menu akun ${session.name}`, `Account menu for ${session.name}`)}
      >
        <Avatar name={session.name} />
        <span className="hidden min-w-0 flex-col text-left leading-tight xl:flex">
          <span className="max-w-36 truncate text-[0.8125rem] font-semibold text-fg">{session.name}</span>
          <span className="text-[0.6875rem] font-semibold text-fg-tertiary">{ROLE_LABELS[session.role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(18rem,calc(100vw-1rem))]" collisionPadding={8}>
        {/* Identity: name, email, role · workspace. No environment, IdP or expiry (PROFILE-011). */}
        <div className="flex items-center gap-3 px-2 py-3">
          <Avatar name={session.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate body-sm font-semibold text-fg">{session.name}</p>
            <p className="truncate caption">{session.email}</p>
            <p className="mt-0.5 truncate caption">
              {ROLE_LABELS[session.role]} · {workspace.name}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-9" icon={<UserRound />} onSelect={() => router.push("/administration/settings/personal")}>
          <span className="flex items-center justify-between">
            {pick("Preferensi pribadi", "Personal preferences")}
            <ChevronRight className="size-3.5 text-fg-tertiary" aria-hidden />
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="h-9" icon={<Settings />} onSelect={() => router.push("/administration/settings")}>
          <span className="flex items-center justify-between">
            {pick("Pengaturan", "Settings")}
            <ChevronRight className="size-3.5 text-fg-tertiary" aria-hidden />
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{pick("Bahasa", "Language")}</DropdownMenuLabel>
        {/* Language names are never translated (§12). */}
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setPreference("locale", v as Locale)}>
          <DropdownMenuRadioItem value="en" lang="en">
            English
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="id" lang="id">
            Bahasa Indonesia
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{pick("Tema", "Theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setPreference("theme", v as ThemePreference)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4 text-fg-tertiary" aria-hidden /> {pick("Terang", "Light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4 text-fg-tertiary" aria-hidden /> {pick("Gelap", "Dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4 text-fg-tertiary" aria-hidden /> {pick("Ikuti sistem", "Match system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* Sign out is a low-consequence account action: neutral, no confirmation (PROFILE-007/008). */}
        <DropdownMenuItem className="h-9" icon={<LogOut />} onSelect={() => signOut("user")}>
          {pick("Keluar", "Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
