import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Review {
  id: string;
  productId: number;
  name: string;
  email?: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  helpful: number;
  images?: string[];
}

interface ReviewSystemProps {
  productId: number;
  productName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avg(reviews: Review[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}
function countByRating(reviews: Review[], r: number) {
  return reviews.filter(rv => rv.rating === r).length;
}
function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// ─── Star Input ───────────────────────────────────────────────────────────────
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, fontSize: 28, color: i <= (hover || value) ? "#f59e0b" : "#e5e7eb", transition: "color .15s, transform .15s", transform: i <= (hover || value) ? "scale(1.15)" : "scale(1)" }}
          aria-label={`${i} star`}
        >★</button>
      ))}
    </div>
  );
}

// ─── Star Display ─────────────────────────────────────────────────────────────
function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= Math.round(rating) ? "#f59e0b" : "#e5e7eb" }}>★</span>
      ))}
    </span>
  );
}

// ─── Rating Bar ───────────────────────────────────────────────────────────────
function RatingBar({ label, count, total, onClick, active }: { label: string; count: number; total: number; onClick: () => void; active: boolean }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "3px 0", borderRadius: 6 }}>
      <span style={{ fontSize: 12, color: active ? "#1a5a32" : "#6b7280", fontWeight: active ? 700 : 400, minWidth: 32, textAlign: "right" }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "#f0ead8", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: active ? "#1a5a32" : "#f59e0b", borderRadius: 4, transition: "width .4s ease" }} />
      </div>
      <span style={{ fontSize: 11, color: "#4b5563", minWidth: 28 }}>{count}</span>
    </button>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────
function ReviewCard({ review, onHelpful }: { review: Review; onHelpful: (id: string) => void }) {
  const [helped, setHelped] = useState(false);
  return (
    <div style={{ background: "#fff", border: "1px solid #f0ead8", borderRadius: 16, padding: "20px 20px 16px", transition: "box-shadow .25s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,.09)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#1a5a32,#c9a84c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
            {review.name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#1a2d1a" }}>{review.name}</span>
              {review.verified && (
                <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 100, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>✓ Verified</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>{timeAgo(review.date)}</div>
          </div>
        </div>
        <StarDisplay rating={review.rating} size={13} />
      </div>

      {/* Title */}
      {review.title && <div style={{ fontWeight: 600, fontSize: 14, color: "#1a2d1a", marginBottom: 6 }}>{review.title}</div>}

      {/* Body */}
      <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65, marginBottom: 12 }}>{review.body}</p>

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {review.images.map((img, i) => (
            <img key={i} src={img} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid #f0ead8" }} />
          ))}
        </div>
      )}

      {/* Helpful */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #f5f0e8", paddingTop: 10 }}>
        <span style={{ fontSize: 12, color: "#4b5563" }}>Helpful?</span>
        <button
          onClick={() => { if (!helped) { onHelpful(review.id); setHelped(true); } }}
          style={{ display: "flex", alignItems: "center", gap: 4, background: helped ? "#f0fdf4" : "#f9f7f3", border: `1px solid ${helped ? "#bbf7d0" : "#e5e0d5"}`, borderRadius: 100, padding: "3px 10px", fontSize: 12, color: helped ? "#16a34a" : "#6b7280", cursor: helped ? "default" : "pointer", transition: "all .2s" }}
        >
          👍 {review.helpful + (helped ? 1 : 0)}
        </button>
      </div>
    </div>
  );
}

// ─── Review Form ──────────────────────────────────────────────────────────────
function ReviewForm({ productId, onSubmit }: { productId: number; onSubmit: (r: Review) => void }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function validate() {
    if (!rating) return "Please select a star rating.";
    if (!name.trim()) return "Please enter your name.";
    if (!body.trim() || body.length < 10) return "Review must be at least 10 characters.";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    const review: Review = {
      id: Date.now().toString(),
      productId,
      name: name.trim(),
      email: email.trim(),
      rating,
      title: title.trim(),
      body: body.trim(),
      date: new Date().toISOString(),
      verified: false,
      helpful: 0,
    };
    onSubmit(review);
    setSubmitting(false);
    setDone(true);
  }

  if (done) return (
    <div style={{ textAlign: "center", padding: "32px 20px", background: "#f0fdf4", borderRadius: 16, border: "1px solid #bbf7d0" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#1a5a32", marginBottom: 6 }}>Thank you for your review!</div>
      <div style={{ fontSize: 13, color: "#6b7280" }}>Your feedback helps other customers make better decisions.</div>
    </div>
  );

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: "1.5px solid #e5e0d5", borderRadius: 10, fontSize: 13, fontFamily: "inherit", color: "#1a2d1a", background: "#fff", outline: "none", transition: "border-color .2s" };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Rating */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Your Rating *</label>
        <StarInput value={rating} onChange={setRating} />
        {rating > 0 && <span style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "block" }}>{["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}</span>}
      </div>

      {/* Name + Email */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inputStyle} onFocus={e => e.target.style.borderColor = "#1a5a32"} onBlur={e => e.target.style.borderColor = "#e5e0d5"} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Email <span style={{ color: "#4b5563", fontWeight: 400 }}>(optional)</span></label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" type="email" style={inputStyle} onFocus={e => e.target.style.borderColor = "#1a5a32"} onBlur={e => e.target.style.borderColor = "#e5e0d5"} />
        </div>
      </div>

      {/* Title */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Review Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Summarize your experience..." style={inputStyle} onFocus={e => e.target.style.borderColor = "#1a5a32"} onBlur={e => e.target.style.borderColor = "#e5e0d5"} />
      </div>

      {/* Body */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Your Review *</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Share your honest experience with this product..." rows={4}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          onFocus={e => e.target.style.borderColor = "#1a5a32"} onBlur={e => e.target.style.borderColor = "#e5e0d5"} />
        <div style={{ fontSize: 11, color: body.length < 10 ? "#ef4444" : "#9ca3af", marginTop: 3, textAlign: "right" }}>{body.length} / 10 min</div>
      </div>

      {/* Error */}
      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#ef4444" }}>⚠ {error}</div>}

      {/* Submit */}
      <button type="submit" disabled={submitting}
        style={{ padding: "12px 0", background: submitting ? "#9ca3af" : "#1a5a32", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", transition: "all .2s", letterSpacing: .5 }}
        onMouseOver={e => { if (!submitting) e.currentTarget.style.background = "#0d3320"; }}
        onMouseOut={e => { if (!submitting) e.currentTarget.style.background = "#1a5a32"; }}
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>

      <p style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>Your review will be visible after moderation.</p>
    </form>
  );
}

// ─── Main ReviewSystem Component ──────────────────────────────────────────────
export default function ReviewSystem({ productId, productName }: ReviewSystemProps) {
  const STORAGE_KEY = `reviews_${productId}`;

  const SEED_REVIEWS: Review[] = [
    { id: "s1", productId, name: "Priya Sharma", rating: 5, title: "Absolutely love it!", body: "The quality is outstanding. You can feel the craftsmanship in every thread. Will definitely order again for my family.", date: new Date(Date.now() - 5 * 86400000).toISOString(), verified: true, helpful: 12 },
    { id: "s2", productId, name: "Rajesh Kumar", rating: 4, title: "Great product, fast delivery", body: "Very happy with the purchase. The product is exactly as described. Packaging was excellent and delivery was on time.", date: new Date(Date.now() - 12 * 86400000).toISOString(), verified: true, helpful: 7 },
    { id: "s3", productId, name: "Ananya Das", rating: 5, title: "Authentic Assamese product", body: "Bought this as a gift for my mother. She was thrilled — said it reminded her of home. The colors are vibrant and true to the photos.", date: new Date(Date.now() - 22 * 86400000).toISOString(), verified: false, helpful: 5 },
    { id: "s4", productId, name: "Mohan Bora", rating: 3, title: "Good but size runs small", body: "The product quality is good but the size was smaller than expected. Would suggest ordering one size up. Customer support was helpful though.", date: new Date(Date.now() - 35 * 86400000).toISOString(), verified: true, helpful: 3 },
  ];

  const [reviews, setReviews] = useState<Review[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : SEED_REVIEWS;
    } catch { return SEED_REVIEWS; }
  });

  const [filterRating, setFilterRating] = useState(0);
  const [sortBy, setSortBy] = useState<"recent" | "helpful" | "highest" | "lowest">("recent");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 4;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews)); } catch {}
  }, [reviews]);

  function addReview(r: Review) {
    setReviews(prev => [r, ...prev]);
    setShowForm(false);
  }

  function markHelpful(id: string) {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, helpful: r.helpful + 1 } : r));
  }

  const total = reviews.length;
  const avgRating = avg(reviews);

  const filtered = reviews
    .filter(r => filterRating === 0 || r.rating === filterRating)
    .sort((a, b) => {
      if (sortBy === "helpful") return b.helpful - a.helpful;
      if (sortBy === "highest") return b.rating - a.rating;
      if (sortBy === "lowest") return a.rating - b.rating;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const paginated = filtered.slice(0, page * PER_PAGE);
  const hasMore = paginated.length < filtered.length;

  return (
    <div style={{ fontFamily: "'Nunito', 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes revFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .rev-card-enter { animation: revFadeUp .35s ease both; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#1a2d1a", marginBottom: 2 }}>Customer Reviews</h2>
          {productName && <p style={{ fontSize: 13, color: "#4b5563" }}>for {productName}</p>}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "#f3f4f6" : "#1a5a32", color: showForm ? "#374151" : "#fff", border: "none", borderRadius: 100, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .2s" }}
        >
          {showForm ? "✕ Cancel" : "✍ Write a Review"}
        </button>
      </div>

      {/* ── Review Form ── */}
      {showForm && (
        <div style={{ background: "#f9f7f3", borderRadius: 18, padding: 24, marginBottom: 28, border: "1px solid #e8e0cc", animation: "revFadeUp .3s ease" }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600, color: "#1a2d1a", marginBottom: 18 }}>Share Your Experience</h3>
          <ReviewForm productId={productId} onSubmit={addReview} />
        </div>
      )}

      {/* ── Summary Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, background: "#fff", borderRadius: 18, padding: 24, border: "1px solid #f0ead8", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,.05)" }}>
        {/* Big number */}
        <div style={{ textAlign: "center", paddingRight: 24, borderRight: "1px solid #f0ead8" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 700, color: "#1a2d1a", lineHeight: 1 }}>{avgRating.toFixed(1)}</div>
          <StarDisplay rating={avgRating} size={16} />
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 5 }}>{total} review{total !== 1 ? "s" : ""}</div>
        </div>

        {/* Breakdown bars */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
          {[5, 4, 3, 2, 1].map(r => (
            <RatingBar key={r} label={`${r}★`} count={countByRating(reviews, r)} total={total} onClick={() => setFilterRating(filterRating === r ? 0 : r)} active={filterRating === r} />
          ))}
        </div>
      </div>

      {/* ── Sort & Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filterRating > 0 && (
            <button onClick={() => setFilterRating(0)} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fee2e2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 100, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {filterRating}★ only ✕
            </button>
          )}
          <span style={{ fontSize: 13, color: "#4b5563", alignSelf: "center" }}>{filtered.length} review{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          style={{ padding: "6px 12px", border: "1.5px solid #e5e0d5", borderRadius: 10, fontSize: 12, fontFamily: "inherit", color: "#374151", background: "#fff", cursor: "pointer", outline: "none" }}>
          <option value="recent">Most Recent</option>
          <option value="helpful">Most Helpful</option>
          <option value="highest">Highest Rated</option>
          <option value="lowest">Lowest Rated</option>
        </select>
      </div>

      {/* ── Review Cards ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#4b5563" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
          <p>No reviews for this rating yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {paginated.map((review, i) => (
            <div key={review.id} className="rev-card-enter" style={{ animationDelay: `${i * .05}s` }}>
              <ReviewCard review={review} onHelpful={markHelpful} />
            </div>
          ))}
        </div>
      )}

      {/* ── Load More ── */}
      {hasMore && (
        <button onClick={() => setPage(p => p + 1)}
          style={{ width: "100%", marginTop: 16, padding: "12px 0", background: "#fff", border: "1.5px solid #e5e0d5", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#1a5a32", cursor: "pointer", transition: "all .2s" }}
          onMouseOver={e => { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.borderColor = "#1a5a32"; }}
          onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e5e0d5"; }}
        >
          Load More Reviews ({filtered.length - paginated.length} remaining)
        </button>
      )}

      {/* ── Trust footer ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 24, padding: "14px 0", borderTop: "1px solid #f5f0e8" }}>
        {[{ icon: "🔒", text: "Secure & Private" }, { icon: "✓", text: "Verified Buyers" }, { icon: "🌿", text: "Honest Reviews" }].map(b => (
          <div key={b.text} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#4b5563" }}>
            <span>{b.icon}</span>{b.text}
          </div>
        ))}
      </div>
    </div>
  );
}