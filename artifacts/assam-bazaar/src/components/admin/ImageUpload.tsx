import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getBestAuthToken } from "@/lib/api";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX = 3 * 1024 * 1024;

/**
 * Uploads a product image to POST /api/uploads/product-image. The browser pre-checks type and size
 * for a quick message; the server re-validates the actual bytes, dimensions and type.
 */
export function ImageUploadButton({ onUploaded, label = "Upload image" }: { onUploaded: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) { toast({ title: "Unsupported file", description: "Use a JPEG, PNG or WebP image.", variant: "destructive" }); return; }
    if (file.size > MAX) { toast({ title: "Image too large", description: "Maximum size is 3 MB.", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const token = getBestAuthToken();
      const res = await fetch("/api/uploads/product-image", {
        method: "POST",
        headers: { "Content-Type": file.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: file,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Upload failed");
      onUploaded((body as { url: string }).url);
      toast({ title: "Image uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input ref={input} type="file" accept={TYPES.join(",")} className="sr-only" aria-label={label} onChange={(e) => onFile(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{busy ? "Uploading…" : label}
      </Button>
    </>
  );
}
