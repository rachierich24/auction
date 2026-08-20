import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { permissionsFor, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/validation/enums";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const user = await getSessionUser();
  const role = (user?.role ?? "BIDDER") as UserRole;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <Lock className="size-5" strokeWidth={1.5} />
      </span>

      <h1 className="mt-6 font-display text-3xl tracking-tight text-ink">
        You do not have access to this section
      </h1>

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted text-pretty">
        Your account is a <strong className="text-ink">{ROLE_LABELS[role]}</strong>.{" "}
        {ROLE_DESCRIPTIONS[role]} Ask a Super Admin if you need broader access.
      </p>

      {permissionsFor(role).length > 0 ? (
        <div className="mt-8 w-full rounded-sm border border-line bg-surface p-5 text-left">
          <p className="eyebrow mb-3">What you can access</p>
          <ul className="flex flex-wrap gap-1.5">
            {permissionsFor(role).map((permission) => (
              <li
                key={permission}
                className="rounded-[2px] bg-sunken px-2 py-1 text-[0.6875rem] text-muted"
              >
                {permission}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 flex gap-2">
        <Button asChild variant="primary">
          <Link href="/admin">Back to the dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Public site</Link>
        </Button>
      </div>
    </div>
  );
}
