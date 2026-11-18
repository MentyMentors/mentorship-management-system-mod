"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/programs", label: "Find a programme" },
  { href: "/run", label: "Run a programme" },
  { href: "#how", label: "How it works" },
  { href: "#events", label: "Events" },
  { href: "#features", label: "Features" },
  { href: "#testimonials", label: "Stories" },
  { href: "#faq", label: "FAQ" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="glass-strong absolute inset-x-0 top-16 z-40 border-b border-border/50 px-6 py-4 animate-fade-in shadow-lg">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action button replacing standalone login */}
          <div className="mt-4 pt-4 border-t border-border/40">
            <Button
              variant="accent"
              className="w-full justify-center"
              onClick={() => setOpen(false)}
              asChild
            >
              <Link href="/login">
                Log In
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
