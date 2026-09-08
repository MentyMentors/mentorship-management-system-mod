"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Flag,
  Handshake,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  ScrollText,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/pairings", label: "Pairings", icon: Handshake },
    { href: "/admin/semesters", label: "Semesters", icon: CalendarDays },
    { href: "/admin/catalog", label: "Departments & programmes", icon: Layers },
    { href: "/admin/meetings", label: "Meetings", icon: CalendarDays },
    { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { href: "/admin/import-export", label: "Import / Export", icon: FileSpreadsheet },
    { href: "/admin/analytics", label: "Reports", icon: BarChart3 },
    { href: "/admin/issues", label: "Issue reports", icon: Flag },
    { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
    { href: "/messages", label: "Messages", icon: MessagesSquare },
    { href: "/search", label: "Search", icon: Search },
  ],
  MENTOR: [
    { href: "/mentor", label: "Dashboard", icon: LayoutDashboard },
    { href: "/mentor/mentees", label: "My mentees", icon: Users },
    { href: "/mentor/meetings", label: "Meetings", icon: CalendarDays },
    { href: "/messages", label: "Messages", icon: MessagesSquare },
    { href: "/announcements", label: "Programme", icon: ClipboardList },
    { href: "/issues", label: "Resources", icon: BookOpen },
    { href: "/profile", label: "Settings", icon: Settings },
  ],
  MENTEE: [
    { href: "/mentee", label: "Dashboard", icon: LayoutDashboard },
    { href: "/mentee/meetings", label: "Meetings", icon: CalendarDays },
    { href: "/messages", label: "Messages", icon: MessagesSquare },
    { href: "/announcements", label: "Programme", icon: ClipboardList },
    { href: "/issues", label: "Resources", icon: BookOpen },
    { href: "/profile", label: "Settings", icon: Settings },
  ],
};

export function SidebarNavLinks({
  role,
  onNavigate,
  className,
}: {
  role: Role;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <nav className={cn("flex-1 space-y-1 overflow-y-auto p-3", className)}>
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/admin" &&
            item.href !== "/mentor" &&
            item.href !== "/mentee" &&
            pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white shadow-inner"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={cn("h-4 w-4", active && "text-green")} />
            {item.label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar({ role }: { role: Role }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy text-white md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo variant="markWhite" size={26} wordmarkClassName="text-white" />
      </div>
      <SidebarNavLinks role={role} />
      <div className="m-3 rounded-2xl bg-white/5 p-4">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
          <LifeBuoy className="h-4 w-4 text-green" />
        </div>
        <p className="text-sm font-semibold">Need help?</p>
        <p className="mt-1 text-xs text-white/60">
          Visit the help center for guides and support.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-8 px-0 text-xs text-green hover:bg-transparent hover:text-green"
          asChild
        >
          <Link href="/issues">Go to help center →</Link>
        </Button>
      </div>
    </aside>
  );
}
