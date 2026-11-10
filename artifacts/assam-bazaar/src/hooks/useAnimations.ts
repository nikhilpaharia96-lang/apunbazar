// ============================================================
//  useAnimations.ts
//  Drop in: artifacts/assam-bazaar/src/hooks/useAnimations.ts
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";

// ── 1. Scroll Reveal ─────────────────────────────────────────
// Usage:
//   const ref = useScrollReveal();
//   <div ref={ref} className="reveal fade-in-up">...</div>
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px", ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

// ── 2. Staggered Scroll Reveal (for grids/lists) ─────────────
// Usage:
//   const containerRef = useStaggerReveal();
//   <div ref={containerRef} className="stagger">
//     {items.map(i => <div className="reveal fade-in-up">...</div>)}
//   </div>
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const children = Array.from(container.querySelectorAll<HTMLElement>(".reveal"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px", ...options }
    );

    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  return ref;
}

// ── 3. Page Transition ────────────────────────────────────────
// Usage:
//   const { pageClass, navigateTo } = usePageTransition();
//   <div className={pageClass}>...</div>
//   navigateTo('/some-route', setLocation);
export function usePageTransition() {
  const [pageClass, setPageClass] = useState("page-enter");

  const navigateTo = useCallback(
    (path: string, setLocation: (path: string) => void) => {
      setPageClass("page-exit");
      setTimeout(() => {
        setLocation(path);
        setPageClass("page-enter");
      }, 200);
    },
    []
  );

  return { pageClass, navigateTo };
}

// ── 4. Add-to-Cart Animation ──────────────────────────────────
// Usage:
//   const { isAdded, triggerCart } = useCartAnimation();
//   <button
//     onClick={() => { triggerCart(); addToCart(product); }}
//     className={isAdded ? 'btn-cart-added' : ''}
//   >
//     {isAdded ? '✓ Added!' : 'Add to Cart'}
//   </button>
export function useCartAnimation(durationMs = 1200) {
  const [isAdded, setIsAdded] = useState(false);

  const triggerCart = useCallback(() => {
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), durationMs);
  }, [durationMs]);

  return { isAdded, triggerCart };
}

// ── 5. Wishlist Heart Animation ───────────────────────────────
// Usage:
//   const { isWishlisted, toggleWishlist } = useWishlistAnimation();
//   <button
//     onClick={toggleWishlist}
//     className={isWishlisted ? 'heart-beat text-red-500' : 'text-gray-600'}
//   >
//     ♥
//   </button>
export function useWishlistAnimation(initial = false) {
  const [isWishlisted, setIsWishlisted] = useState(initial);
  const [animKey, setAnimKey] = useState(0);

  const toggleWishlist = useCallback(() => {
    setIsWishlisted((v) => !v);
    setAnimKey((k) => k + 1);
  }, []);

  return { isWishlisted, toggleWishlist, animKey };
}

// ── 6. Number Counter (for stats section) ────────────────────
// Usage:
//   const count = useCountUp(1500, 2000); // target, duration ms
//   <span>{count}+</span>
export function useCountUp(target: number, durationMs = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
          setCount(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, durationMs]);

  return { count, ref };
}

// ── 7. Parallax on Scroll ────────────────────────────────────
// Usage:
//   const { ref, style } = useParallax(0.3); // speed 0–1
//   <div ref={ref} style={style}>...</div>
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  speed = 0.3
) {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2 - window.innerHeight / 2;
      setOffset(centerY * speed);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [speed]);

  return {
    ref,
    style: { transform: `translateY(${offset}px)` },
  };
}

// ── 8. Magnetic Button ────────────────────────────────────────
// Usage:
//   const { ref, style } = useMagnetic(0.3);
//   <button ref={ref} style={style}>...</button>
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(
  strength = 0.3
) {
  const ref = useRef<T>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      setPos({ x: (e.clientX - cx) * strength, y: (e.clientY - cy) * strength });
    };
    const onLeave = () => setPos({ x: 0, y: 0 });

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return {
    ref,
    style: {
      transform: `translate(${pos.x}px, ${pos.y}px)`,
      transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
    },
  };
}

// ── 9. Loading Screen ─────────────────────────────────────────
// Usage:
//   const { isLoading, fadeClass } = useLoadingScreen(1200);
//   {isLoading && <LoadingScreen className={fadeClass} />}
export function useLoadingScreen(minDurationMs = 1000) {
  const [isLoading, setIsLoading] = useState(true);
  const [fadeClass, setFadeClass] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeClass("loader-fade-out");
      setTimeout(() => setIsLoading(false), 400);
    }, minDurationMs);
    return () => clearTimeout(timer);
  }, [minDurationMs]);

  return { isLoading, fadeClass };
}

// ── 10. Swipe Detection (Mobile) ──────────────────────────────
// Usage:
//   const { ref } = useSwipe({ onSwipeLeft: nextSlide, onSwipeRight: prevSlide });
//   <div ref={ref}>...</div>
interface SwipeHandlers {
  onSwipeLeft?:  () => void;
  onSwipeRight?: () => void;
  onSwipeUp?:    () => void;
  onSwipeDown?:  () => void;
  threshold?: number;
}

export function useSwipe<T extends HTMLElement = HTMLDivElement>(
  handlers: SwipeHandlers
) {
  const ref = useRef<T>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const threshold = handlers.threshold ?? 50;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!startPos.current) return;
      const dx = e.changedTouches[0].clientX - startPos.current.x;
      const dy = e.changedTouches[0].clientY - startPos.current.y;
      startPos.current = null;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > threshold)  handlers.onSwipeRight?.();
        if (dx < -threshold) handlers.onSwipeLeft?.();
      } else {
        if (dy > threshold)  handlers.onSwipeDown?.();
        if (dy < -threshold) handlers.onSwipeUp?.();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [handlers, threshold]);

  return { ref };
}