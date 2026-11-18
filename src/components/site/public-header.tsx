import Link from "next/link";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

/** Header for Menty's public pages outside a programme (Menty branding). */
export async function PublicHeader() {
  const session = await auth();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Menty home"><Logo size={26} /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" asChild><Link href="/find-a-mentor">Find your mentor</Link></Button>
          <Button variant="ghost" size="sm" asChild><Link href="/programs">Find a programme</Link></Button>
          <Button variant="ghost" size="sm" asChild><Link href="/run">Run a programme</Link></Button>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session?.user ? (
            <Button size="sm" asChild><Link href="/dashboard">My dashboard</Link></Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild><Link href="/login">Log in</Link></Button>
              <Button variant="accent" size="sm" asChild><Link href="/signup">Sign up</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t py-8 text-center text-sm text-muted-foreground">
      <div className="container flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Menty</span>
        <nav className="flex gap-4">
          <Link href="/programs" className="hover:text-foreground">Programmes</Link>
          <Link href="/run" className="hover:text-foreground">Run a programme</Link>
          <Link href="/#faq" className="hover:text-foreground">FAQ</Link>
        </nav>
      </div>
    </footer>
  );
}
