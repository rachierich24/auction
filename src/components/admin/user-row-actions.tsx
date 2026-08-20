"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, ShieldCheck, UserCheck, UserX } from "lucide-react";

import { setUserRole, setUserStatus } from "@/app/actions/admin/users";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { UserRole, type UserRole as Role } from "@/lib/validation/enums";
import { cn } from "@/lib/utils";

export function UserRowActions({
  user,
  actorId,
  actorRole,
}: {
  user: { id: string; name: string; email: string; role: string; status: string };
  actorId: string;
  actorRole: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | {
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    run: () => Promise<{ ok: boolean; message: string }>;
  }>(null);

  const isSelf = user.id === actorId;
  const isSuperAdmin = actorRole === "SUPER_ADMIN";
  const suspended = user.status === "SUSPENDED";

  async function run(task: () => Promise<{ ok: boolean; message: string }>) {
    setPending(true);
    const result = await task();
    setPending(false);
    setConfirm(null);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error("Not applied", result.message);
    }
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Actions for ${user.name}`}
          className="inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-56 overflow-hidden rounded-sm border border-line bg-surface py-1 shadow-lift"
          >
            <DropdownMenu.Item asChild className={itemClass()}>
              <Link href={`/admin/users/${user.id}`}>
                <UserCheck className="size-3.5" />
                View account
              </Link>
            </DropdownMenu.Item>

            {isSelf ? (
              <p className="px-3 py-2 text-[0.75rem] text-faint">
                This is your own account.
              </p>
            ) : (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />

                <DropdownMenu.Item
                  className={itemClass(suspended ? undefined : "destructive")}
                  onSelect={() =>
                    setConfirm(
                      suspended
                        ? {
                            title: `Reactivate ${user.name}?`,
                            description:
                              "They will be able to sign in and bid again immediately.",
                            confirmLabel: "Reactivate",
                            run: () => setUserStatus(user.id, "ACTIVE"),
                          }
                        : {
                            title: `Suspend ${user.name}?`,
                            description: (
                              <>
                                {user.email} will be signed out of every device
                                immediately and blocked from bidding. Bids they
                                have already placed remain valid and on the
                                record.
                              </>
                            ),
                            confirmLabel: "Suspend account",
                            destructive: true,
                            run: () => setUserStatus(user.id, "SUSPENDED"),
                          },
                    )
                  }
                >
                  {suspended ? (
                    <UserCheck className="size-3.5" />
                  ) : (
                    <UserX className="size-3.5" />
                  )}
                  {suspended ? "Reactivate account" : "Suspend account"}
                </DropdownMenu.Item>

                {isSuperAdmin ? (
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className={itemClass()}>
                      <ShieldCheck className="size-3.5" />
                      Change role
                      <span className="ml-auto text-[0.6875rem] text-faint">
                        {ROLE_LABELS[user.role as Role]}
                      </span>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent
                        sideOffset={4}
                        className="z-50 min-w-52 overflow-hidden rounded-sm border border-line bg-surface py-1 shadow-lift"
                      >
                        {UserRole.options.map((role) => (
                          <DropdownMenu.Item
                            key={role}
                            className={itemClass()}
                            disabled={role === user.role}
                            onSelect={() =>
                              setConfirm({
                                title: `Make ${user.name} a ${ROLE_LABELS[role]}?`,
                                description: (
                                  <>
                                    This changes what they can do in the console
                                    and signs them out so the new permissions
                                    take effect on their next sign-in.
                                  </>
                                ),
                                confirmLabel: `Assign ${ROLE_LABELS[role]}`,
                                run: () => setUserRole({ userId: user.id, role }),
                              })
                            }
                          >
                            {ROLE_LABELS[role]}
                            {role === user.role ? (
                              <span className="ml-auto text-[0.6875rem] text-faint">
                                current
                              </span>
                            ) : null}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>
                ) : null}
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        pending={pending}
        onConfirm={() => confirm && run(confirm.run)}
      />
    </>
  );
}

function itemClass(variant?: "destructive") {
  return cn(
    "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[0.8125rem] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
    variant === "destructive"
      ? "text-live data-[highlighted]:bg-live-wash"
      : "text-ink-soft data-[highlighted]:bg-sunken data-[highlighted]:text-ink",
  );
}
