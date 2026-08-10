"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { bulkEmailSchema, type BulkEmailInput } from "@/lib/validators";
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

export function BulkEmailForm() {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(
    null
  );
  const [result, setResult] = useState<SendResult | null>(null);

  const form = useForm<BulkEmailInput>({
    resolver: zodResolver(bulkEmailSchema),
    defaultValues: { subject: "", body: "", audience: "ALL" },
  });

  const onSubmit = async (values: BulkEmailInput) => {
    setResult(null);
    setSending(true);

    let offset = 0;
    let sent = 0;
    let failed = 0;
    let failures: { email: string; error: string }[] = [];
    let stoppedEarly = false;

    try {
      for (;;) {
        const res = await fetch("/api/admin/bulk-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            offset,
            runningSent: sent,
            runningFailed: failed,
            runningFailedEmails: failures.map((f) => f.email).slice(0, 50),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as ChunkResponse;

        if (!res.ok) {
          toast.error(
            data.error ?? `Sending stopped after ${sent + failed} of ${progress?.total ?? "?"} — try again to resume.`
          );
          stoppedEarly = true;
          break;
        }

        sent = data.sent;
        failed = data.failed;
        failures = [...failures, ...data.failuresThisChunk];
        setProgress({ sent, failed, total: data.total });

        if (data.done || data.nextOffset === null) break;
        offset = data.nextOffset;
      }

      if (!stoppedEarly) {
        setResult({ sent, failed, failures });
        toast.success(
          failed > 0 ? `Sent ${sent} emails, ${failed} failed` : `Sent ${sent} emails`
        );
        form.reset({ subject: "", body: "", audience: "ALL" });
      }
    } catch {
      toast.error(`Connection lost after ${sent + failed} sent — try again to resume.`);
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
          <Send className="h-5 w-5" /> Bulk email
        </CardTitle>
        <CardDescription>
          One-off email blast to approved mentors and/or mentees.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
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
                  <FormLabel>Recipients</FormLabel>
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
            <Button type="submit" disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send email
            </Button>
            {sending && progress && (
              <p className="text-sm text-muted-foreground">
                Sending… {progress.sent + progress.failed} of {progress.total}
              </p>
            )}
          </form>
        </Form>

        {result && (
          <div className="mt-4 space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{result.sent} sent</Badge>
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
                <div className="max-h-48 overflow-y-auto rounded-md bg-muted/50 p-3 text-xs">
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
