"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Search, User } from "lucide-react";
import type { Role } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getInitials } from "@/lib/utils";

interface TopbarProps {
  user: { name: string; email: string; role: Role };
}

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNavDrawer role={user.role} />
        {user.role === "ADMIN" && (
          <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" asChild>
            <Link href="/search">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search mentors, mentees, meetings…</span>
            </Link>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-full outline-none ring-ring focus-visible:ring-2"
              aria-label="Account menu"
            >
              <Avatar>
                <AvatarFallback>{getInitials(user.name || "?")}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span>{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
                <Badge variant="secondary" className="w-fit">
                  {user.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
