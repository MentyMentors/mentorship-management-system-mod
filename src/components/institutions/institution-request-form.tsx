"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Register an institution (request for review), or create one directly as Super Admin. */
export function InstitutionRequestForm({ direct, defaults }: { direct: boolean; defaults: { contactName: string; contactEmail: string } }) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [v, setV] = useState({
    name: "",
    shortName: "",
    websiteUrl: "",
    description: "",
    contactName: defaults.contactName,
    contactEmail: defaults.contactEmail,
    requestNote: "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = await run<{ institution: { id: string } }>("/api/institutions", { method: "POST", body: JSON.stringify(v) });
            router.push(direct ? `/manage/institutions/${data.institution.id}` : "/manage");
            router.refresh();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Institution or organisation name *</Label>
            <Input required minLength={3} maxLength={160} value={v.name} onChange={set("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Short name</Label>
            <Input maxLength={30} value={v.shortName} onChange={set("shortName")} placeholder="e.g. MUBAS" />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input type="url" value={v.websiteUrl} onChange={set("websiteUrl")} placeholder="https://" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>About</Label>
            <Textarea rows={3} maxLength={3000} value={v.description} onChange={set("description")} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact person *</Label>
            <Input required minLength={2} value={v.contactName} onChange={set("contactName")} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email *</Label>
            <Input required type="email" value={v.contactEmail} onChange={set("contactEmail")} />
          </div>
          {!direct && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Anything Menty should know?</Label>
              <Textarea rows={3} maxLength={2000} value={v.requestNote} onChange={set("requestNote")} placeholder="Your role at the institution, the programmes you plan to run…" />
            </div>
          )}
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {direct ? "Create institution" : "Send registration request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
