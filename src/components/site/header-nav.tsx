"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, ShieldCheck, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, initials } from "@/lib/utils";

const LINKS = [
  { href: "/auctions", label: "Auctions" },
  { href: "/auctions?status=live", label: "Live Now" },
  { href: "/auctions?status=upcoming", label: "Upcoming" },
  { href: "/how-it-works", label: "How It Works" },
];

export function HeaderNav({
  user,
  unread,
}: {
  user: { name: string; email: string; isAdmin: boolean } | null;
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer whenever navigation completes.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-canvas/85 backdrop-blur-md transition-colors duration-300",
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      <div className="gutter mx-auto flex h-16 max-w-[110rem] items-center gap-6 md:h-20">
        <Link
          href="/"
          className="shrink-0 font-display text-[1.375rem] leading-none tracking-tight text-ink"
        >
          Groovy
          <span className="ml-1.5 align-super text-[0.5rem] uppercase tracking-[0.22em] text-accent">
            Auction
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {LINKS.map((link) => {
            const active =
              pathname === link.href.split("?")[0] &&
              (link.href.includes("?")
                ? false
                : pathname === link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative py-1 text-[0.8125rem] tracking-wide transition-colors",
                  "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300",
                  "hover:text-ink hover:after:scale-x-100",
                  active ? "text-ink after:scale-x-100" : "text-muted",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/auctions"
            aria-label="Search the catalogue"
            className="hidden size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-sunken hover:text-ink sm:inline-flex"
          >
            <Search className="size-4" />
          </Link>

          {user ? (
            <>
              <Link
                href="/notifications"
                aria-label={
                  unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
                }
                className="relative inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <Bell className="size-4" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex min-w-[1.05rem] items-center justify-center rounded-full bg-live px-1 text-[0.5625rem] font-semibold leading-[1.05rem] text-white tabular">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>

              {user.isAdmin ? (
                <Link
                  href="/admin"
                  aria-label="Admin console"
                  className="hidden size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-sunken hover:text-ink sm:inline-flex"
                >
                  <ShieldCheck className="size-4" />
                </Link>
              ) : null}

              <Link
                href="/profile"
                className="ml-1 hidden items-center gap-2.5 rounded-sm border border-line-strong bg-surface py-1.5 pl-1.5 pr-3.5 transition-colors hover:border-ink sm:inline-flex"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-ink text-[0.625rem] font-semibold text-white">
                  {initials(user.name)}
                </span>
                <span className="max-w-28 truncate text-[0.8125rem] text-ink">
                  {user.name.split(" ")[0]}
                </span>
              </Link>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="quiet" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/register">Register to bid</Link>
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-9 items-center justify-center rounded-sm text-ink transition-colors hover:bg-sunken lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line bg-canvas lg:hidden">
          <nav className="gutter mx-auto max-w-[110rem] py-4" aria-label="Mobile">
            <ul className="divide-y divide-line">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-3.5 font-display text-lg text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {user ? (
                <>
                  <li>
                    <Link href="/profile" className="block py-3.5 font-display text-lg text-ink">
                      My account
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/notifications"
                      className="flex items-center justify-between py-3.5 font-display text-lg text-ink"
                    >
                      Notifications
                      {unread > 0 ? (
                        <span className="rounded-full bg-live px-2 py-0.5 text-[0.625rem] font-semibold text-white tabular">
                          {unread}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                  {user.isAdmin ? (
                    <li>
                      <Link href="/admin" className="block py-3.5 font-display text-lg text-ink">
                        Admin console
                      </Link>
                    </li>
                  ) : null}
                </>
              ) : null}
            </ul>

            {!user ? (
              <div className="mt-5 flex flex-col gap-2">
                <Button asChild variant="primary" size="md">
                  <Link href="/register">Register to bid</Link>
                </Button>
                <Button asChild variant="outline" size="md">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            ) : (
              <form action="/api/auth/logout" method="post" className="mt-5">
                <Button type="submit" variant="outline" size="md" className="w-full">
                  Sign out
                </Button>
              </form>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function AccountAvatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-ink text-[0.6875rem] font-semibold text-white">
      <User className="size-3.5" aria-hidden />
      <span className="sr-only">{name}</span>
    </span>
  );
}
