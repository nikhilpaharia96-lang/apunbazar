// WhatsApp integration components for ApunBazar
// Uses env var: VITE_WHATSAPP_NUMBER (set in .env)

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? "919395722454";

function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// ─── Floating WhatsApp Button (global — add in App.tsx or MainLayout) ──────
export function WhatsAppFloat() {
  return (
    <a
      href={whatsappUrl("Hi! I want to know more about ApunBazar products. 🛍️")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="wa-float fixed bottom-24 right-3 z-40 lg:bottom-8 flex items-center gap-2 p-2.5 sm:px-4 sm:py-3 rounded-full text-white font-semibold shadow-xl hover:scale-105 transition-transform duration-200"
      style={{ background: "#25D366" }}
    >
      <WhatsAppIcon className="w-7 h-7 sm:w-10 sm:h-10" />
      <span className="hidden sm:inline text-sm">Chat with us</span>
    </a>
  );
}

// ─── Product Page — "Order on WhatsApp" button ──────────────────────────────
interface ProductWhatsAppProps {
  productName: string;
  price: number;
}

export function ProductWhatsAppButton({ productName, price }: ProductWhatsAppProps) {
  const msg = `Hi! I want to order:\n*${productName}*\nPrice: ₹${price.toLocaleString("en-IN")}\nPage: ${window.location.href}`;
  return (
    <a
      href={whatsappUrl(msg)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: "#25D366", boxShadow: "0 4px 14px rgba(37,211,102,0.35)" }}
    >
      <WhatsAppIcon className="w-5 h-5" />
      Order on WhatsApp
    </a>
  );
}

// ─── Order Confirmation — Track on WhatsApp ─────────────────────────────────
interface TrackWhatsAppProps {
  orderNumber: string;
}

export function TrackOnWhatsApp({ orderNumber }: TrackWhatsAppProps) {
  const msg = `Hi! I want to track my order: *${orderNumber}*`;
  return (
    <a
      href={whatsappUrl(msg)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-sm"
      style={{ background: "#25D366" }}
    >
      <WhatsAppIcon className="w-4 h-4" />
      Track on WhatsApp
    </a>
  );
}

// ─── SVG Icon (avoids external icon library dependency) ────────────────────
function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.847L0 24l6.326-1.506A11.926 11.926 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-4.989-1.367l-.358-.213-3.716.885.917-3.617-.233-.372A9.79 9.79 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
    </svg>
  );
}
