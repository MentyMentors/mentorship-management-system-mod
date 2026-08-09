"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Megaphone } from "lucide-react";
import { announcementSchema, type AnnouncementInput } from "@/lib/validators";
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

interface AnnouncementResponse {
  emailResult: { sent: number; failed: number; failures: { email: string; error: string }[] } | null;
}

export function AnnouncementForm() {
  const router = useRouter();
  const { run, pending } = useApiAction();
  const [emailResult, setEmailResult] = useState<AnnouncementResponse["emailResult"]>(null);

  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: "", body: "", audience: "ALL", sendEmail: true },
  });

  const onSubmit = async (values: AnnouncementInput) => {
    setEmailResult(null);
    const data = await run<AnnouncementResponse>("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify(values),
      successMessage: "Announcement published",
    });
    setEmailResult(data.emailResult);
    form.reset({ title: "", body: "", audience: "ALL", sendEmail: true });
    router.refresh();
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
                    <FormDescription>Via Gmail SMTP.</FormDescription>
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish
            </Button>
          </form>
        </Form>

        {emailResult && (
          <div className="mt-4 space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{emailResult.sent} emailed</Badge>
              {emailResult.failed > 0 && (
                <Badge variant="destructive">{emailResult.failed} failed</Badge>
              )}
            </div>
            {emailResult.failures.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md bg-muted/50 p-3 text-xs">
                {emailResult.failures.map((f) => (
                  <div key={f.email} className="py-0.5">
                    <span className="font-medium">{f.email}</span>{" "}
                    <span className="text-muted-foreground">— {f.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
