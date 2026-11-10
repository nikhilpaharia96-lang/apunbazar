/**
 * app.ts — Express application factory
 *
 * Improvements over original:
 * - Added `helmet` for full security header coverage (was: manual 4 headers)
 * - Added `express-rate-limit` to prevent brute-force and DDoS
 * - Strict CORS: dev-only wildcard removed; env-driven allowlist always enforced
 * - Structured AppError class for consistent error responses
 * - Removed inline security header middleware (replaced by helmet)
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { AppError } from "./lib/errors";
import { globalLimiter } from "./middleware/rate-limit";

// Re-exported for backwards compatibility with existing imports
export { AppError };
export { orderLimiter } from "./middleware/rate-limit";

// ── CORS configuration ─────────────────────────────────────────────────────
const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and configured origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new AppError(403, `CORS: Origin not allowed — ${origin}`, "CORS_BLOCKED"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-token"],
};

// ── Application factory ────────────────────────────────────────────────────
export function createApp(): Express {
  const app: Express = express();

  // Trust reverse proxy (Railway, Vercel, nginx) for accurate IP rate limiting
  // Number of reverse proxies in front of the API. Direct Render/Railway = 1; Vercel rewrite → Render = 2.
  // Wrong values make every visitor share one IP (and one rate-limit bucket) — set TRUST_PROXY_HOPS in production.
  app.set("trust proxy", Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 1)));

  // Security headers via helmet (11 headers vs the original 4)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://checkout.razorpay.com"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Needed for Razorpay
    }),
  );

  app.use(cors(corsOptions));
  app.options("/{*path}", cors(corsOptions)); // Pre-flight

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (r) => ({ id: r.id, method: r.method, url: r.url?.split("?")[0] }),
        res: (r) => ({ statusCode: r.statusCode }),
      },
    }),
  );

  app.use(
    express.json({
      limit: "2mb",
      // Keep the exact bytes — Razorpay webhook signatures are computed over the raw body
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

  // Apply global rate limit
  app.use("/api", globalLimiter);
  app.use("/api", router);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
  });

  // Global error handler — must have 4 params to be recognized by Express
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    }

    // Client errors raised by body-parser (malformed JSON → 400, body too large → 413, …)
    const clientStatus = (err as Error & { status?: number; statusCode?: number; type?: string });
    const status = clientStatus.status ?? clientStatus.statusCode;
    if (status && status >= 400 && status < 500) {
      const msg =
        status === 413 ? "Request body is too large." :
        clientStatus.type === "entity.parse.failed" ? "Request body is not valid JSON." :
        "Bad request.";
      return res.status(status).json({ error: msg, code: "BAD_REQUEST" });
    }

    // Log unexpected errors with full stack
    logger.error({ err }, "Unhandled server error");

    // Never leak stack traces in production
    const message =
      process.env.NODE_ENV === "production" ? "Internal server error" : err.message;

    res.status(500).json({ error: message, code: "INTERNAL_ERROR" });
    return;
  });

  return app;
}

export default createApp();
