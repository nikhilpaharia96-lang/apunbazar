# ApunBazar — Deployment Guide

```
Browser → Vercel (React SPA) —/api/* rewrite→ API server (Render/Railway) → PostgreSQL
```

## 1. Database
Apply the schema (`DATABASE_URL=... pnpm --filter @workspace/db run push`) **or** run the SQL files in
`supabase/migrations/` in order. `002`–`004` (payments/coupons, inventory ledger + image storage, customer accounts) are additive and safe to re-run.

## 2. API server environment variables
| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NODE_ENV` | `production` (server refuses to start with weak/missing secrets) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` | hash: `node -e "require('bcryptjs').hash('PASSWORD',12).then(console.log)"` |
| `ADMIN_JWT_SECRET` | ≥ 32 chars: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ALLOWED_ORIGINS` | comma-separated site origins (CORS) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | use `rzp_test_*` first |
| `RAZORPAY_WEBHOOK_SECRET` | same secret you set on the webhook in Razorpay |
| `TRUST_PROXY_HOPS` | reverse proxies in front of the API. Vercel rewrite → Render = `2`, direct = `1`. **Wrong value = all visitors share one rate-limit bucket** |
| `ORDER_PAYMENT_TTL_MINUTES` | unpaid online orders are auto-cancelled and stock released after this (default 30) |
| `GLOBAL_RATE_LIMIT_MAX` | requests per IP per 15 min (default 600) |
| `BCRYPT_ROUNDS` | customer password cost (default 12) |

Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build` · Start: `node --enable-source-maps ./dist/index.mjs` (from `artifacts/api-server`).

## 3. Razorpay webhook
Dashboard → Webhooks → URL `https://<api-host>/api/payments/webhook`, events `payment.captured` and `order.paid`.

## 4. Frontend (Vercel)
`vercel.json` builds with pnpm. Point the `/api/:path*` rewrite at your API host.

## 5. Deploy order
Run migration → deploy API **and** frontend together → place a test-mode order (COD and Razorpay) → check it in Admin → Orders.

## Tests
`DATABASE_URL=<empty test db> pnpm --filter @workspace/api-server test`
