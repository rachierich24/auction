"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * From/to filter that writes to the URL, matching how every other admin filter
 * behaves. Deliberately not a `<form>`: it is rendered inside the filter bar,
 * which already is one, and nested forms are invalid.
 */
export function DateRangeFilter({
  fromKey = "from",
  toKey = "to",
}: {
  fromKey?: string;
  toKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = React.useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <>
      {[
        { key: fromKey, label: "From" },
        { key: toKey, label: "To" },
      ].map((field) => (
        <div key={field.key} className="min-w-36">
          <label
            htmlFor={`filter-${field.key}`}
            className="mb-1.5 block text-[0.6875rem] uppercase tracking-[0.08em] text-faint"
          >
            {field.label}
          </label>
          <input
            id={`filter-${field.key}`}
            type="date"
            value={params.get(field.key) ?? ""}
            onChange={(event) => update(field.key, event.target.value)}
            className="h-10 w-full rounded-sm border border-line-strong bg-surface px-3 text-[0.8125rem] text-ink outline-none transition-colors focus:border-ink"
          />
        </div>
      ))}
    </>
  );
}
