"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { announcementSchema, type AnnouncementInput } from "@/lib/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface ChunkResponse {
  sent: number;
  failed: number;
  failuresThisChunk: { email: string; error: string }[];
  total: number;
  nextOffset: number | null;
  done: boolean;
  error?: string;
}

interface SendResult {
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
}

export function AnnouncementForm() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(
    null
  );
  const [result, setResult] = useState<SendResult | null>(null);

  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "", audience: "ALL", sendEmail: true },
  });

  const onSubmit = async (values: AnnouncementInput) => {
    setResult(null);
    setSending(true);

    try {
      const createRes = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const createData = (await createRes.json().catch(() => ({}))) as {
        announcement?: { id: string };
        error?: string;
      };
      if (!createRes.ok || !createData.announcement) {
        toast.error(createData.error ?? "Failed to publish announcement");
        return;
      }
      toast.success("Announcement published");
      form.reset({ title: "", body: "", audience: "ALL", sendEmail: true });
      router.refresh();

      if (!values.sendEmail) return;

      let offset = 0;
      let sent = 0;
      let failed = 0;
      let failures: { email: string; error: string }[] = [];

      for (;;) {
        const res = await fetch(
          `/api/admin/announcements/${createData.announcement.id}/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offset,
              runningSent: sent,
              runningFailed: failed,
              runningFailedEmails: failures.map((f) => f.email).slice(0, 50),
            }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as ChunkResponse;

        if (!res.ok) {
          toast.error(
            data.error ?? `Emailing stopped after ${sent + failed} of ${progress?.total ?? "?"}.`
          );
          break;
        }

        sent = data.sent;
        failed = data.failed;
        failures = [...failures, ...data.failuresThisChunk];
        setProgress({ sent, failed, total: data.total });

        if (data.done || data.nextOffset === null) {
          setResult({ sent, failed, failures });
          break;
        }
        offset = data.nextOffset;
      }
    } catch {
      toast.error("Something went wrong while sending.");
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const copyFailed = async () => {
    if (!result?.failures.length) return;
    await navigator.clipboard.writeText(result.failures.map((f) => f.email).join(", "));
    toast.success("Failed addresses copied");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> New announcement
        </CardTitle>
        <CardDescription>
          Shown on dashboards; optionally emailed to the audience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Midterm check-in week" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="audience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audience</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALL">Everyone</SelectItem>
                      <SelectItem value="MENTORS">Mentors only</SelectItem>
                      <SelectItem value="MENTEES">Mentees only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sendEmail"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Also send as email</FormLabel>
                    <FormDescription>Via Hostinger SMTP.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish
            </Button>
            {sending && progress && (
              <p className="text-sm text-muted-foreground">
                Emailing… {progress.sent + progress.failed} of {progress.total}
              </p>
            )}
          </form>
        </Form>

        {result && (
          <div className="mt-4 space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{result.sent} emailed</Badge>
              {result.failed > 0 && (
                <Badge variant="destructive">{result.failed} failed</Badge>
              )}
            </div>
            {result.failures.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    These addresses didn&apos;t get the email (already retried once):
                  </p>
                  <Button size="sm" variant="outline" onClick={() => void copyFailed()}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md bg-muted/50 p-3 text-xs">
                  {result.failures.map((f) => (
                    <div key={f.email} className="py-0.5">
                      <span className="font-medium">{f.email}</span>{" "}
                      <span className="text-muted-foreground">— {f.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
