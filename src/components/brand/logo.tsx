import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand assets. Each asset ships in two ink variants — black artwork for the light
 * theme, white for the dark theme — and the `dark` class on <html> swaps them, so the
 * logo follows the theme without JavaScript. Sizing is height-driven: the artwork is
 * wider than it is tall, so `w-auto` is always applied to keep the aspect ratio.
 */

export function MestaMark({ className }: { className?: string }) {
  return (
    <>
      <Image src="/brand/mesta-mark-black.png" alt="Mesta" width={120} height={96} className={cn("w-auto dark:hidden", className)} priority />
      <Image src="/brand/mesta-mark-white.png" alt="" width={120} height={96} aria-hidden className={cn("hidden w-auto dark:block", className)} priority />
    </>
  );
}

export function MestaWordmark({ className }: { className?: string }) {
  return (
    <>
      <Image src="/brand/mesta-logo-black.png" alt="Mesta" width={340} height={96} className={cn("w-auto dark:hidden", className)} priority />
      <Image src="/brand/mesta-logo-white.png" alt="" width={340} height={96} aria-hidden className={cn("hidden w-auto dark:block", className)} priority />
    </>
  );
}
