"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";

export function TransferDecision({ transferId }: { transferId: string }) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const decide = (action: "accept" | "decline") =>
    run(`/api/transfers/${transferId}`, { method: "POST", body: JSON.stringify({ action }) }).then(() => router.refresh());
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("decline")}>Decline</Button>
      <Button size="sm" disabled={pending} onClick={() => decide("accept")}>Accept programme</Button>
    </div>
  );
}
