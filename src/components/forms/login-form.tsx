"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-site destinations are honoured, so the link cannot send people
  // away. Auth.js passes an absolute URL; our own links pass a path.
  // (Resolved at submit time: `window` does not exist during server render.)
  const callbackUrl = searchParams.get("callbackUrl");
  const destination = () => {
    if (!callbackUrl) return "/redirect";
    try {
      const target = new URL(callbackUrl, window.location.origin);
      if (target.origin === window.location.origin && !target.pathname.startsWith("/login")) {
        return `${target.pathname}${target.search}`;
      }
    } catch {
      // ignore malformed values
    }
    return "/redirect";
  };
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setNeedsVerification(false);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      // Distinguish "pending approval" / "unverified" from bad
      // credentials for a friendlier message (only coarse status is
      // exposed).
      try {
        const res = await fetch("/api/register/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: values.email }),
        });
        const { status, emailVerified } = (await res.json()) as {
          status?: string;
          emailVerified?: boolean | null;
        };
        if (emailVerified === false) {
          setNeedsVerification(true);
          toast.error("Please verify your email before logging in.");
          return;
        }
        if (status === "PENDING") {
          router.push("/pending");
          return;
        }
        if (status === "REJECTED") {
          toast.error("This account was not approved. Contact the coordinator.");
          return;
        }
      } catch {
        // fall through to the generic error
      }
      toast.error("Invalid email or password.");
      return;
    }

    toast.success("Welcome back!");
    router.push(destination());
    router.refresh();
  }

  async function resendVerification() {
    const email = form.getValues("email");
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string };
      toast.success(data.message ?? "Verification email sent.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Log in</CardTitle>
        <CardDescription>
          Enter your credentials to access your dashboard.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Log in
            </Button>
            {needsVerification && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={resending}
                onClick={resendVerification}
              >
                {resending && <Loader2 className="h-4 w-4 animate-spin" />}
                Resend verification email
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              No account yet?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Register
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
