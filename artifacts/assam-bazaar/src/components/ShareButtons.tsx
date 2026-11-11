import { Link2, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  productName: string;
  price: number;
}

export function ShareButtons({ productName, price }: Props) {
  const { toast } = useToast();
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `Check out ${productName} on ApunBazar! ₹${price.toLocaleString("en-IN")} 🛍️`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`;

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied! 🔗" });
    });
  }

  // Use Web Share API on mobile if available
  function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      navigator.share({ title: productName, text, url }).catch(() => {});
    } else {
      copyLink();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium mr-0.5">Share:</span>
      {/* WhatsApp */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity shrink-0"
        style={{ background: "#25D366" }}
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.847L0 24l6.326-1.506A11.926 11.926 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-4.989-1.367l-.358-.213-3.716.885.917-3.617-.233-.372A9.79 9.79 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
        </svg>
      </a>
      {/* Copy / Native Share */}
      <button
        onClick={handleShare}
        aria-label="Copy link"
        className="w-9 h-9 rounded-full border border-[#e3ddd0] bg-white text-[#282c3f] flex items-center justify-center hover:bg-muted transition-colors shrink-0"
      >
        {typeof navigator !== "undefined" && "share" in navigator
          ? <Share2 className="w-4 h-4" />
          : <Link2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
