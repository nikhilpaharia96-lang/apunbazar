import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const G = "#1a5a32";
const DISMISS_KEY = "ab_install_last_shown_at";
const INSTALLED_KEY = "ab_installed";
const SILENT_HOURS = 24; // ek baar dikhne ke baad 24 ghante tak dobara nahi
const SHOW_DELAY_MS = 3000;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

function shouldStaySilent() {
  try {
    if (localStorage.getItem(INSTALLED_KEY)) return true;
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return !!t && Date.now() - t < SILENT_HOURS * 3600000;
  } catch {
    return false;
  }
}

export default function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || shouldStaySilent()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setVisible(false);
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    const t = setTimeout(() => {
      setVisible(true);
      // Popup dikhte hi time save karo — 24 ghante baad hi dobara aayega
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    }, SHOW_DELAY_MS);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Banner dikhte waqt WhatsApp button ko upar shift karne ke liye (overlap nahi hoga)
  const shown = visible && (!!deferred || isMobile());
  useEffect(() => {
    const el = document.documentElement;
    if (shown) el.setAttribute("data-install-banner", "1");
    else el.removeAttribute("data-install-banner");
    return () => el.removeAttribute("data-install-banner");
  }, [shown]);

  const close = () => {
    setVisible(false);
    setShowHelp(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        if (outcome === "accepted") setVisible(false);
        else close();
      } catch {
        setShowHelp(true);
      }
    } else {
      // Prompt available nahi (iOS Safari, Firefox, in-app browsers) — manual steps dikhao
      setShowHelp((v) => !v);
    }
  };

  if (!shown) return null;

  return (
    <div
      role="region"
      aria-label="ApunBazar app download"
      className="fixed z-50 left-2.5 right-2.5 bottom-[calc(env(safe-area-inset-bottom)+68px)] lg:left-6 lg:right-auto lg:bottom-8 lg:w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300 motion-reduce:animate-none"
    >
      {showHelp && (
        <p
          role="status"
          className="absolute bottom-full mb-2 left-0 right-0 rounded-xl bg-white px-3 py-2 text-xs leading-snug text-neutral-700 shadow-lg"
        >
          {isIOS() ? (
            <>Safari mein <b>Share</b> (⬆️) dabayein, phir <b>“Add to Home Screen”</b> chunein.</>
          ) : (
            <>Browser menu (⋮) kholein, phir <b>“Install app”</b> ya <b>“Add to Home screen”</b> chunein.</>
          )}
        </p>
      )}

      <div
        className="relative overflow-hidden rounded-[20px] bg-white"
        style={{
          boxShadow: "0 8px 28px rgba(16,56,30,.22), 0 2px 6px rgba(0,0,0,.08)",
          border: "1px solid rgba(26,90,50,.10)",
        }}
      >
        {/* Decorative Assam tea-garden art */}
        <img
          src={`${import.meta.env.BASE_URL}banner-art.webp`}
          alt=""
          aria-hidden="true"
          width={1000}
          height={333}
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-bottom"
        />

        <div className="relative z-10 flex items-center gap-2.5 py-2.5 pl-3 pr-2">
          <img
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt="ApunBazar"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain shadow-md"
          />

          <div className="min-w-0 flex-1">
            <p
              className="flex items-center gap-1.5 text-[14px] font-extrabold leading-tight"
              style={{ color: G }}
            >
              ApunBazar App
              <span className="hidden min-[360px]:inline-block rounded-md bg-orange-500 px-1.5 py-[1px] text-[9px] font-bold tracking-wide text-white">
                NEW
              </span>
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
              Download karein — tez shopping, aasan orders
            </p>
          </div>

          <button
            onClick={install}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-white shadow-md active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: `linear-gradient(180deg, #23803f, ${G})`, outlineColor: G }}
          >
            <Download size={15} aria-hidden="true" />
            Install
          </button>

          <button
            onClick={close}
            aria-label="Banner band karein"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100/90 text-neutral-800 active:scale-95 focus-visible:outline focus-visible:outline-2"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
