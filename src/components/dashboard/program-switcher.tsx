"use client";

import { useRouter } from "next/navigation";

/** Jump between your programmes without signing out. */
export function ProgramSwitcher({ programs, currentId }: { programs: { id: string; name: string }[]; currentId?: string }) {
  const router = useRouter();
  if (programs.length < 2) return null;
  return (
    <select
      aria-label="Switch programme"
      className="h-9 max-w-[16rem] rounded-full border bg-background px-3 text-sm"
      value={currentId ?? ""}
      onChange={(e) => router.push(e.target.value ? `/dashboard/programs/${e.target.value}` : "/dashboard")}
    >
      <option value="">All my programmes</option>
      {programs.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
