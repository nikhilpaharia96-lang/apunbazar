import { useEffect, useMemo, useRef, useState } from "react";
import "./floating-leaves.css";

/**
 * FloatingLeaves — cinematic, subtle falling-leaves layer.
 *
 * Drop it inside any `position: relative` container; it fills that container, sits behind the hero text and never captures pointer events.
 *
 * How it works (no per-frame JS animation):
 *  - Every leaf is 4 nested elements, each animated by its own CSS keyframes with different
 *    durations, so the combined motion never visibly repeats:
 *      .leaf        – parallax offset (reads --sy, written once per frame on scroll)
 *      .leaf__fall  – falls top → bottom with a left→right wind drift (transform + opacity)
 *      .leaf__sway  – gentle side-to-side swing + rotation
 *      .leaf__img   – optional slow spin, blur for depth
 *  - Leaves come in 3 depth layers: far (soft clusters), mid, near (large, blurred, fast).
 *  - Paused while off-screen; hidden entirely for `prefers-reduced-motion`.
 *
 * Images live in `src/assets/leaves/` (leaf-group-*.webp, leaf-single-*.webp). They are picked up
 * with import.meta.glob, so a missing folder/file just means fewer (or no) leaves — never a
 * broken image or a build error.
 */

const modules = import.meta.glob("../assets/leaves/*.webp", { eager: true, import: "default" }) as Record<string, string>;
const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));
const GROUPS = entries.filter(([p]) => p.includes("leaf-group")).map(([, url]) => url);
const SINGLES = entries.filter(([p]) => p.includes("leaf-single")).map(([, url]) => url);

type Layer = "far" | "mid" | "near";

interface LeafSpec {
  id: string;
  src: string;
  x: number; // % from left
  size: number; // px
  duration: number; // s – fall
  delay: number; // s
  drift: number; // vw – wind, left → right
  sway: number; // px
  swayDuration: number; // s
  swayDelay: number; // s
  rot: number; // deg – sway rotation
  spin: number; // s – 0 = no spin
  blur: number; // px
  opacity: number;
  par: number; // parallax factor (<0 moves up faster than the page, >0 slower)
  flip: 1 | -1;
}

// Small deterministic PRNG so the arrangement is stable between renders but still irregular.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLeaves(compact: boolean, density: number): LeafSpec[] {
  if (GROUPS.length + SINGLES.length === 0) return [];
  const rand = mulberry32(20260427);
  const range = (min: number, max: number) => min + rand() * (max - min);
  const pick = <T,>(list: T[], i: number) => list[(i + Math.floor(rand() * list.length)) % list.length];
  const scale = compact ? 0.7 : 1;
  const count = (n: number) => Math.max(1, Math.round(n * density));

  const layers: { layer: Layer; n: number }[] = [
    { layer: "far", n: count(compact ? 2 : 3) },
    { layer: "mid", n: count(compact ? 3 : 5) },
    { layer: "near", n: count(compact ? 1 : 3) },
  ];

  const leaves: LeafSpec[] = [];
  let seq = 0;
  for (const { layer, n } of layers) {
    for (let i = 0; i < n; i++) {
      const pool = layer === "far" ? (GROUPS.length ? GROUPS : SINGLES) : SINGLES.length ? SINGLES : GROUPS;
      const src = pick(pool, i);
      const base = {
        far: { size: [230, 340], dur: [30, 42], op: [0.32, 0.5], blur: [0, 1], par: [0.12, 0.22], drift: [8, 16], sway: [18, 34] },
        mid: { size: [34, 64], dur: [20, 30], op: [0.55, 0.8], blur: [0, 1.2], par: [-0.1, 0.05], drift: [10, 22], sway: [22, 46] },
        near: { size: [92, 150], dur: [13, 19], op: [0.4, 0.58], blur: [3, 5], par: [-0.42, -0.28], drift: [14, 26], sway: [30, 60] },
      }[layer];
      const duration = range(base.dur[0], base.dur[1]);
      leaves.push({
        id: `${layer}-${seq++}`,
        src,
        x: ((i + rand() * 0.8) / n) * 100 - 8, // spread across the width, start a little left of the edge (wind goes right)
        size: Math.round(range(base.size[0], base.size[1]) * scale),
        duration,
        delay: range(0.4, 9),
        drift: range(base.drift[0], base.drift[1]),
        sway: range(base.sway[0], base.sway[1]) * scale,
        swayDuration: range(4.5, 9),
        swayDelay: -range(0, 6),
        rot: range(14, 42),
        spin: layer !== "far" && rand() > 0.5 ? range(18, 40) : 0,
        blur: range(base.blur[0], base.blur[1]),
        opacity: range(base.op[0], base.op[1]) * (compact ? 0.85 : 1),
        par: range(base.par[0], base.par[1]),
        flip: rand() > 0.5 ? 1 : -1,
      });
    }
  }
  return leaves;
}

interface FloatingLeavesProps {
  /** Multiplier for the number of leaves (0.5 = half, 1.5 = 50% more). */
  density?: number;
  className?: string;
}

export default function FloatingLeaves({ density = 1, className = "" }: FloatingLeavesProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  // Track viewport size / reduced-motion preference changes.
  useEffect(() => {
    const mqSmall = window.matchMedia("(max-width: 767px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onSmall = () => setCompact(mqSmall.matches);
    const onMotion = () => setReduced(mqMotion.matches);
    mqSmall.addEventListener("change", onSmall);
    mqMotion.addEventListener("change", onMotion);
    return () => {
      mqSmall.removeEventListener("change", onSmall);
      mqMotion.removeEventListener("change", onMotion);
    };
  }, []);

  const leaves = useMemo(() => buildLeaves(compact, density), [compact, density]);

  // Scroll parallax (one CSS-variable write per animation frame) + pause when off-screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    let frame = 0;
    let visible = true;
    const update = () => {
      frame = 0;
      root.style.setProperty("--sy", String(Math.round(Math.min(window.scrollY, 1600))));
    };
    const onScroll = () => {
      if (!visible || frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        root.dataset.paused = visible ? "false" : "true";
        if (visible) onScroll();
      },
      { threshold: 0 },
    );
    io.observe(root);

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  if (reduced || leaves.length === 0) return null;

  return (
    <div ref={rootRef} className={`floating-leaves ${className}`} aria-hidden="true" data-paused="false">
      {leaves.map((leaf) =>
        failed.has(leaf.src) ? null : (
          <div
            key={leaf.id}
            className="leaf"
            style={
              {
                "--x": `${leaf.x.toFixed(2)}%`,
                "--size": `${leaf.size}px`,
                "--par": leaf.par.toFixed(3),
                "--dur": `${leaf.duration.toFixed(2)}s`,
                "--delay": `${leaf.delay.toFixed(2)}s`,
                "--drift": `${leaf.drift.toFixed(1)}vw`,
                "--sway": `${leaf.sway.toFixed(1)}px`,
                "--sway-dur": `${leaf.swayDuration.toFixed(2)}s`,
                "--sway-delay": `${leaf.swayDelay.toFixed(2)}s`,
                "--rot": `${leaf.rot.toFixed(1)}deg`,
                "--spin": `${leaf.spin.toFixed(1)}s`,
                "--blur": `${leaf.blur.toFixed(1)}px`,
                "--o": leaf.opacity.toFixed(2),
                "--flip": leaf.flip,
              } as React.CSSProperties
            }
          >
            <div className="leaf__fall">
              <div className="leaf__sway">
                <img
                  className={`leaf__img${leaf.spin ? " leaf__img--spin" : ""}`}
                  src={leaf.src}
                  alt=""
                  decoding="async"
                  draggable={false}
                  onError={() => setFailed((prev) => new Set(prev).add(leaf.src))}
                />
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
