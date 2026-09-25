import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Button (DS-004). One primary action per surface; labels are action-specific
 * ("Run forecast", never "Continue"). Buttons never wrap.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-active",
        secondary: "border border-border-strong bg-surface text-fg shadow-sm hover:bg-hover active:bg-muted",
        ghost: "text-fg-secondary hover:bg-hover hover:text-fg active:bg-muted",
        danger: "bg-critical text-white hover:brightness-95 active:brightness-90",
        "danger-outline": "border border-critical/40 bg-surface text-critical-fg hover:bg-critical-subtle",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-[var(--control-h-sm)] px-3 text-[0.8125rem]",
        md: "h-[var(--control-h-md)] px-3.5 text-sm",
        lg: "h-[var(--control-h-lg)] px-4 text-sm",
        icon: "size-[var(--control-h-md)] p-0",
        "icon-sm": "size-[var(--control-h-sm)] p-0",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    /** Text announced while loading, e.g. "Running forecast". */
    loadingText?: string;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, loadingText, children, disabled, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

export { buttonVariants };
