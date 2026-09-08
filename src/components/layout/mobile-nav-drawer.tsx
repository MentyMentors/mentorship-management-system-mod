"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNavLinks } from "@/components/layout/app-sidebar";
import { Logo } from "@/components/logo";

export function MobileNavDrawer({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="border-white/10 bg-navy text-white">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Logo variant="markWhite" size={24} wordmarkClassName="text-white" />
        </div>
        <SidebarNavLinks role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
