import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/join/signup-form";
import { safeNextPath } from "@/lib/safe-path";

export const metadata = { title: "Create your Menty account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your Menty account</CardTitle>
        <CardDescription>
          One account for every programme — find a mentor, join programmes, or run your own. Looking for the MUBAS engineering programme? Use its <Link href="/register" className="underline">registration form</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm next={safeNextPath(next) ?? undefined} />
      </CardContent>
    </Card>
  );
}
