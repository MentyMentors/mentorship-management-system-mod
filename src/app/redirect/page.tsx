import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Sends a freshly logged-in user to their role dashboard. */
export default async function RedirectPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.status !== "APPROVED") redirect("/pending");

  switch (session.user.role) {
    case "ADMIN":
      redirect("/admin");
    case "MENTOR":
      redirect("/mentor");
    case "USER":
      redirect("/dashboard");
    default:
      redirect("/mentee");
  }
}
