"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";

export function ProgramVerifyButtons({ programId }: { programId: string }) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const act = (action: string) =>
    run(`/api/programs/${programId}/actions`, { method: "POST", body: JSON.stringify({ action }) }).then(() => router.refresh());
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => act("verify")}>Verify</Button>
      <Button variant="outline" disabled={pending} onClick={() => act("rejectVerification")}>Decline</Button>
    </div>
  );
}
