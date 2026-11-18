"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, UserPlus } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageField } from "@/components/program/image-field";
import type { TeamData } from "@/components/program/program-settings";

interface InstitutionData {
  id: string;
  name: string;
  shortName: string | null;
  websiteUrl: string | null;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export function InstitutionManager({
  institution,
  canEdit,
  canBrand,
  canAssign,
  admins,
  currentUserId,
}: {
  institution: InstitutionData;
  canEdit: boolean;
  canBrand: boolean;
  canAssign: boolean;
  admins: TeamData;
  currentUserId: string;
}) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [v, setV] = useState({
    name: institution.name,
    shortName: institution.shortName ?? "",
    websiteUrl: institution.websiteUrl ?? "",
    description: institution.description ?? "",
    logoUrl: institution.logoUrl,
    coverImageUrl: institution.coverImageUrl,
    primaryColor: institution.primaryColor,
    secondaryColor: institution.secondaryColor,
    accentColor: institution.accentColor,
  });
  const [email, setEmail] = useState("");
  const base = `/api/institutions/${institution.id}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile and branding</CardTitle>
          <CardDescription>Shown on the institution&apos;s programmes. Each programme can still have its own colours.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={v.name} disabled={!canEdit} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Short name</Label>
            <Input value={v.shortName} disabled={!canEdit} onChange={(e) => setV({ ...v, shortName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={v.websiteUrl} disabled={!canEdit} onChange={(e) => setV({ ...v, websiteUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>About</Label>
            <Textarea rows={3} value={v.description} disabled={!canEdit} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </div>
          {canBrand && (
            <>
              <ImageField label="Logo" value={v.logoUrl} onChange={(logoUrl) => setV({ ...v, logoUrl })} upload={{ target: "institution-logo", id: institution.id }} />
              <ImageField label="Cover image" value={v.coverImageUrl} onChange={(coverImageUrl) => setV({ ...v, coverImageUrl })} upload={{ target: "institution-cover", id: institution.id }} />
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                {(["primaryColor", "secondaryColor", "accentColor"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="color" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="h-8 w-10 rounded border" />
                    {k === "primaryColor" ? "Primary" : k === "secondaryColor" ? "Secondary" : "Accent"}
                  </label>
                ))}
              </div>
            </>
          )}
          {canEdit && (
            <div className="flex justify-end sm:col-span-2">
              <Button
                disabled={pending}
                onClick={() =>
                  run(base, {
                    method: "PATCH",
                    body: JSON.stringify(canBrand ? v : { name: v.name, shortName: v.shortName, websiteUrl: v.websiteUrl, description: v.description }),
                    successMessage: "Saved",
                  }).then(() => router.refresh())
                }
              >
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Administrators</CardTitle>
          <CardDescription>Administrators create programmes and appoint their coordinators. They are not automatically coordinators.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {admins.assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{a.user.name} {a.user.id === currentUserId && <span className="text-muted-foreground">(you)</span>}</p>
                <p className="text-xs text-muted-foreground">{a.user.email}</p>
              </div>
              {canAssign && (
                <ConfirmDialog
                  trigger={<Button variant="ghost" size="icon" aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>}
                  title={`Remove ${a.user.name}?`}
                  description="They lose administrator access to this institution."
                  confirmLabel="Remove"
                  onConfirm={() => run(`${base}/admins?assignmentId=${a.id}`, { method: "DELETE" }).then(() => router.refresh())}
                />
              )}
            </div>
          ))}
          {admins.invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-dashed p-3">
              <p className="text-sm">{i.email}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Invited</Badge>
                {canAssign && (
                  <Button variant="ghost" size="icon" aria-label="Cancel invitation" onClick={() => run(`${base}/admins?inviteId=${i.id}`, { method: "DELETE" }).then(() => router.refresh())}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {canAssign && (
            <form
              className="flex gap-2 pt-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await run(`${base}/admins`, { method: "POST", body: JSON.stringify({ email }) });
                setEmail("");
                router.refresh();
              }}
            >
              <Input type="email" required placeholder="name@example.org" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" disabled={pending}><UserPlus className="h-4 w-4" /> Add</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
