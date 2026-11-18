"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ExternalLink, Eye, Loader2, Save, Send, Trash2, UserPlus } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  BasicsFields,
  CommunicationsFields,
  DeliveryFields,
  RegistrationFields,
  basicsPayload,
  registrationPayload,
  type BasicsValue,
  type DeliveryValue,
  type RegistrationValue,
} from "@/components/program/program-fields";
import { ThemeEditor, themeIssuesFor, type ThemeValue } from "@/components/program/theme-editor";
import { ImageField } from "@/components/program/image-field";
import { RegistrationsManager } from "@/components/program/registrations-manager";
import { DELIVERY_MODEL_LABEL, OWNER_LABEL, STATUS_LABEL, STATUS_VARIANT } from "@/components/program/labels";

export interface SettingsProgram {
  id: string;
  slug: string;
  name: string;
  status: string;
  verificationStatus: string;
  ownerType: string;
  visibility: string;
  deliveryModel: string;
  deliveryMode: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  contactEmail: string | null;
  hostName: string;
  institution: { id: string; name: string } | null;
  memberCount: number;
  legacyRegistration: boolean;
  openTransfer: { id: string; institutionName: string } | null;
}

export interface Capabilities {
  update: boolean;
  settings: boolean;
  branding: boolean;
  publish: boolean;
  archive: boolean;
  transfer: boolean;
  verify: boolean;
  suspend: boolean;
  assign: boolean;
  registrationsRead: boolean;
  registrationsReview: boolean;
  participantsManage: boolean;
}

export interface TeamData {
  assignments: { id: string; user: { id: string; name: string; email: string }; role: { key: string; name: string } }[];
  invites: { id: string; email: string; role: { key: string; name: string }; expiresAt: string }[];
}

function SaveBar({ onSave, pending, disabled }: { onSave: () => void; pending: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end">
      <Button onClick={onSave} disabled={pending || disabled}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
      </Button>
    </div>
  );
}

export function ProgramSettings({
  program,
  form,
  draftTheme,
  can,
  team,
  institutions,
  currentUserId,
}: {
  program: SettingsProgram;
  form: { basics: BasicsValue; delivery: DeliveryValue; registration: RegistrationValue };
  draftTheme: ThemeValue;
  can: Capabilities;
  team: TeamData;
  institutions: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [basics, setBasics] = useState(form.basics);
  const [delivery, setDelivery] = useState(form.delivery);
  const [registration, setRegistration] = useState(form.registration);
  const [communications, setCommunications] = useState({ contactEmail: program.contactEmail ?? "" });
  const [assets, setAssets] = useState({ logoUrl: program.logoUrl, coverImageUrl: program.coverImageUrl });
  const [theme, setTheme] = useState(draftTheme);
  const [invite, setInvite] = useState({ email: "", roleKey: "program_coordinator" });
  const [transfer, setTransfer] = useState({ institutionId: "", note: "" });

  const base = `/api/programs/${program.id}`;
  const patch = (section: string, data: unknown) =>
    run(base, { method: "PATCH", body: JSON.stringify({ section, data }), successMessage: "Saved" }).then(() => router.refresh());
  const act = (action: string, successMessage?: string) =>
    run(`${base}/actions`, { method: "POST", body: JSON.stringify({ action }), successMessage }).then(() => router.refresh());

  const preview = {
    name: basics.name,
    tagline: basics.tagline,
    logoUrl: assets.logoUrl,
    coverImageUrl: assets.coverImageUrl,
    hostName: program.hostName,
    deliveryModel: delivery.deliveryModel,
    deliveryMode: delivery.deliveryMode,
    durationLabel: basics.durationLabel,
    welcomeMessage: basics.welcomeMessage,
    verified: program.verificationStatus === "VERIFIED",
  };
  const visible = ["PUBLISHED", "ACTIVE", "PAUSED", "COMPLETED"].includes(program.status);
  const s = program.status;

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap justify-start">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {can.registrationsRead && <TabsTrigger value="registrations">Registrations</TabsTrigger>}
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="delivery">Mentorship model</TabsTrigger>
        <TabsTrigger value="registration">Registration</TabsTrigger>
        <TabsTrigger value="communications">Communications</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
        <TabsTrigger value="ownership">Ownership</TabsTrigger>
      </TabsList>

      {/* ---------------- Overview ---------------- */}
      <TabsContent value="overview" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>
              {program.verificationStatus === "VERIFIED" && (
                <Badge variant="success" className="gap-1"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
              )}
              {program.verificationStatus === "PENDING" && <Badge variant="warning">Verification requested</Badge>}
              {program.verificationStatus === "REJECTED" && <Badge variant="destructive">Verification declined</Badge>}
              <Badge variant="outline">{OWNER_LABEL[program.ownerType]}</Badge>
              <Badge variant="outline">{DELIVERY_MODEL_LABEL[program.deliveryModel]}</Badge>
            </CardTitle>
            <CardDescription>
              {program.hostName} · {program.memberCount} participant{program.memberCount === 1 ? "" : "s"} · menty/p/{program.slug}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/p/${program.slug}?preview=1`} target="_blank"><Eye className="h-4 w-4" /> Preview</Link>
            </Button>
            {visible && (
              <Button variant="outline" asChild>
                <Link href={`/p/${program.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /> Public page</Link>
              </Button>
            )}
            {can.publish && s === "DRAFT" && (
              <Button onClick={() => act("publish", "Programme published")} disabled={pending}>
                <Send className="h-4 w-4" /> Publish
              </Button>
            )}
            {can.publish && s === "PUBLISHED" && (
              <Button variant="outline" onClick={() => act("unpublish", "Back to draft")} disabled={pending}>Unpublish</Button>
            )}
            {can.settings && s === "PUBLISHED" && <Button onClick={() => act("start", "Programme started")} disabled={pending}>Start programme</Button>}
            {can.settings && s === "ACTIVE" && <Button variant="outline" onClick={() => act("pause")} disabled={pending}>Pause</Button>}
            {can.settings && s === "PAUSED" && <Button onClick={() => act("resume")} disabled={pending}>Resume</Button>}
            {can.settings && (s === "ACTIVE" || s === "PAUSED") && (
              <ConfirmDialog
                trigger={<Button variant="outline" disabled={pending}>Mark completed</Button>}
                title="Complete this programme?"
                description="Participants keep access to their history. You can archive it afterwards."
                confirmLabel="Complete"
                onConfirm={() => act("complete")}
              />
            )}
            {can.archive && s !== "ARCHIVED" && s !== "SUSPENDED" && (
              <ConfirmDialog
                trigger={<Button variant="ghost" disabled={pending}>Archive</Button>}
                title="Archive this programme?"
                description="It disappears from public pages. Nothing is deleted and you can restore it."
                confirmLabel="Archive"
                onConfirm={() => act("archive")}
              />
            )}
            {can.archive && s === "ARCHIVED" && <Button variant="outline" onClick={() => act("unarchive")} disabled={pending}>Restore</Button>}
            {can.update && program.ownerType === "INDEPENDENT" && ["UNVERIFIED", "REJECTED"].includes(program.verificationStatus) && (
              <Button variant="outline" onClick={() => act("requestVerification", "Verification requested")} disabled={pending}>
                <BadgeCheck className="h-4 w-4" /> Request verification
              </Button>
            )}
          </CardContent>
        </Card>
        {(can.verify || can.suspend) && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Menty administration</CardTitle>
              <CardDescription>Only platform administrators see these controls.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {can.verify && program.verificationStatus !== "VERIFIED" && (
                <Button onClick={() => act("verify", "Programme verified")} disabled={pending}>Verify</Button>
              )}
              {can.verify && program.verificationStatus === "PENDING" && (
                <Button variant="outline" onClick={() => act("rejectVerification")} disabled={pending}>Decline verification</Button>
              )}
              {can.suspend && s !== "SUSPENDED" && (
                <ConfirmDialog
                  trigger={<Button variant="destructive" disabled={pending}>Suspend</Button>}
                  title="Suspend this programme?"
                  description="It is hidden and its coordinators cannot make changes until you lift the suspension."
                  confirmLabel="Suspend"
                  onConfirm={() => act("suspend")}
                />
              )}
              {can.suspend && s === "SUSPENDED" && <Button onClick={() => act("unsuspend")} disabled={pending}>Lift suspension</Button>}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ---------------- Registrations ---------------- */}
      {can.registrationsRead && (
        <TabsContent value="registrations">
          <RegistrationsManager
            programId={program.id}
            canReview={can.registrationsReview}
            canManage={can.participantsManage}
            legacy={program.legacyRegistration}
          />
        </TabsContent>
      )}

      {/* ---------------- Details ---------------- */}
      <TabsContent value="details">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <BasicsFields value={basics} onChange={setBasics} />
            {can.update && <SaveBar pending={pending} onSave={() => patch("basics", basicsPayload(basics))} />}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Branding ---------------- */}
      <TabsContent value="branding" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo and cover</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField label="Logo" value={assets.logoUrl} onChange={(logoUrl) => setAssets({ ...assets, logoUrl })} upload={{ target: "program-logo", id: program.id }} hint="PNG, JPEG, GIF or WebP, up to 2 MB." />
              <ImageField label="Cover image" value={assets.coverImageUrl} onChange={(coverImageUrl) => setAssets({ ...assets, coverImageUrl })} upload={{ target: "program-cover", id: program.id }} hint="Up to 5 MB." />
            </div>
            {can.branding && <SaveBar pending={pending} onSave={() => patch("assets", assets)} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colours</CardTitle>
            <CardDescription>Save a draft to try it in the preview, then publish it to participants.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThemeEditor value={theme} onChange={setTheme} preview={preview} />
            {can.branding && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(`${base}/theme`, { method: "PUT", body: JSON.stringify(theme) }).then(() => router.refresh())}
                >
                  <Save className="h-4 w-4" /> Save draft
                </Button>
                <Button
                  disabled={pending || themeIssuesFor(theme) > 0}
                  onClick={async () => {
                    await run(`${base}/theme`, { method: "PUT", body: JSON.stringify(theme) });
                    await run(`${base}/theme`, { method: "POST" });
                    router.refresh();
                  }}
                >
                  <Send className="h-4 w-4" /> Publish branding
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Model ---------------- */}
      <TabsContent value="delivery">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <DeliveryFields value={delivery} onChange={setDelivery} />
            {can.settings && <SaveBar pending={pending} onSave={() => patch("delivery", delivery)} />}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Registration ---------------- */}
      <TabsContent value="registration">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <RegistrationFields value={registration} onChange={setRegistration} institutions={institutions} />
            {can.settings && <SaveBar pending={pending} onSave={() => patch("registration", registrationPayload(registration))} />}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Communications ---------------- */}
      <TabsContent value="communications">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <CommunicationsFields value={communications} onChange={setCommunications} />
            {can.update && <SaveBar pending={pending} onSave={() => patch("communications", communications)} />}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Team ---------------- */}
      <TabsContent value="team" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programme team</CardTitle>
            <CardDescription>
              Coordinators run everything in this programme. Assistants help with registrations, sessions and messages but cannot change settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {team.assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {a.user.name} {a.user.id === currentUserId && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{a.role.name}</Badge>
                  {can.assign && (
                    <ConfirmDialog
                      trigger={<Button variant="ghost" size="icon" aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>}
                      title={`Remove ${a.user.name}?`}
                      description="They lose access to this programme's management straight away."
                      confirmLabel="Remove"
                      onConfirm={() =>
                        run(`${base}/team?assignmentId=${a.id}`, { method: "DELETE" }).then(() => router.refresh())
                      }
                    />
                  )}
                </div>
              </div>
            ))}
            {team.invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-dashed p-3">
                <div>
                  <p className="text-sm font-medium">{i.email}</p>
                  <p className="text-xs text-muted-foreground">Invitation sent · expires {new Date(i.expiresAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{i.role.name}</Badge>
                  {can.assign && (
                    <Button variant="ghost" size="icon" aria-label="Cancel invitation" onClick={() => run(`${base}/team?inviteId=${i.id}`, { method: "DELETE" }).then(() => router.refresh())}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {team.assignments.length === 0 && team.invites.length === 0 && (
              <p className="text-sm text-muted-foreground">No coordinators yet. Appoint one below.</p>
            )}
          </CardContent>
        </Card>
        {can.assign && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add someone</CardTitle>
              <CardDescription>People with a Menty account get access straight away; others receive an email invitation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run(`${base}/team`, { method: "POST", body: JSON.stringify(invite) });
                  setInvite({ ...invite, email: "" });
                  router.refresh();
                }}
              >
                <Input type="email" required placeholder="name@example.org" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
                <Select value={invite.roleKey} onValueChange={(roleKey) => setInvite({ ...invite, roleKey })}>
                  <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="program_coordinator">Coordinator</SelectItem>
                    <SelectItem value="program_assistant">Assistant</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={pending}><UserPlus className="h-4 w-4" /> Add</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ---------------- Ownership ---------------- */}
      <TabsContent value="ownership">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ownership</CardTitle>
            <CardDescription>
              {program.ownerType === "INSTITUTION"
                ? `This programme belongs to ${program.institution?.name}.`
                : program.ownerType === "PLATFORM"
                  ? "This programme is run by Menty."
                  : "This is an independent programme. You can hand it to an institution; participants, team and history all stay."}
            </CardDescription>
          </CardHeader>
          {program.ownerType === "INDEPENDENT" && can.transfer && (
            <CardContent className="space-y-3">
              {program.openTransfer ? (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <p className="text-sm">
                    Waiting for <strong>{program.openTransfer.institutionName}</strong> to accept.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => run(`/api/transfers/${program.openTransfer!.id}`, { method: "POST", body: JSON.stringify({ action: "cancel" }) }).then(() => router.refresh())}>
                    Cancel request
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await run(`${base}/transfer`, { method: "POST", body: JSON.stringify(transfer) });
                    router.refresh();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label>Institution</Label>
                    <Select value={transfer.institutionId} onValueChange={(institutionId) => setTransfer({ ...transfer, institutionId })}>
                      <SelectTrigger><SelectValue placeholder="Choose an institution" /></SelectTrigger>
                      <SelectContent>
                        {institutions.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Message to the institution</Label>
                    <Textarea rows={3} value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} maxLength={1000} />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={pending || !transfer.institutionId}>Request transfer</Button>
                  </div>
                </form>
              )}
            </CardContent>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
