import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-white hover:bg-ink-soft active:translate-y-px shadow-[0_1px_2px_rgb(17_17_17/0.16)]",
        accent:
          "bg-accent text-white hover:bg-accent-deep active:translate-y-px shadow-[0_1px_2px_rgb(141_106_52/0.24)]",
        outline:
          "border border-line-strong bg-surface text-ink hover:border-ink hover:bg-raised",
        ghost: "text-ink hover:bg-sunken",
        quiet: "text-muted hover:text-ink",
        danger:
          "bg-live text-white hover:brightness-95 active:translate-y-px",
        link: "text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink",
      },
      size: {
        sm: "h-9 rounded-sm px-3.5 text-[0.8125rem] [&_svg]:size-4",
        md: "h-11 rounded-sm px-5 text-sm [&_svg]:size-4",
        lg: "h-13 rounded-sm px-7 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        icon: "size-9 rounded-sm [&_svg]:size-4",
        "icon-sm": "size-8 rounded-sm [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        // Buttons inside forms default to submit in HTML; being explicit avoids
        // an icon button accidentally submitting a filter form.
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
