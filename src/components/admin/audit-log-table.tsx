"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

interface AuditLogRow {
  id: string;
  action: string;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string };
}

const CATEGORIES = [
  { value: "user", label: "Users" },
  { value: "semester", label: "Semesters" },
  { value: "pairing", label: "Pairings" },
  { value: "announcement", label: "Announcements" },
  { value: "email", label: "Bulk email" },
  { value: "data", label: "Import / export" },
  { value: "department", label: "Departments" },
  { value: "programme", label: "Programmes" },
  { value: "interest", label: "Interests" },
  { value: "module", label: "Strong modules" },
];

function describe(log: AuditLogRow): string {
  const m = log.metadata ?? {};
  const s = (key: string) => (typeof m[key] === "string" ? (m[key] as string) : "");
  switch (log.action) {
    case "user.approve":
      return `Approved ${s("name")} (${s("email")})`;
    case "user.reject":
      return `Rejected ${s("name")} (${s("email")})`;
    case "user.delete":
      return `Deleted ${s("name")} (${s("email")})`;
    case "semester.create":
      return `Created semester "${s("name")}"`;
    case "semester.activate":
      return `Activated semester "${s("name")}"`;
    case "semester.archive":
      return `Archived semester "${s("name")}"`;
    case "semester.unarchive":
      return `Unarchived semester "${s("name")}"`;
    case "semester.openRegistration":
      return `Opened registration for "${s("name")}"`;
    case "semester.closeRegistration":
      return `Closed registration for "${s("name")}"`;
    case "pairing.create":
      return `Paired ${s("mentor")} with ${s("mentee")}`;
    case "pairing.reassign":
      return `Reassigned ${s("mentee")} from ${s("oldMentor")} to ${s("newMentor")}`;
    case "pairing.end":
      return `Ended pairing: ${s("mentor")} / ${s("mentee")}`;
    case "announcement.create":
      return `Posted announcement "${s("title")}" to ${s("audience")}${m.emailSent ? " (emailed)" : ""}`;
    case "announcement.email_sent":
      return `Emailed announcement "${s("title")}" (${m.sent ?? 0} sent, ${m.failed ?? 0} failed)`;
    case "email.bulk_send":
      return `Sent bulk email "${s("subject")}" to ${s("audience")} (${m.sent ?? 0} sent, ${m.failed ?? 0} failed)`;
    case "data.import":
      return `Imported ${s("type")} — ${m.created ?? 0} created, ${m.skipped ?? 0} skipped`;
    case "data.export":
      return `Exported ${s("type")}`;
    case "department.create":
      return `Added department "${s("name")}"`;
    case "department.update":
      return `Updated department "${s("name")}" (${m.isActive ? "active" : "inactive"})`;
    case "programme.create":
      return `Added programme "${s("name")}"`;
    case "programme.update":
      return `Updated programme "${s("name")}" (${m.isActive ? "active" : "inactive"})`;
    case "interest.create":
      return `Added interest "${s("name")}"`;
    case "interest.update":
      return `Updated interest "${s("name")}" (${m.isActive ? "active" : "inactive"})`;
    case "module.create":
      return `Added strong module "${s("name")}"`;
    case "module.update":
      return `Updated strong module "${s("name")}" (${m.isActive ? "active" : "inactive"})`;
    default:
      return log.action;
  }
}

export function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const debouncedQuery = useDebounce(query);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (debouncedQuery) params.set("q", debouncedQuery);
    params.set("page", String(page));
    try {
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      const data = (await res.json()) as { logs: AuditLogRow[]; total: number };
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedQuery, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search by admin name or email…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="sm:max-w-xs"
          />
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No matching audit entries.
          </p>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-2 md:hidden">
              {logs.map((log) => (
                <div key={log.id} className="rounded-md border p-3 text-sm">
                  <p>{describe(log)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.actor.name} ({log.actor.email}) ·{" "}
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.actor.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.actor.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{describe(log)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} entr{total === 1 ? "y" : "ies"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
