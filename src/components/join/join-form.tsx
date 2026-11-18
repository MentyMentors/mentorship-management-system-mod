"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JOIN_ROLE_LABEL, type JoinRole } from "@/lib/join-rules";

export function JoinForm({
  slug,
  roles,
  initialRole,
  reviewMessage,
}: {
  slug: string;
  roles: JoinRole[];
  initialRole?: JoinRole;
  reviewMessage?: string;
}) {
  const { run, pending } = useApiAction();
  const [role, setRole] = useState<JoinRole>(initialRole && roles.includes(initialRole) ? initialRole : roles[0]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ status: string; programId: string } | null>(null);

  if (result) {
    const active = result.status === "ACTIVE";
    return (
      <div className="space-y-3 text-center">
        {active ? <CheckCircle2 className="mx-auto h-10 w-10 text-success" /> : <Clock className="mx-auto h-10 w-10 text-warning" />}
        <p className="font-medium">
          {active ? "You're in!" : result.status === "WAITLISTED" ? "You're on the waiting list" : "Registration received"}
        </p>
        <p className="text-sm text-muted-foreground">
          {active
            ? "Your programme is now on your dashboard."
            : result.status === "WAITLISTED"
              ? "The programme is full. We'll email you if a place opens."
              : "The programme team will review it. We've emailed you a confirmation."}
        </p>
        <Button asChild><Link href={`/dashboard/programs/${result.programId}`}>Open my programme</Link></Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setResult(await run<{ status: string; programId: string }>("/api/join", { method: "POST", body: JSON.stringify({ slug, role, note }) }));
      }}
    >
      {roles.length > 1 && (
        <fieldset className="space-y-2">
          <Label asChild><legend>I want to join as</legend></Label>
          {roles.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${role === r ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
              {JOIN_ROLE_LABEL[r]}
            </label>
          ))}
        </fieldset>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="join-note">Anything the programme team should know? (optional)</Label>
        <Textarea id="join-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Your goals, background, what you hope to get out of it…" />
      </div>
      {reviewMessage && <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{reviewMessage}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Submit registration
      </Button>
    </form>
  );
}
