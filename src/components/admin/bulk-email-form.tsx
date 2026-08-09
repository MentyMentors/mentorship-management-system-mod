"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { bulkEmailSchema, type BulkEmailInput } from "@/lib/validators";
import { useApiAction } from "@/hooks/use-api";
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

interface BulkEmailResult {
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
}

export function BulkEmailForm() {
  const { run, pending } = useApiAction();
  const [result, setResult] = useState<BulkEmailResult | null>(null);

  const form = useForm<BulkEmailInput>({
    resolver: zodResolver(bulkEmailSchema),
    defaultValues: { subject: "", body: "", audience: "ALL" },
  });

  const onSubmit = async (values: BulkEmailInput) => {
    setResult(null);
    const data = await run<BulkEmailResult>("/api/admin/bulk-email", {
      method: "POST",
      body: JSON.stringify(values),
    });
    setResult(data);
    form.reset({ subject: "", body: "", audience: "ALL" });
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send email
            </Button>
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
