import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s · Maison Console" },
  robots: { index: false, follow: false },
};

/**
 * Bare frame for everything under /admin.
 *
 * The authorisation guard deliberately lives one level down, in the
 * `(console)` route group, so that `/admin/no-access` — the page an
 * unauthorised user is redirected *to* — is not itself behind the guard that
 * rejected them. Putting the check here would make the redirect a loop.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
