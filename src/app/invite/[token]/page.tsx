import Link from "next/link";
import { auth } from "@/lib/auth";
import { findInvite } from "@/services/staff";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptInviteForm } from "@/components/institutions/accept-invite-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation", robots: { index: false, follow: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, session] = await Promise.all([findInvite(token), auth()]);
  const signedInEmail = session?.user?.email?.toLowerCase() ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Link href="/"><Logo /></Link>
      <Card className="w-full max-w-md">
        {!invite ? (
          <CardHeader>
            <CardTitle>Invitation not valid</CardTitle>
            <CardDescription>It may have been used already, cancelled, or expired. Ask the person who invited you to send a new one.</CardDescription>
          </CardHeader>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Join {invite.targetName}</CardTitle>
              <CardDescription>
                You have been invited as <strong>{invite.roleName}</strong> ({invite.email}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invite.hasAccount && signedInEmail !== invite.email ? (
                <div className="space-y-3 text-sm">
                  <p>
                    {signedInEmail
                      ? `You are signed in as ${signedInEmail}. Sign out and sign in as ${invite.email} to accept.`
                      : `You already have a Menty account. Sign in as ${invite.email} to accept.`}
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}>Sign in</Link>
                  </Button>
                </div>
              ) : (
                <AcceptInviteForm token={token} needsAccount={!invite.hasAccount} />
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
