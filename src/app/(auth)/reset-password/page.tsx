import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Setting a new password signs out every other device on your account."
      footer={
        <Link
          href="/login"
          className="text-ink underline underline-offset-4 hover:text-accent-deep"
        >
          Back to sign in
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="critical" title="This link is incomplete">
          The reset link is missing its token. Request a new link from the{" "}
          <Link href="/forgot-password" className="underline underline-offset-4">
            forgot password
          </Link>{" "}
          page.
        </Alert>
      )}
    </AuthShell>
  );
}
