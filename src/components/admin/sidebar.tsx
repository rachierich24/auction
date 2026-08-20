"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  FileText,
  Gavel,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
import type { Permission } from "@/lib/auth/rbac";
import { cn, initials } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  permission: Permission;
  exact?: boolean;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: <LayoutDashboard className="size-4" />,
        permission: "admin.access",
        exact: true,
      },
      {
        href: "/admin/analytics",
        label: "Analytics",
        icon: <BarChart3 className="size-4" />,
        permission: "analytics.view",
      },
    ],
  },
  {
    group: "Saleroom",
    items: [
      {
        href: "/admin/auctions",
        label: "Auctions",
        icon: <Gavel className="size-4" />,
        permission: "auction.view",
      },
      {
        href: "/admin/bids",
        label: "Bids",
        icon: <ScrollText className="size-4" />,
        permission: "bid.view",
      },
      {
        href: "/admin/settlements",
        label: "Settlements",
        icon: <Receipt className="size-4" />,
        permission: "settlement.manage",
      },
      {
        href: "/admin/categories",
        label: "Departments",
        icon: <ListTree className="size-4" />,
        permission: "category.manage",
      },
    ],
  },
  {
    group: "People & content",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: <Users className="size-4" />,
        permission: "user.view",
      },
      {
        href: "/admin/content",
        label: "Site content",
        icon: <FileText className="size-4" />,
        permission: "content.manage",
      },
      {
        href: "/admin/audit",
        label: "Audit log",
        icon: <ShieldCheck className="size-4" />,
        permission: "audit.view",
      },
    ],
  },
];

export function AdminSidebar({
  user,
  permissions,
  unread,
}: {
  user: { name: string; email: string; role: string; roleLabel: string };
  permissions: Permission[];
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  // ⌘K / Ctrl-K opens global search, as an operations console should.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allowed = React.useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => permissions.includes(item.permission)),
      })).filter((group) => group.items.length > 0),
    [permissions],
  );

  const nav = (
    <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6" aria-label="Console">
      {allowed.map((group) => (
        <div key={group.group}>
          <p className="px-3 pb-2 text-[0.625rem] uppercase tracking-[0.14em] text-console-muted/70">
            {group.group}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-sm px-3 py-2 text-[0.8125rem] transition-colors",
                      active
                        ? "bg-console-raised text-console-ink"
                        : "text-console-muted hover:bg-console-raised/60 hover:text-console-ink",
                    )}
                  >
                    <span className={cn(active && "text-accent-soft")}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-console-line bg-console px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          className="text-console-ink"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link href="/admin" className="font-display text-lg text-console-ink">
          Maison
          <span className="ml-1.5 align-super text-[0.5rem] uppercase tracking-[0.2em] text-accent-soft">
            Console
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="ml-auto text-console-muted"
        >
          <Search className="size-4" />
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-console shadow-console transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-console-line px-6">
          <Link href="/admin" className="font-display text-xl text-console-ink">
            Maison
            <span className="ml-1.5 align-super text-[0.5rem] uppercase tracking-[0.2em] text-accent-soft">
              Console
            </span>
          </Link>
        </div>

        <div className="px-3 pt-4">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-sm border border-console-line bg-console-raised/60 px-3 py-2 text-[0.8125rem] text-console-muted transition-colors hover:border-console-muted/40"
          >
            <Search className="size-3.5" />
            Search lots, bidders…
            <kbd className="ml-auto rounded-[3px] border border-console-line px-1.5 py-0.5 text-[0.625rem] text-console-muted/70">
              ⌘K
            </kbd>
          </button>
        </div>

        {nav}

        <div className="shrink-0 border-t border-console-line p-3">
          <Link
            href="/notifications"
            className="mb-1 flex items-center gap-3 rounded-sm px-3 py-2 text-[0.8125rem] text-console-muted transition-colors hover:bg-console-raised/60 hover:text-console-ink"
          >
            <Bell className="size-4" />
            Notifications
            {unread > 0 ? (
              <span className="ml-auto rounded-full bg-live px-1.5 py-0.5 text-[0.625rem] font-semibold text-white tabular">
                {unread}
              </span>
            ) : null}
          </Link>

          <div className="flex items-center gap-3 rounded-sm px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[0.6875rem] font-semibold text-white">
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] text-console-ink">
                {user.name}
              </p>
              <p className="truncate text-[0.6875rem] text-console-muted">
                {user.roleLabel}
              </p>
            </div>
          </div>

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-[0.8125rem] text-console-muted transition-colors hover:bg-console-raised/60 hover:text-console-ink"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
        />
      ) : null}

      <AdminSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
