import { useEffect, useState } from "react";

const G = "#1a5a32";
const GOLD = "#c9a84c";
const DISMISS_KEY = "ab_install_dismissed_at";
const DISMISS_DAYS = 7;

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

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function recentlyDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return t && Date.now() - t < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

export default function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const ios = typeof navigator !== "undefined" && isIOS();

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // 3 sec baad dikhao (iOS pe beforeinstallprompt nahi aata, isliye seedha)
    const t = setTimeout(() => setVisible(true), 3000);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === "accepted") setVisible(false);
      else close();
    } else if (ios) {
      setShowIOSHelp((v) => !v);
    }
  };

  // Sirf tab dikhao jab install possible ho (Chrome/Edge/Android) ya iOS
  if (!visible || (!deferred && !ios)) return null;

  return (
    <div
      role="dialog"
      aria-label="ApunBazar app download karein"
      className="fixed left-3 bottom-[76px] lg:left-6 lg:bottom-8 z-50 w-[min(320px,calc(100vw-24px))] animate-in slide-in-from-left-8 fade-in duration-500"
    >
      <div
        className="relative flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-2xl"
        style={{ border: `1px solid ${GOLD}55` }}
      >
        <button
          onClick={close}
          aria-label="Band karein"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-neutral-800 text-white text-sm leading-none flex items-center justify-center"
        >
          ×
        </button>

        <img
          src={`${import.meta.env.BASE_URL}icon-192.png`}
          alt="ApunBazar"
          className="h-12 w-12 rounded-xl object-contain border border-neutral-200"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight" style={{ color: G }}>
            ApunBazar App
          </p>
          <p className="text-xs text-neutral-600 leading-snug">
            Download karein — tez shopping, aasan orders
          </p>
        </div>

        <button
          onClick={install}
          className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white"
          style={{ background: G }}
        >
          {deferred ? "Install" : "Kaise?"}
        </button>
      </div>

      {showIOSHelp && (
        <p className="mt-2 rounded-xl bg-white p-3 text-xs text-neutral-700 shadow-lg">
          Safari mein neeche <b>Share</b> (⬆️) dabayein, phir{" "}
          <b>“Add to Home Screen”</b> chunein.
        </p>
      )}
    </div>
  );
}
