import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-sm border border-line bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-line px-6 py-5", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-medium tracking-tight text-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-line bg-raised px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-[3px] text-[0.6875rem] font-medium uppercase tracking-[0.09em] leading-none",
  {
    variants: {
      tone: {
        neutral: "border-line-strong bg-surface text-muted",
        ink: "border-ink bg-ink text-white",
        live: "border-transparent bg-live text-white",
        accent: "border-transparent bg-accent-wash text-accent-deep",
        positive: "border-transparent bg-positive-wash text-positive",
        caution: "border-transparent bg-caution-wash text-caution",
        outline: "border-line-strong bg-transparent text-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                 */
/* -------------------------------------------------------------------------- */

export const inputClasses = cn(
  "h-11 w-full rounded-sm border border-line-strong bg-surface px-3.5 text-sm text-ink",
  "placeholder:text-faint transition-colors",
  "hover:border-ink/40 focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/25",
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-faint",
  "aria-[invalid=true]:border-live aria-[invalid=true]:ring-live/20",
);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClasses, className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputClasses, "h-auto min-h-28 py-2.5 leading-relaxed", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        inputClasses,
        "cursor-pointer appearance-none pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <svg
      aria-hidden
      viewBox="0 0 12 8"
      className="pointer-events-none absolute right-3.5 top-1/2 h-2 w-3 -translate-y-1/2 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M1 1.5 6 6.5 11 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
));
NativeSelect.displayName = "NativeSelect";

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[0.8125rem] font-medium text-ink-soft",
        className,
      )}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-live">*</span> : null}
    </label>
  );
}

export function Hint({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-xs text-faint", className)} {...props} />;
}

export function FieldError({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn("mt-1.5 text-xs font-medium text-live", className)}
    >
      {children}
    </p>
  );
}

/**
 * Label + control + message.
 *
 * A `hint` given as a plain string sits under the control; a hint given as an
 * element (a "Forgot password?" link, an "Optional" tag) rides on the label
 * row, which is where those belong. An error always replaces the hint so the
 * two never compete.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const inlineHint = hint !== undefined && typeof hint !== "string";

  return (
    <div className={className}>
      {label || inlineHint ? (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <Label htmlFor={htmlFor} required={required}>
              {label}
            </Label>
          ) : (
            <span />
          )}
          {inlineHint ? <div className="mb-1.5">{hint}</div> : null}
        </div>
      ) : null}

      {children}

      {error ? (
        <FieldError>{error}</FieldError>
      ) : !inlineHint && hint ? (
        <Hint>{hint}</Hint>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                              */
/* -------------------------------------------------------------------------- */

export function Separator({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("skeleton rounded-sm", className)}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-sm border border-dashed border-line-strong bg-raised px-8 py-16 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-4 text-faint">{icon}</div> : null}
      <p className="font-display text-xl text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-muted text-pretty">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Typography                                                                  */
/* -------------------------------------------------------------------------- */

export function Eyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("eyebrow", className)} {...props} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
        <h2 className="font-display text-3xl leading-[1.05] tracking-tight text-ink sm:text-[2.5rem] text-balance">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                                */
/* -------------------------------------------------------------------------- */

export function DescriptionList({
  items,
  className,
  columns = 2,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
  columns?: 1 | 2;
}) {
  if (items.length === 0) return null;
  return (
    <dl
      className={cn(
        "grid gap-x-8",
        columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-6 border-b border-line py-3"
        >
          <dt className="text-[0.8125rem] text-muted">{item.label}</dt>
          <dd className="text-right text-[0.8125rem] font-medium text-ink tabular">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Alert({
  tone = "neutral",
  title,
  children,
  className,
  role = "status",
}: {
  /** `critical` and `live` share a palette; the name records the intent. */
  tone?: "neutral" | "live" | "critical" | "positive" | "caution" | "accent";
  title?: string;
  children?: React.ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const tones = {
    neutral: "border-line-strong bg-raised text-ink-soft",
    live: "border-live/25 bg-live-wash text-live",
    critical: "border-live/25 bg-live-wash text-live",
    positive: "border-positive/25 bg-positive-wash text-positive",
    caution: "border-caution/25 bg-caution-wash text-caution",
    accent: "border-accent/30 bg-accent-wash text-accent-deep",
  } as const;

  return (
    <div
      role={role}
      className={cn(
        "rounded-sm border px-4 py-3 text-[0.8125rem] leading-relaxed",
        tones[tone],
        className,
      )}
    >
      {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}
