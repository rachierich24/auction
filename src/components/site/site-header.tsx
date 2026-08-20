import Link from "next/link";

import { getSessionUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/validation/enums";
import { unreadCount } from "@/lib/notifications/service";
import { getContent } from "@/lib/content/site-content";
import { HeaderNav } from "@/components/site/header-nav";

/**
 * Server component: resolves the viewer once and hands the interactive shell
 * (mobile drawer, account menu) to a small client island.
 */
export async function SiteHeader() {
  const user = await getSessionUser();
  const [notifications, announcement] = await Promise.all([
    user ? unreadCount(user.id) : Promise.resolve(0),
    getContent("announcement"),
  ]);

  return (
    <>
      {announcement.enabled && announcement.message ? (
        <div className="bg-ink text-white">
          <div className="gutter mx-auto flex max-w-[110rem] items-center justify-center gap-3 py-2 text-center text-[0.75rem] tracking-wide">
            <span className="inline-block size-1.5 shrink-0 rounded-full bg-accent" />
            {announcement.href ? (
              <Link
                href={announcement.href}
                className="underline-offset-4 hover:underline"
              >
                {announcement.message}
              </Link>
            ) : (
              <span>{announcement.message}</span>
            )}
          </div>
        </div>
      ) : null}

      <HeaderNav
        user={
          user
            ? {
                name: user.name,
                email: user.email,
                isAdmin: isAdminRole(user.role),
              }
            : null
        }
        unread={notifications}
      />
    </>
  );
}
