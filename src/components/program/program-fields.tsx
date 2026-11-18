"use client";

import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DELIVERY_MODE_LABEL,
  DELIVERY_MODEL_HELP,
  DELIVERY_MODEL_LABEL,
  ELIGIBILITY_LABEL,
  MATCHING_MODE_LABEL,
  VISIBILITY_LABEL,
} from "@/components/program/labels";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Form state (strings for inputs) and conversion to API payloads
// ---------------------------------------------------------------------------

export interface BasicsValue {
  name: string;
  tagline: string;
  description: string;
  objectives: string;
  category: string;
  targetAudience: string;
  welcomeMessage: string;
  durationLabel: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  endsAt: string;
}

export interface DeliveryValue {
  deliveryModel: "PRESENTER_LED" | "ONE_TO_ONE" | "HYBRID";
  deliveryMode: "ONLINE" | "IN_PERSON" | "BLENDED";
  matchingMode: "MANUAL" | "AUTOMATIC" | "HYBRID" | null;
}

export interface RegistrationValue {
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  requiresApproval: boolean;
  capacity: string;
  eligibility: {
    mode: "OPEN" | "INSTITUTIONS" | "DEPARTMENTS" | "YEARS_OF_STUDY" | "INVITE_ONLY" | "CUSTOM";
    institutionIds: string[];
    departments: string;
    yearsOfStudy: number[];
    note: string;
  };
  careerTags: string;
}

export const EMPTY_BASICS: BasicsValue = {
  name: "",
  tagline: "",
  description: "",
  objectives: "",
  category: "",
  targetAudience: "",
  welcomeMessage: "",
  durationLabel: "",
  registrationOpensAt: "",
  registrationClosesAt: "",
  startsAt: "",
  endsAt: "",
};

export const DEFAULT_DELIVERY: DeliveryValue = {
  deliveryModel: "PRESENTER_LED",
  deliveryMode: "ONLINE",
  matchingMode: null,
};

export const DEFAULT_REGISTRATION: RegistrationValue = {
  visibility: "PUBLIC",
  requiresApproval: true,
  capacity: "",
  eligibility: { mode: "OPEN", institutionIds: [], departments: "", yearsOfStudy: [], note: "" },
  careerTags: "",
};

const dateOrNull = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : null);
const list = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function basicsPayload(v: BasicsValue) {
  return {
    ...v,
    registrationOpensAt: dateOrNull(v.registrationOpensAt),
    registrationClosesAt: dateOrNull(v.registrationClosesAt),
    startsAt: dateOrNull(v.startsAt),
    endsAt: dateOrNull(v.endsAt),
  };
}

export function registrationPayload(v: RegistrationValue) {
  return {
    visibility: v.visibility,
    requiresApproval: v.requiresApproval,
    capacity: v.capacity ? Number(v.capacity) : null,
    eligibility: {
      mode: v.eligibility.mode,
      institutionIds: v.eligibility.mode === "INSTITUTIONS" ? v.eligibility.institutionIds : [],
      departments: v.eligibility.mode === "DEPARTMENTS" ? list(v.eligibility.departments) : [],
      yearsOfStudy: v.eligibility.mode === "YEARS_OF_STUDY" ? v.eligibility.yearsOfStudy : [],
      note: v.eligibility.note,
    },
    careerTags: list(v.careerTags),
  };
}

const toDateInput = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Builds form state from a stored programme (settings screens). */
export function fromProgram(p: {
  name: string;
  tagline: string | null;
  description: string | null;
  objectives: string | null;
  category: string | null;
  targetAudience: string | null;
  welcomeMessage: string | null;
  durationLabel: string | null;
  registrationOpensAt: Date | string | null;
  registrationClosesAt: Date | string | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  deliveryModel: DeliveryValue["deliveryModel"];
  deliveryMode: DeliveryValue["deliveryMode"];
  matchingMode: DeliveryValue["matchingMode"];
  visibility: RegistrationValue["visibility"];
  requiresApproval: boolean;
  capacity: number | null;
  eligibility: unknown;
  careerTags: string[];
}) {
  const e = (p.eligibility ?? {}) as Partial<{
    mode: RegistrationValue["eligibility"]["mode"];
    institutionIds: string[];
    departments: string[];
    yearsOfStudy: number[];
    note: string;
  }>;
  return {
    basics: {
      name: p.name,
      tagline: p.tagline ?? "",
      description: p.description ?? "",
      objectives: p.objectives ?? "",
      category: p.category ?? "",
      targetAudience: p.targetAudience ?? "",
      welcomeMessage: p.welcomeMessage ?? "",
      durationLabel: p.durationLabel ?? "",
      registrationOpensAt: toDateInput(p.registrationOpensAt),
      registrationClosesAt: toDateInput(p.registrationClosesAt),
      startsAt: toDateInput(p.startsAt),
      endsAt: toDateInput(p.endsAt),
    } satisfies BasicsValue,
    delivery: { deliveryModel: p.deliveryModel, deliveryMode: p.deliveryMode, matchingMode: p.matchingMode } satisfies DeliveryValue,
    registration: {
      visibility: p.visibility,
      requiresApproval: p.requiresApproval,
      capacity: p.capacity ? String(p.capacity) : "",
      eligibility: {
        mode: e.mode ?? "OPEN",
        institutionIds: e.institutionIds ?? [],
        departments: (e.departments ?? []).join(", "),
        yearsOfStudy: e.yearsOfStudy ?? [],
        note: e.note ?? "",
      },
      careerTags: p.careerTags.join(", "),
    } satisfies RegistrationValue,
  };
}

// ---------------------------------------------------------------------------
// Field groups
// ---------------------------------------------------------------------------

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const CATEGORY_SUGGESTIONS = [
  "Career development",
  "Academic support",
  "Entrepreneurship",
  "Technology",
  "Women in STEM",
  "Leadership",
  "Research",
  "Alumni network",
  "Professional development",
  "First-year transition",
];

export function BasicsFields({ value, onChange }: { value: BasicsValue; onChange: (v: BasicsValue) => void }) {
  const set = (k: keyof BasicsValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Programme name *" className="sm:col-span-2">
        <Input value={value.name} onChange={set("name")} maxLength={120} placeholder="e.g. Women in Engineering Mentorship" />
      </Field>
      <Field label="Tagline" hint="One line shown under the name." className="sm:col-span-2">
        <Input value={value.tagline} onChange={set("tagline")} maxLength={160} />
      </Field>
      <Field label="Description" hint="What the programme is and who it is for. Required to publish." className="sm:col-span-2">
        <Textarea value={value.description} onChange={set("description")} rows={5} maxLength={5000} />
      </Field>
      <Field label="Objectives" className="sm:col-span-2">
        <Textarea value={value.objectives} onChange={set("objectives")} rows={3} maxLength={3000} placeholder="What participants should achieve" />
      </Field>
      <Field label="Category">
        <Input value={value.category} onChange={set("category")} list="program-categories" maxLength={60} />
        <datalist id="program-categories">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Target audience">
        <Input value={value.targetAudience} onChange={set("targetAudience")} maxLength={200} placeholder="e.g. Second-year engineering students" />
      </Field>
      <Field label="Duration" hint='e.g. "12 weeks" or "One semester"'>
        <Input value={value.durationLabel} onChange={set("durationLabel")} maxLength={60} />
      </Field>
      <div />
      <Field label="Registration opens">
        <Input type="date" value={value.registrationOpensAt} onChange={set("registrationOpensAt")} />
      </Field>
      <Field label="Registration closes">
        <Input type="date" value={value.registrationClosesAt} onChange={set("registrationClosesAt")} />
      </Field>
      <Field label="Programme starts">
        <Input type="date" value={value.startsAt} onChange={set("startsAt")} />
      </Field>
      <Field label="Programme ends">
        <Input type="date" value={value.endsAt} onChange={set("endsAt")} />
      </Field>
      <Field label="Welcome message" hint="Shown to participants when they join." className="sm:col-span-2">
        <Textarea value={value.welcomeMessage} onChange={set("welcomeMessage")} rows={3} maxLength={2000} />
      </Field>
    </div>
  );
}

export function DeliveryFields({ value, onChange }: { value: DeliveryValue; onChange: (v: DeliveryValue) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        {(["PRESENTER_LED", "ONE_TO_ONE", "HYBRID"] as const).map((model) => (
          <button
            key={model}
            type="button"
            onClick={() =>
              onChange({
                ...value,
                deliveryModel: model,
                matchingMode: model === "PRESENTER_LED" ? null : (value.matchingMode ?? "MANUAL"),
              })
            }
            className={cn(
              "rounded-xl border p-4 text-left transition hover:border-primary/50",
              value.deliveryModel === model && "border-primary bg-primary/5 ring-1 ring-primary"
            )}
          >
            <p className="font-semibold">{DELIVERY_MODEL_LABEL[model]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{DELIVERY_MODEL_HELP[model]}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where it happens">
          <Select value={value.deliveryMode} onValueChange={(v) => onChange({ ...value, deliveryMode: v as DeliveryValue["deliveryMode"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DELIVERY_MODE_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {value.deliveryModel !== "PRESENTER_LED" && (
          <Field label="Pairing mentors and mentees" hint="AI-assisted matching arrives in a later release; until then automatic uses Menty's rule-based matcher.">
            <Select value={value.matchingMode ?? "MANUAL"} onValueChange={(v) => onChange({ ...value, matchingMode: v as DeliveryValue["matchingMode"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MATCHING_MODE_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
    </div>
  );
}

export function RegistrationFields({
  value,
  onChange,
  institutions,
}: {
  value: RegistrationValue;
  onChange: (v: RegistrationValue) => void;
  institutions: { id: string; name: string }[];
}) {
  const e = value.eligibility;
  const setE = (patch: Partial<RegistrationValue["eligibility"]>) => onChange({ ...value, eligibility: { ...e, ...patch } });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Who can find it">
        <Select value={value.visibility} onValueChange={(v) => onChange({ ...value, visibility: v as RegistrationValue["visibility"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(VISIBILITY_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Maximum participants" hint="Leave empty for no limit.">
        <Input type="number" min={1} value={value.capacity} onChange={(ev) => onChange({ ...value, capacity: ev.target.value })} />
      </Field>
      <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
        <div>
          <p className="text-sm font-medium">Approve registrations</p>
          <p className="text-xs text-muted-foreground">When off, eligible people join as soon as they register.</p>
        </div>
        <Switch checked={value.requiresApproval} onCheckedChange={(c) => onChange({ ...value, requiresApproval: c })} />
      </div>
      <Field label="Who can join" className="sm:col-span-2" hint="Participation is never limited to one university unless you choose so.">
        <Select value={e.mode} onValueChange={(v) => setE({ mode: v as RegistrationValue["eligibility"]["mode"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(ELIGIBILITY_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {e.mode === "INSTITUTIONS" && (
        <div className="space-y-2 sm:col-span-2">
          <Label>Institutions</Label>
          {institutions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No institutions are registered on Menty yet.</p>
          ) : (
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
              {institutions.map((i) => (
                <label key={i.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={e.institutionIds.includes(i.id)}
                    onChange={(ev) =>
                      setE({
                        institutionIds: ev.target.checked ? [...e.institutionIds, i.id] : e.institutionIds.filter((x) => x !== i.id),
                      })
                    }
                  />
                  {i.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {e.mode === "DEPARTMENTS" && (
        <Field label="Departments" hint="Comma-separated." className="sm:col-span-2">
          <Input value={e.departments} onChange={(ev) => setE({ departments: ev.target.value })} />
        </Field>
      )}
      {e.mode === "YEARS_OF_STUDY" && (
        <div className="space-y-2 sm:col-span-2">
          <Label>Years of study</Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <label key={y} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={e.yearsOfStudy.includes(y)}
                  onChange={(ev) =>
                    setE({ yearsOfStudy: ev.target.checked ? [...e.yearsOfStudy, y].sort() : e.yearsOfStudy.filter((x) => x !== y) })
                  }
                />
                Year {y}
              </label>
            ))}
          </div>
        </div>
      )}
      {(e.mode === "CUSTOM" || e.mode === "INVITE_ONLY") && (
        <Field label={e.mode === "CUSTOM" ? "Eligibility criteria" : "Note for applicants"} className="sm:col-span-2">
          <Textarea value={e.note} onChange={(ev) => setE({ note: ev.target.value })} rows={3} maxLength={1000} />
        </Field>
      )}
      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground sm:col-span-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Custom registration forms for mentors, mentees and presenters are built in the next release. These eligibility rules are saved now and enforced when registration opens.
      </p>
      <Field label="Career interests" hint="Comma-separated tags that help people find the programme." className="sm:col-span-2">
        <Input value={value.careerTags} onChange={(ev) => onChange({ ...value, careerTags: ev.target.value })} placeholder="e.g. Software, Civil engineering, Research" />
      </Field>
    </div>
  );
}

export function CommunicationsFields({ value, onChange }: { value: { contactEmail: string }; onChange: (v: { contactEmail: string }) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Programme contact email" hint="Shown on the public page and used as the reply-to address on programme emails.">
        <Input type="email" value={value.contactEmail} onChange={(e) => onChange({ contactEmail: e.target.value })} placeholder="coordinator@example.org" />
      </Field>
      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Branded email templates, verified sender addresses, Zoom and automatic reminders are configured here once those releases are live.
      </p>
    </div>
  );
}
