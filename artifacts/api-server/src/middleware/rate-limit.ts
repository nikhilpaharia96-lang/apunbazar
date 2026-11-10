import rateLimit from "express-rate-limit";

// ── Rate limiters ──────────────────────────────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 600, // storefront pages make many small calls
  standardHeaders: true,
  legacyHeaders: false,
  // Product images and health checks are cacheable static-like reads — they must not eat a visitor's budget
  skip: (req) => req.path === "/health" || (req.method === "GET" && req.path.startsWith("/uploads/")),
  message: { error: "Too many requests, please try again later." },
});

export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.ORDER_RATE_LIMIT_MAX) || 5, // per IP per minute (prevents COD spam)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many order requests. Please slow down." },
});

