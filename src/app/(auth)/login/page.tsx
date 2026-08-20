import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { getSessionUser } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Groovy's Auction account to bid on live lots.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in — no reason to show a login form.
  const user = await getSessionUser();
  if (user) redirect(safeRedirect(next));

  return (
    <AuthShell
      eyebrow="Registered bidders"
      title="Sign in to bid"
      description="Access your bidding activity, watchlist and settlement history."
      footer={
        <>
          New to the saleroom?{" "}
          <Link
            href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-ink underline underline-offset-4 hover:text-accent-deep"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={safeRedirect(next)} />
    </AuthShell>
  );
}
