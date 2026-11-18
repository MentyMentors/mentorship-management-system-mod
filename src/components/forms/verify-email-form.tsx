"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Status = "verifying" | "success" | "error";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const next = searchParams.get("next");
  const loginHref =
    next && next.startsWith("/") && !next.startsWith("//") ? `/login?callbackUrl=${encodeURIComponent(next)}` : "/login";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setMessage(
            data.error ?? "This verification link is invalid or has expired."
          );
          return;
        }
        setStatus("success");
        setMessage(data.message ?? "Email verified.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Something went wrong. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "verifying") {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Loader2 className="mx-auto mb-2 h-10 w-10 animate-spin text-primary" />
          <CardTitle>Verifying your email&hellip;</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-green" />
          <CardTitle>Email verified</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href={loginHref}>Go to log in</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <XCircle className="mx-auto mb-2 h-12 w-12 text-destructive" />
        <CardTitle>
          {token ? "Verification failed" : "Missing verification link"}
        </CardTitle>
        <CardDescription>
          {message ||
            "This link is missing its token. Request a new one from the login page."}
        </CardDescription>
      </CardHeader>
      <CardContent />
      <CardFooter className="justify-center">
        <Button variant="outline" asChild>
          <Link href="/login">Back to log in</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
