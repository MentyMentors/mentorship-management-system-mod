"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";

/** Super Admin controls on an institution: approve/reject requests, suspend. */
export function InstitutionPlatformActions({
  institutionId,
  status,
  verificationStatus,
  requester,
  note,
}: {
  institutionId: string;
  status: string;
  verificationStatus: string;
  requester: { name: string; email: string } | null;
  note: string | null;
}) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const act = (action: string) =>
    run(`/api/institutions/${institutionId}`, { method: "POST", body: JSON.stringify({ action }) }).then(() => router.refresh());
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Menty administration</CardTitle>
        <CardDescription>
          {requester ? `Requested by ${requester.name} (${requester.email}).` : "Created by Menty."}
          {note ? ` “${note}”` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {status === "PENDING_VERIFICATION" && verificationStatus !== "REJECTED" && (
          <>
            <Button disabled={pending} onClick={() => act("approve")}>Approve</Button>
            <Button variant="outline" disabled={pending} onClick={() => act("reject")}>Decline</Button>
          </>
        )}
        {status === "ACTIVE" && (
          <ConfirmDialog
            trigger={<Button variant="destructive" disabled={pending}>Suspend institution</Button>}
            title="Suspend this institution?"
            description="Its administrators lose access until reactivated. Programmes and participants are untouched."
            confirmLabel="Suspend"
            onConfirm={() => act("suspend")}
          />
        )}
        {status === "SUSPENDED" && <Button disabled={pending} onClick={() => act("reactivate")}>Reactivate</Button>}
      </CardContent>
    </Card>
  );
}
