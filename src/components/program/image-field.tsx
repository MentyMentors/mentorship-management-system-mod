"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Image picker: upload (when the programme/institution already exists and
 * storage is configured) or paste an https:// address.
 */
export function ImageField({
  label,
  hint,
  value,
  onChange,
  upload,
}: {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  /** Present when uploads are possible: target + record id. */
  upload?: { target: "program-logo" | "program-cover" | "institution-logo" | "institution-cover"; id: string };
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    if (!upload) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("target", upload.target);
      form.set("id", upload.id);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
      toast.success("Image uploaded — remember to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageUp className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="https://…"
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value.trim() || null)}
            />
            {value && (
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Remove image">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {upload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                Upload image
              </Button>
            </>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
