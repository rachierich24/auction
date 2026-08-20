"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { markAllNotificationsRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function NotificationActions() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsRead();
          if (result.ok) {
            toast.success(
              result.count === 1
                ? "1 notification marked as read."
                : `${result.count} notifications marked as read.`,
            );
            router.refresh();
          } else {
            toast.error("Could not update notifications.");
          }
        })
      }
    >
      {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
