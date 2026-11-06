import rateLimit from "express-rate-limit";

// ── Rate limiters ──────────────────────────────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.ORDER_RATE_LIMIT_MAX) || 5, // per IP per minute (prevents COD spam)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many order requests. Please slow down." },
});

