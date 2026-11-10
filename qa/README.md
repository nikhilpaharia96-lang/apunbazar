# Browser QA scripts (reference)

Headless-Chrome end-to-end tests used to verify the purchase journey against the real API and PostgreSQL.
They need a seeded QA database, the API on :8090, the built storefront served on :5199 with an `/api` proxy
(`serve.mjs`), and `@sparticuz/chromium` + `puppeteer-core` installed. `mock-rz.cjs` is a **QA-only** stand-in
for the Razorpay API (preload it with `node --require`). Paths inside the scripts point at the author's sandbox —
adjust before reuse. The repeatable regression suite is `pnpm --filter @workspace/api-server test`.
