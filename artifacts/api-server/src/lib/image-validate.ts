/**
 * lib/image-validate.ts — Strict server-side validation of uploaded product images.
 * Never trusts the client's Content-Type or file name: the bytes themselves must be a
 * real JPEG / PNG / WebP with sane dimensions. SVG/GIF/HTML etc. are rejected
 * (SVG can carry scripts).
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MIN_DIMENSION = 200;
export const MAX_DIMENSION = 6000;

export type ImageKind = "image/jpeg" | "image/png" | "image/webp";
export interface ImageInfo { contentType: ImageKind; width: number; height: number }

function jpeg(b: Buffer): { width: number; height: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function png(b: Buffer): { width: number; height: number } | null {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (b.length < 24 || !b.subarray(0, 8).equals(sig) || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function webp(b: Buffer): { width: number; height: number } | null {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const type = b.toString("ascii", 12, 16);
  if (type === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (type === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (type === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  return null;
}

/** Returns image info, or a human-readable error string. */
export function inspectImage(buf: Buffer, declaredType?: string): ImageInfo | string {
  if (buf.length < 100) return "File is empty or too small to be an image.";
  if (buf.length > MAX_IMAGE_BYTES) return `Image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`;

  let contentType: ImageKind | null = null;
  let dims: { width: number; height: number } | null = null;
  if ((dims = jpeg(buf))) contentType = "image/jpeg";
  else if ((dims = png(buf))) contentType = "image/png";
  else if ((dims = webp(buf))) contentType = "image/webp";

  if (!contentType || !dims) return "Only genuine JPEG, PNG or WebP images are allowed.";
  if (declaredType && declaredType.split(";")[0].trim().toLowerCase() !== contentType) {
    return "File content does not match its declared type.";
  }
  if (dims.width < MIN_DIMENSION || dims.height < MIN_DIMENSION) {
    return `Image is too small (minimum ${MIN_DIMENSION}×${MIN_DIMENSION}px).`;
  }
  if (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) {
    return `Image is too large (maximum ${MAX_DIMENSION}×${MAX_DIMENSION}px).`;
  }
  return { contentType, ...dims };
}

/** Accepts only https URLs (no credentials) or an image we host ourselves. */
export function isAllowedImageRef(ref: string): boolean {
  if (ref.length === 0 || ref.length > 2048) return false;
  if (/^\/api\/uploads\/[A-Za-z0-9_-]{10,40}$/.test(ref)) return true;
  try {
    const u = new URL(ref);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".");
  } catch {
    return false;
  }
}
