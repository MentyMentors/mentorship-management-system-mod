"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function AcceptInviteForm({ token, needsAccount }: { token: string; needsAccount: boolean }) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await run<{ destination: string; createdAccount: boolean }>(`/api/invites/${token}`, {
          method: "POST",
          body: JSON.stringify(needsAccount ? { name, password } : {}),
        });
        router.push(result.createdAccount ? `/login?callbackUrl=${encodeURIComponent(result.destination)}` : result.destination);
        router.refresh();
      }}
    >
      {needsAccount && (
        <>
          <div className="space-y-1.5">
            <Label>Your name</Label>
            <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Choose a password</Label>
            <PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
          </div>
        </>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {needsAccount ? "Create account and accept" : "Accept invitation"}
      </Button>
    </form>
  );
}
