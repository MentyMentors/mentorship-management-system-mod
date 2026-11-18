"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Loader2, UserMinus, X } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MEMBERSHIP_STATUS_LABEL, MEMBERSHIP_STATUS_VARIANT, ROLE_LABEL } from "@/components/dashboard/membership-labels";
import { cn, formatDateTime } from "@/lib/utils";

interface Row {
  id: string;
  role: string;
  status: string;
  applicationNote: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
}

const FILTERS = ["PENDING", "WAITLISTED", "ACTIVE", "REJECTED", "WITHDRAWN"] as const;

export function RegistrationsManager({
  programId,
  canReview,
  canManage,
  legacy,
}: {
  programId: string;
  canReview: boolean;
  canManage: boolean;
  legacy: boolean;
}) {
  const { run } = useApiAction();
  const [filter, setFilter] = useState<string>("PENDING");
  const [data, setData] = useState<{ rows: Row[]; counts: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${programId}/registrations?status=${filter}`);
    if (res.ok) setData(await res.json());
  }, [programId, filter]);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, action: "approve" | "reject" | "waitlist" | "remove") => {
    setBusy(id);
    try {
      await run(`/api/programs/${programId}/registrations/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrations and participants</CardTitle>
        <CardDescription>
          {legacy
            ? "People who used the original registration form are approved under Admin → Users. Registrations made through Menty's join page can be handled here."
            : "Approve, decline or wait-list registrations. Each person gets an email with the outcome."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn("rounded-full border px-3 py-1 text-xs", filter === f && "border-primary bg-primary text-primary-foreground")}
            >
              {MEMBERSHIP_STATUS_LABEL[f]} {data?.counts[f] ? `(${data.counts[f]})` : ""}
            </button>
          ))}
        </div>
        {!data ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody here.</p>
        ) : (
          <div className="space-y-2">
            {data.rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {r.user.name} <Badge variant="outline" className="ml-1">{ROLE_LABEL[r.role]}</Badge>{" "}
                    <Badge variant={MEMBERSHIP_STATUS_VARIANT[r.status]}>{MEMBERSHIP_STATUS_LABEL[r.status]}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.user.email}
                    {r.user.phone ? ` · ${r.user.phone}` : ""} · registered {formatDateTime(r.createdAt)}
                  </p>
                  {r.applicationNote && <p className="whitespace-pre-line text-sm">“{r.applicationNote}”</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {busy === r.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {canReview && ["PENDING", "WAITLISTED", "REJECTED"].includes(r.status) && (
                    <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, "approve")}><Check className="h-4 w-4" /> Approve</Button>
                  )}
                  {canReview && r.status === "PENDING" && (
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r.id, "waitlist")}><Clock className="h-4 w-4" /> Wait-list</Button>
                  )}
                  {canReview && ["PENDING", "WAITLISTED"].includes(r.status) && (
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => decide(r.id, "reject")}><X className="h-4 w-4" /> Decline</Button>
                  )}
                  {canManage && r.status === "ACTIVE" && (
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => decide(r.id, "remove")}><UserMinus className="h-4 w-4" /> Remove</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
