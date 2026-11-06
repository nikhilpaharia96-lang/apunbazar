/**
 * product-image-slider.tsx
 * Save to: artifacts/assam-bazaar/src/components/product-image-slider.tsx
 */

import { useState, useCallback } from "react";
import { useProductSlider } from "../hooks/use-product-slider";

export interface ProductImageSliderProps {
  images: string[];
  productName: string;
  interval?: number;
  className?: string;
}

const SLIDE_LABELS = ["Front", "Back", "Side"];

function slideLabel(index: number, total: number) {
  return SLIDE_LABELS[index] ?? `${index + 1}/${total}`;
}

export function ProductImageSlider({
  images,
  productName,
  interval = 3000,
  className = "",
}: ProductImageSliderProps) {
  // Broken / 404 images ko hata do taaki card blank na dikhe
  const [failed, setFailed] = useState<string[]>([]);
  const onImgError = useCallback((src: string) => {
    setFailed((prev) => (prev.includes(src) ? prev : [...prev, src]));
  }, []);
  const slides = [...new Set(images.filter(Boolean))].filter((u) => !failed.includes(u));

  if (slides.length <= 1) {
    return (
      <div style={rootStyle} className={className}>
        <style>{keyframeCSS}</style>
        {slides[0] ? (
          <img
            src={slides[0]}
            alt={productName}
            loading="lazy"
            decoding="async"
            style={imgStyle}
            onError={() => onImgError(slides[0])}
          />
        ) : (
          <div
            aria-label={productName}
            style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,#f3efe6,#e8e0cf)",
              color: "#9a8a5c", fontSize: 12, fontWeight: 600, textAlign: "center", padding: 12,
            }}
          >
            ApunBazar
          </div>
        )}
      </div>
    );
  }

  return (
    <MultiSlider
      slides={slides}
      productName={productName}
      interval={interval}
      className={className}
      onImgError={onImgError}
    />
  );
}

function MultiSlider({
  slides,
  productName,
  interval,
  className,
  onImgError,
}: {
  slides: string[];
  productName: string;
  interval: number;
  className: string;
  onImgError: (src: string) => void;
}) {
  const {
    current,
    prev,
    direction,
    paused,
    setPaused,
    advance,
    goTo,
    onTouchStart,
    onTouchEnd,
  } = useProductSlider({ total: slides.length, interval });

  const [loaded, setLoaded] = useState<boolean[]>(() =>
    slides.map((_, i) => i === 0)
  );

  const markLoaded = useCallback((i: number) => {
    setLoaded((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
  }, []);

  // Eagerly queue next image
  const nextIdx = (current + 1) % slides.length;
  if (!loaded[nextIdx]) {
    setTimeout(() =>
      setLoaded((prev) => {
        const copy = [...prev];
        copy[nextIdx] = true;
        return copy;
      }), 0
    );
  }

  return (
    <>
      <style>{keyframeCSS}</style>
      <div
        className={className}
        style={{ ...rootStyle, cursor: "grab" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="region"
        aria-label={`${productName} image gallery`}
      >
        {/* Images */}
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {slides.map((src, i) => {
            const isActive = i === current;
            const isLeaving = i === prev;
            if (!isActive && !isLeaving) return null;

            let animName = "";
            if (isActive)
              animName = direction === "left" ? "pis-enter-l" : "pis-enter-r";
            else
              animName = direction === "left" ? "pis-exit-l" : "pis-exit-r";

            return (
              <img
                key={src}
                src={loaded[i] ? src : undefined}
                alt={`${productName} — ${slideLabel(i, slides.length)}`}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                style={{
                  ...imgStyle,
                  animation: `${animName} 0.42s cubic-bezier(0.22,1,0.36,1) forwards`,
                  zIndex: isActive ? 2 : 1,
                }}
                onLoad={() => markLoaded(i)}
                onError={() => onImgError(src)}
              />
            );
          })}
        </div>

        {/* Label badge */}
        <span
          key={`lbl-${current}`}
          style={{
            position: "absolute",
            top: 9,
            left: 9,
            zIndex: 10,
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.5)",
            color: "#2d4a2d",
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "3px 9px",
            borderRadius: 99,
            pointerEvents: "none",
            animation: "pis-fade-in 0.3s ease",
          }}
        >
          {slideLabel(current, slides.length)}
        </span>

        {/* Dot indicators */}
        <div
          style={{
            position: "absolute",
            bottom: 9,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            gap: 5,
            alignItems: "center",
          }}
          role="tablist"
        >
          {slides.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={`Go to ${slideLabel(i, slides.length)}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(i);
              }}
              style={{
                width: i === current ? 18 : 6,
                height: 6,
                borderRadius: i === current ? 4 : "50%",
                background:
                  i === current ? "#2d4a2d" : "rgba(255,255,255,0.6)",
                border: "1.5px solid rgba(45,74,45,0.3)",
                padding: 0,
                cursor: "pointer",
                outline: "none",
                transition:
                  "width 0.25s ease, background 0.25s ease, border-radius 0.25s ease",
              }}
            />
          ))}
        </div>

        {/* Progress bar */}
        {!paused && (
          <div
            key={`pb-${current}`}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              background: "#2d4a2d",
              transformOrigin: "left center",
              animation: `pis-progress ${interval}ms linear forwards`,
              zIndex: 10,
              opacity: 0.7,
            }}
          />
        )}

        {/* Invisible tap zones for prev/next */}
        <button
          aria-label="Previous image"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            advance(-1);
          }}
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: "30%", zIndex: 8,
            background: "transparent", border: "none", cursor: "pointer", outline: "none",
          }}
        />
        <button
          aria-label="Next image"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            advance(1);
          }}
          style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width: "30%", zIndex: 8,
            background: "transparent", border: "none", cursor: "pointer", outline: "none",
          }}
        />
      </div>
    </>
  );
}

const rootStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  overflow: "hidden",
  background: "#f8f5f0",
  aspectRatio: "1 / 1",
  borderRadius: "inherit",
};

const imgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  objectPosition: "center",
  pointerEvents: "none",
  userSelect: "none",
  willChange: "transform, opacity",
};

const keyframeCSS = `
@keyframes pis-enter-l {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes pis-enter-r {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
@keyframes pis-exit-l {
  from { transform: translateX(0);     opacity: 1; }
  to   { transform: translateX(-100%); opacity: 0; }
}
@keyframes pis-exit-r {
  from { transform: translateX(0);    opacity: 1; }
  to   { transform: translateX(100%); opacity: 0; }
}
@keyframes pis-progress {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes pis-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
`;