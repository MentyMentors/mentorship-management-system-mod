"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useApiAction } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BasicsFields,
  CommunicationsFields,
  DEFAULT_DELIVERY,
  DEFAULT_REGISTRATION,
  DeliveryFields,
  EMPTY_BASICS,
  RegistrationFields,
  basicsPayload,
  registrationPayload,
  type BasicsValue,
  type DeliveryValue,
  type RegistrationValue,
} from "@/components/program/program-fields";
import { DEFAULT_THEME_VALUE, ThemeEditor, themeIssuesFor, type ThemeValue } from "@/components/program/theme-editor";
import { ImageField } from "@/components/program/image-field";
import { ProgramThemeScope } from "@/components/program/theme-scope";
import { ProgramButton, ProgramHero } from "@/components/program/program-hero";
import { DELIVERY_MODEL_LABEL, ELIGIBILITY_LABEL, VISIBILITY_LABEL } from "@/components/program/labels";
import { buildTheme } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Branding", "Mentorship model", "Registration", "Communications", "Preview"] as const;

type Owner = { type: "INDEPENDENT" } | { type: "PLATFORM" } | { type: "INSTITUTION"; institutionId: string };

export function ProgramWizard({
  hostOptions,
  canCreatePlatform,
  allInstitutions,
  userName,
}: {
  /** Institutions the user may create programmes for. */
  hostOptions: { id: string; name: string }[];
  canCreatePlatform: boolean;
  /** Every active institution (eligibility picker). */
  allInstitutions: { id: string; name: string }[];
  userName: string;
}) {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [step, setStep] = useState(0);
  const [owner, setOwner] = useState<Owner>(
    hostOptions[0] ? { type: "INSTITUTION", institutionId: hostOptions[0].id } : { type: "INDEPENDENT" }
  );
  const [coordinateMyself, setCoordinateMyself] = useState(true);
  const [basics, setBasics] = useState<BasicsValue>(EMPTY_BASICS);
  const [assets, setAssets] = useState<{ logoUrl: string | null; coverImageUrl: string | null }>({ logoUrl: null, coverImageUrl: null });
  const [theme, setTheme] = useState<ThemeValue>(DEFAULT_THEME_VALUE);
  const [delivery, setDelivery] = useState<DeliveryValue>(DEFAULT_DELIVERY);
  const [registration, setRegistration] = useState<RegistrationValue>(DEFAULT_REGISTRATION);
  const [communications, setCommunications] = useState({ contactEmail: "" });

  const hostName =
    owner.type === "INSTITUTION"
      ? hostOptions.find((h) => h.id === owner.institutionId)?.name
      : owner.type === "PLATFORM"
        ? "Menty"
        : userName;
  const preview = {
    name: basics.name || "Your programme",
    tagline: basics.tagline,
    logoUrl: assets.logoUrl,
    coverImageUrl: assets.coverImageUrl,
    hostName,
    deliveryModel: delivery.deliveryModel,
    deliveryMode: delivery.deliveryMode,
    durationLabel: basics.durationLabel,
    welcomeMessage: basics.welcomeMessage,
  };

  const blockers: Record<number, string | null> = {
    0: basics.name.trim().length < 3 ? "Give the programme a name (at least 3 characters)." : null,
    1: themeIssuesFor(theme) > 0 ? "Fix the colour contrast warnings first." : null,
  };

  const submit = async () => {
    const data = await run<{ program: { id: string } }>("/api/programs", {
      method: "POST",
      body: JSON.stringify({
        ownerType: owner.type,
        institutionId: owner.type === "INSTITUTION" ? owner.institutionId : undefined,
        coordinateMyself,
        basics: basicsPayload(basics),
        assets,
        theme,
        delivery,
        registration: registrationPayload(registration),
        communications,
      }),
      successMessage: "Programme created as a draft",
    });
    router.push(`/manage/programs/${data.program.id}`);
  };

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step && Object.entries(blockers).some(([k, v]) => Number(k) < i && v)}
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "bg-muted" : "text-muted-foreground"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/20">
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {
              [
                "Who runs the programme and what it is about.",
                "Your programme's own look. Menty's colours stay everywhere else.",
                "How mentorship is delivered. You can change this later.",
                "Who can find the programme and who can join.",
                "How participants reach the programme team.",
                "Check everything, then create the programme as a draft. Nothing is public until you publish.",
              ][step]
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Run by</Label>
                  <Select
                    value={owner.type === "INSTITUTION" ? `inst:${owner.institutionId}` : owner.type}
                    onValueChange={(v) =>
                      setOwner(v.startsWith("inst:") ? { type: "INSTITUTION", institutionId: v.slice(5) } : ({ type: v } as Owner))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {hostOptions.map((h) => (
                        <SelectItem key={h.id} value={`inst:${h.id}`}>{h.name}</SelectItem>
                      ))}
                      <SelectItem value="INDEPENDENT">Me — an independent programme</SelectItem>
                      {canCreatePlatform && <SelectItem value="PLATFORM">Menty (first-party programme)</SelectItem>}
                    </SelectContent>
                  </Select>
                  {owner.type === "INDEPENDENT" && (
                    <p className="text-xs text-muted-foreground">
                      You will own and coordinate it. Independent programmes can ask Menty for verification, and can later move to an institution without losing anyone.
                    </p>
                  )}
                </div>
                {owner.type !== "INDEPENDENT" && (
                  <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                    <div>
                      <p className="text-sm font-medium">I will coordinate this programme</p>
                      <p className="text-xs text-muted-foreground">Turn off if you will appoint someone else as coordinator.</p>
                    </div>
                    <Switch checked={coordinateMyself} onCheckedChange={setCoordinateMyself} />
                  </div>
                )}
              </div>
              <BasicsFields value={basics} onChange={setBasics} />
            </>
          )}
          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageField label="Logo" hint="Square works best. You can upload files after the programme is created." value={assets.logoUrl} onChange={(logoUrl) => setAssets({ ...assets, logoUrl })} />
                <ImageField label="Cover image" hint="Wide image, at least 1200 px across." value={assets.coverImageUrl} onChange={(coverImageUrl) => setAssets({ ...assets, coverImageUrl })} />
              </div>
              <ThemeEditor value={theme} onChange={setTheme} preview={preview} />
            </>
          )}
          {step === 2 && <DeliveryFields value={delivery} onChange={setDelivery} />}
          {step === 3 && <RegistrationFields value={registration} onChange={setRegistration} institutions={allInstitutions} />}
          {step === 4 && <CommunicationsFields value={communications} onChange={setCommunications} />}
          {step === 5 && (
            <div className="space-y-6">
              <ProgramThemeScope
                theme={buildTheme(theme, { radius: theme.radius, appearance: theme.appearance })}
                className="rounded-program p-4"
              >
                <ProgramHero data={preview} cta={<ProgramButton>Join programme</ProgramButton>} />
                {basics.description && <p className="mt-4 whitespace-pre-line text-sm">{basics.description}</p>}
              </ProgramThemeScope>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Run by", hostName],
                  ["Model", DELIVERY_MODEL_LABEL[delivery.deliveryModel]],
                  ["Visibility", VISIBILITY_LABEL[registration.visibility]],
                  ["Who can join", ELIGIBILITY_LABEL[registration.eligibility.mode]],
                  ["Approval", registration.requiresApproval ? "Coordinators approve each registration" : "Automatic"],
                  ["Capacity", registration.capacity || "No limit"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {blockers[step] && <p className="text-sm text-destructive">{blockers[step]}</p>}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={Boolean(blockers[step])}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={pending || Object.values(blockers).some(Boolean)}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create programme
          </Button>
        )}
      </div>
    </div>
  );
}
