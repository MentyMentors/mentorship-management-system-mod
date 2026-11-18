"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

/** Create a Menty account. `next` brings the person back afterwards. */
export function SignupForm({ next }: { next?: string }) {
  const { run, pending } = useApiAction();
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [sent, setSent] = useState(false);
  const loginHref = next ? `/login?callbackUrl=${encodeURIComponent(next)}` : "/login";

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a link to <strong>{v.email}</strong>. Confirm your address, then log in{next ? " and you'll come straight back here" : ""}.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await run("/api/account/signup", { method: "POST", body: JSON.stringify({ ...v, next }) });
        setSent(true);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Full name</Label>
        <Input id="su-name" required minLength={2} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="email" />
        <p className="text-xs text-muted-foreground">Use your institution email if a programme is for its members.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">Password</Label>
        <PasswordInput id="su-password" required minLength={8} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already on Menty? <Link href={loginHref} className="font-medium text-primary underline">Log in</Link>
      </p>
    </form>
  );
}
