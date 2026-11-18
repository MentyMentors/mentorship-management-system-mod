"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function WithdrawButton({ membershipId, pending }: { membershipId: string; pending: boolean }) {
  const router = useRouter();
  const { run, pending: busy } = useApiAction();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="sm" disabled={busy}>{pending ? "Cancel registration" : "Leave programme"}</Button>}
      title={pending ? "Cancel your registration?" : "Leave this programme?"}
      description="You can register again later if the programme is still open."
      confirmLabel={pending ? "Cancel registration" : "Leave"}
      destructive
      onConfirm={() => run(`/api/memberships/${membershipId}`, { method: "DELETE" }).then(() => router.refresh())}
    />
  );
}
