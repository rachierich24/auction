import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { verifyEmailAction } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Tokens are single-use and consumed here; a refresh will correctly report
  // the second attempt as already used rather than silently re-verifying.
  const result = token
    ? await verifyEmailAction(token)
    : { ok: false, message: "This confirmation link is missing its token." };

  return (
    <AuthShell
      eyebrow="Account"
      title={result.ok ? "Email confirmed" : "Confirmation failed"}
      description={
        result.ok
          ? "Your account is fully active. You can bid on any open lot."
          : "We could not confirm your address with that link."
      }
    >
      <div className="space-y-6">
        <Alert tone={result.ok ? "positive" : "critical"}>{result.message}</Alert>

        <div className="flex flex-col gap-2">
          <Button asChild variant="primary" size="lg">
            <Link href="/auctions">Browse the catalogue</Link>
          </Button>
          <Button asChild variant="outline" size="md">
            <Link href="/profile">Go to my account</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
