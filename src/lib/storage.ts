import { put } from "@vercel/blob";

/**
 * File storage for programme and institution images (Vercel Blob).
 * Server-only: BLOB_READ_WRITE_TOKEN never reaches the browser. When it is
 * not configured, uploads are refused and the UI falls back to pasting an
 * https:// image address.
 */

export function storageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export const IMAGE_LIMITS = {
  logo: 2 * 1024 * 1024,
  cover: 5 * 1024 * 1024,
} as const;

const SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/gif", ext: "gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/**
 * Identifies an image from its first bytes, ignoring the client's claimed
 * type. SVG is deliberately not accepted (it can carry script).
 */
export function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  const match = SIGNATURES.find((s) => bytes.length >= 12 && s.test(bytes));
  return match ? { type: match.type, ext: match.ext } : null;
}

export async function storeImage(pathPrefix: string, file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`Image is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new Error("Upload a PNG, JPEG, GIF or WebP image.");
  const blob = await put(`${pathPrefix}.${kind.ext}`, Buffer.from(bytes), {
    access: "public",
    contentType: kind.type,
    addRandomSuffix: true,
  });
  return blob.url;
}
