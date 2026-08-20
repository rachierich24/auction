import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Register to bid",
  description:
    "Create a Groovy's Auction account. Registration is free and takes under a minute.",
  alternates: { canonical: "/register" },
};

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/profile");

  return (
    <AuthShell
      eyebrow="Registration"
      title="Register to bid"
      description="Free to join. You will be able to bid, set maximums and follow lots the moment your account is created."
      footer={
        <>
          Already registered?{" "}
          <Link
            href="/login"
            className="text-ink underline underline-offset-4 hover:text-accent-deep"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
