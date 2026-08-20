import Link from "next/link";

import { AdminSidebar } from "@/components/admin/sidebar";
import { requirePermission } from "@/lib/auth/guards";
import { permissionsFor, ROLE_LABELS } from "@/lib/auth/rbac";
import { unreadCount } from "@/lib/notifications/service";
import type { UserRole } from "@/lib/validation/enums";

export const dynamic = "force-dynamic";

/**
 * Admin shell.
 *
 * Authorisation happens here, once, for every route beneath /admin — a page
 * that forgets its own check is still protected. Individual pages re-assert
 * the *specific* capability they need, because "can reach the console" is not
 * the same as "may cancel a live sale".
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePermission("admin.access", "/admin");
  const unread = await unreadCount(user.id);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <AdminSidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          roleLabel: ROLE_LABELS[user.role as UserRole] ?? user.role,
        }}
        permissions={[...permissionsFor(user.role)]}
        unread={unread}
      />

      {/* pt-14 clears the fixed mobile top bar; on desktop the sidebar is in flow. */}
      <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
        <main className="flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
          {children}
        </main>

        <footer className="border-t border-line px-5 py-4 sm:px-8 lg:px-10">
          <p className="text-[0.6875rem] text-faint">
            Maison Auctions operations console ·{" "}
            <Link href="/" className="underline-offset-4 hover:text-ink hover:underline">
              View the public site
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
