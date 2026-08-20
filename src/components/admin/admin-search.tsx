"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gavel, Search, User } from "lucide-react";

import { runAdminSearch } from "@/app/actions/admin/search";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Results = {
  auctions: { id: string; lotNumber: string; title: string; status: string }[];
  users: { id: string; name: string; email: string; role: string }[];
};

const EMPTY: Results = { auctions: [], users: [] };

/**
 * Console-wide search. Debounced, keyboard-first, and scoped by the same
 * permission checks as the pages it links to — the server action re-authorises
 * every query rather than trusting that the palette was reachable.
 */
export function AdminSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Results>(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY);
      setCursor(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Debounced so typing does not fire a query per keystroke.
    const timer = setTimeout(async () => {
      const next = await runAdminSearch(query);
      if (cancelled) return;
      setResults(next);
      setCursor(0);
      setLoading(false);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const flat = React.useMemo(
    () => [
      ...results.auctions.map((a) => ({
        key: `auction-${a.id}`,
        href: `/admin/auctions/${a.id}`,
        primary: a.title,
        secondary: `Lot ${a.lotNumber} · ${a.status.toLowerCase()}`,
        icon: <Gavel className="size-3.5" />,
      })),
      ...results.users.map((u) => ({
        key: `user-${u.id}`,
        href: `/admin/users/${u.id}`,
        primary: u.name,
        secondary: `${u.email} · ${u.role.replace(/_/g, " ").toLowerCase()}`,
        icon: <User className="size-3.5" />,
      })),
    ],
    [results],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    }
    if (event.key === "Enter" && flat[cursor]) {
      event.preventDefault();
      onOpenChange(false);
      router.push(flat[cursor].href);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="top-[12%] translate-y-0 p-0">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search className="size-4 shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search lots by title or number, bidders by name or email…"
            aria-label="Search the console"
            className="w-full bg-transparent text-[0.875rem] text-ink outline-none placeholder:text-faint"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-[0.8125rem] text-faint">
              Type at least two characters to search.
            </p>
          ) : loading ? (
            <p className="px-3 py-6 text-center text-[0.8125rem] text-faint">
              Searching…
            </p>
          ) : flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-[0.8125rem] text-faint">
              Nothing matches “{query}”.
            </p>
          ) : (
            <ul>
              {flat.map((item, index) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onPointerEnter={() => setCursor(index)}
                    onClick={() => {
                      onOpenChange(false);
                      router.push(item.href);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors",
                      index === cursor ? "bg-sunken" : "hover:bg-raised",
                    )}
                  >
                    <span className="shrink-0 text-faint">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] text-ink">
                        {item.primary}
                      </span>
                      <span className="block truncate text-[0.75rem] text-faint">
                        {item.secondary}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-raised px-4 py-2.5 text-[0.6875rem] text-faint">
          <span>↑↓ to navigate</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
