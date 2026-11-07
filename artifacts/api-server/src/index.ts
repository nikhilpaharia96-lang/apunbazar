import app from "./app";
import { logger } from "./lib/logger";
import { startExpiryJob } from "./services/order-expiry";

// Fail fast on missing/weak secrets instead of failing on the first admin request
if (process.env.NODE_ENV === "production") {
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is not set");
  if ((process.env.ADMIN_JWT_SECRET ?? "").length < 32) problems.push("ADMIN_JWT_SECRET must be at least 32 characters");
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH) problems.push("ADMIN_EMAIL / ADMIN_PASSWORD_HASH are not set");
  if (!process.env.ALLOWED_ORIGINS) problems.push("ALLOWED_ORIGINS is not set (CORS would only allow localhost)");
  if (problems.length) {
    logger.error({ problems }, "Refusing to start: invalid production configuration");
    process.exit(1);
  }
  if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_WEBHOOK_SECRET) {
    logger.warn("RAZORPAY_WEBHOOK_SECRET is not set — the payment webhook is disabled; relying on client verification only");
  }
}

const port = parseInt(process.env.PORT ?? "8080", 10);
const effectivePort = isNaN(port) || port <= 0 ? 8080 : port;

app.listen(effectivePort, "0.0.0.0", () => {
  startExpiryJob();
  logger.info({ port: effectivePort, env: process.env.NODE_ENV ?? "development" }, "🚀 API server started");
});

process.on("uncaughtException",  err    => { logger.error(err,    "Uncaught exception");         process.exit(1); });
process.on("unhandledRejection", reason => { logger.error(reason, "Unhandled promise rejection"); process.exit(1); });
