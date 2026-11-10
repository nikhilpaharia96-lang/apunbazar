/**
 * lib/img.ts — Responsive image attributes.
 * Images we host (/api/uploads/<id>) are served as resized WebP via ?w=; any other URL is untouched.
 */
const WIDTHS = [320, 480, 640, 800, 1000] as const;

export function imgProps(src: string | undefined | null, sizes = "(min-width:1024px) 25vw, 50vw") {
  if (!src) return { src: "" };
  if (!/^\/api\/uploads\/[\w-]+$/.test(src)) return { src };
  return {
    src: `${src}?w=640`,
    srcSet: WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(", "),
    sizes,
  };
}
