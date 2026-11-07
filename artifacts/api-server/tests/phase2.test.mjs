/**
 * Phase 2 API tests (real PostgreSQL): order expiry, payment retry/failure, image upload
 * validation, strict product validation, management APIs, exports, permissions.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("pg");
const bcrypt = require("bcryptjs");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
const PORT = 19080 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}/api`;
const KEY_SECRET = "test_key_secret_value";
const ADMIN = { email: "admin2@test.local", password: "Sup3r-secret-pass" };
const sfx = Date.now().toString(36);

let server, pool, adminToken, categoryId;

async function api(method, path, { body, token, headers = {}, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(raw ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString("utf8");
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers, buf };
}
const sign = (s, secret) => crypto.createHmac("sha256", secret).update(s).digest("hex");
const rnd = () => crypto.randomBytes(5).toString("hex");
const stockOf = async (id) => (await pool.query("SELECT stock FROM products WHERE id=$1", [id])).rows[0].stock;
const orderRow = async (id) => (await pool.query("SELECT * FROM orders WHERE id=$1", [id])).rows[0];

async function seedProduct(name, price, stock) {
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, price, category_id, image_url, slug, stock) VALUES ($1,'d',$2,$3,'https://x.example/x.jpg',$4,$5) RETURNING id`,
    [`${name} ${sfx}`, price, categoryId, `${name}-${sfx}-${rnd()}`.toLowerCase().replace(/\W+/g, "-"), stock],
  );
  return rows[0].id;
}

/** Inserts an online order that is already holding reserved stock (as POST /orders would leave it). */
async function seedOnlineOrder({ qty = 2, stock = 10, ageMinutes = 0, email = `p2-${sfx}@example.com`, coupon = null } = {}) {
  const pid = await seedProduct("Reserve", "100.00", stock - qty);
  const rzo = "order_" + rnd();
  const items = JSON.stringify([{ productId: pid, name: `Reserve ${sfx}`, price: 100, quantity: qty }]);
  const { rows } = await pool.query(
    `INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode,
       items, subtotal, shipping_fee, total, status, payment_method, payment_status, razorpay_order_id, coupon_code, created_at)
     VALUES ($1,'Retry Buyer',$2,'9876543210','addr 12345','Guwahati','Assam','781001',$3,$4,0,$4,'pending','razorpay','pending',$5,$6, now() - ($7 || ' minutes')::interval) RETURNING id`,
    [`ABT${rnd()}`, email, items, qty * 100, rzo, coupon, String(ageMinutes)],
  );
  return { id: rows[0].id, rzo, pid, email, qty };
}

// Minimal but structurally valid image headers (validator checks real signatures + dimensions)
function fakePng(w, h, size = 400) {
  const b = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write("IHDR", 12, "ascii"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
function fakeJpeg(w, h, size = 400) {
  const b = Buffer.alloc(size);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xc0; b.writeUInt16BE(17, 4); b[6] = 8;
  b.writeUInt16BE(h, 7); b.writeUInt16BE(w, 9);
  return b;
}

before(async () => {
  pool = new pg.Pool({ connectionString: DATABASE_URL });
  categoryId = (await pool.query("SELECT id FROM main_categories ORDER BY id LIMIT 1")).rows[0].id;
  const env = {
    ...process.env, PORT: String(PORT), NODE_ENV: "test", DATABASE_URL, DISABLE_JOBS: "1",
    ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD_HASH: bcrypt.hashSync(ADMIN.password, 4), ADMIN_JWT_SECRET: "y".repeat(64),
    ALLOWED_ORIGINS: "http://localhost:5173", RAZORPAY_KEY_ID: "rzp_test_dummy", RAZORPAY_KEY_SECRET: KEY_SECRET,
    ORDER_RATE_LIMIT_MAX: "1000", ORDER_PAYMENT_TTL_MINUTES: "30",
  };
  server = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], { env, stdio: ["ignore", "pipe", "pipe"] });
  server.stderr.on("data", (d) => process.env.DEBUG_API && process.stderr.write(d));
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const login = await api("POST", "/admin/login", { body: ADMIN });
  assert.equal(login.status, 200);
  adminToken = login.body.token;
});
after(async () => { server?.kill(); await pool?.end(); });

// ── Order expiry ───────────────────────────────────────────────────────────
test("expiry: stale unpaid online order is cancelled, stock + coupon released, ledger written", async () => {
  const code = `X${rnd()}`.toUpperCase();
  await pool.query("INSERT INTO coupons (code, discount_type, discount_value, minimum_order_value, used_count) VALUES ($1,'flat',10,0,1)", [code]);
  const o = await seedOnlineOrder({ qty: 3, stock: 10, ageMinutes: 180, coupon: code }); // > hard limit
  assert.equal(await stockOf(o.pid), 7);

  const r = await api("POST", "/manage/jobs/expire-unpaid", { token: adminToken });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.expired >= 1);

  const row = await orderRow(o.id);
  assert.deepEqual([row.status, row.payment_status], ["cancelled", "failed"]);
  assert.match(row.notes, /Auto-cancelled/);
  assert.equal(await stockOf(o.pid), 10, "reserved stock must be released");
  assert.equal((await pool.query("SELECT used_count FROM coupons WHERE code=$1", [code])).rows[0].used_count, 0);
  const mv = (await pool.query("SELECT delta, reason FROM stock_movements WHERE order_id=$1", [o.id])).rows;
  assert.deepEqual(mv, [{ delta: 3, reason: "expiry" }]);

  // running again does nothing (idempotent — no double restock)
  await api("POST", "/manage/jobs/expire-unpaid", { token: adminToken });
  assert.equal(await stockOf(o.pid), 10);
});

test("expiry: fresh orders are untouched; gateway unreachable defers cancellation until the hard limit", async () => {
  const fresh = await seedOnlineOrder({ ageMinutes: 5 });
  const stale = await seedOnlineOrder({ ageMinutes: 45 }); // past TTL but not past 4×TTL; gateway unreachable here
  const r = await api("POST", "/manage/jobs/expire-unpaid", { token: adminToken });
  assert.equal(r.status, 200);
  assert.equal((await orderRow(fresh.id)).status, "pending");
  assert.equal((await orderRow(stale.id)).status, "pending", "must not cancel when we cannot confirm payment status");
  assert.equal(await stockOf(stale.pid), 8);
});

test("expiry endpoint is permission-protected", async () => {
  assert.equal((await api("POST", "/manage/jobs/expire-unpaid")).status, 401);
});

// ── Payment failure / retry ────────────────────────────────────────────────
test("payment failure then retry: bad signature leaves order payable, resume returns same gateway order, good signature pays", async () => {
  const o = await seedOnlineOrder({ ageMinutes: 2 });
  const pay = "pay_" + rnd();

  const bad = await api("POST", "/payments/verify", { body: { razorpay_order_id: o.rzo, razorpay_payment_id: pay, razorpay_signature: "ab".repeat(32), orderId: o.id } });
  assert.equal(bad.status, 400);
  assert.equal((await orderRow(o.id)).payment_status, "pending");

  const resume = await api("POST", "/payments/razorpay-order", { body: { orderId: o.id, email: o.email } });
  assert.equal(resume.status, 200, JSON.stringify(resume.body));
  assert.equal(resume.body.orderId, o.rzo, "retry must reuse the same gateway order");
  assert.equal(resume.body.amount, 20000, "amount comes from the database total");

  assert.equal((await api("POST", "/payments/razorpay-order", { body: { orderId: o.id, email: "someone@else.com" } })).status, 404);

  const ok = await api("POST", "/payments/verify", { body: { razorpay_order_id: o.rzo, razorpay_payment_id: pay, razorpay_signature: sign(`${o.rzo}|${pay}`, KEY_SECRET), orderId: o.id } });
  assert.equal(ok.status, 200);
  assert.equal((await orderRow(o.id)).payment_status, "paid");
  assert.equal((await api("POST", "/payments/razorpay-order", { body: { orderId: o.id, email: o.email } })).status, 409, "paid order cannot be paid again");
});

test("late payment on an expired order is recorded as 'refund needed' and refunds without double restock", async () => {
  const o = await seedOnlineOrder({ qty: 2, stock: 10, ageMinutes: 300 });
  await api("POST", "/manage/jobs/expire-unpaid", { token: adminToken });
  assert.equal((await orderRow(o.id)).status, "cancelled");
  assert.equal(await stockOf(o.pid), 10);

  assert.equal((await api("POST", "/payments/razorpay-order", { body: { orderId: o.id, email: o.email } })).status, 409);

  const pay = "pay_" + rnd();
  const late = await api("POST", "/payments/verify", { body: { razorpay_order_id: o.rzo, razorpay_payment_id: pay, razorpay_signature: sign(`${o.rzo}|${pay}`, KEY_SECRET), orderId: o.id } });
  assert.equal(late.status, 409);
  const row = await orderRow(o.id);
  assert.deepEqual([row.status, row.payment_status, row.razorpay_payment_id], ["cancelled", "paid", pay]);

  const list = await api("GET", `/manage/payments?status=refund_needed&q=${row.order_number}`, { token: adminToken });
  assert.equal(list.status, 200);
  assert.equal(list.body.payments.length, 1);
  assert.equal(list.body.payments[0].refundNeeded, true);
  assert.ok(list.body.summary.refundsNeededCount >= 1);

  const refund = await api("PUT", `/orders/${o.id}`, { token: adminToken, body: { status: "refunded" } });
  assert.equal(refund.status, 200, JSON.stringify(refund.body));
  assert.equal((await orderRow(o.id)).payment_status, "refunded");
  assert.equal(await stockOf(o.pid), 10, "refunding a cancelled order must not restock again");
});

// ── Image uploads ──────────────────────────────────────────────────────────
test("image upload: auth required; genuine images accepted and served safely", async () => {
  const png = fakePng(600, 600);
  assert.equal((await api("POST", "/uploads/product-image", { raw: png, headers: { "Content-Type": "image/png" } })).status, 401);
  const up = await api("POST", "/uploads/product-image", { token: adminToken, raw: png, headers: { "Content-Type": "image/png" } });
  assert.equal(up.status, 201, JSON.stringify(up.body));
  assert.match(up.body.url, /^\/api\/uploads\/[A-Za-z0-9_-]{16}$/);
  const get = await api("GET", up.body.url.replace("/api", ""));
  assert.equal(get.status, 200);
  assert.equal(get.headers.get("content-type"), "image/png");
  assert.equal(get.headers.get("x-content-type-options"), "nosniff");
  assert.match(get.headers.get("cache-control"), /immutable/);
  assert.ok(get.buf.equals(png));
  assert.equal((await api("POST", "/uploads/product-image", { token: adminToken, raw: fakeJpeg(800, 500), headers: { "Content-Type": "image/jpeg" } })).status, 201);
});

test("image upload: rejects SVG, disguised files, wrong sizes, tiny/huge dimensions, garbage", async () => {
  const up = (raw, type) => api("POST", "/uploads/product-image", { token: adminToken, raw, headers: { "Content-Type": type } });
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'.padEnd(200, " "));
  assert.equal((await up(svg, "image/svg+xml")).status, 415);
  assert.equal((await up(svg, "image/png")).status, 400, "SVG content labelled as PNG");
  assert.equal((await up(fakePng(600, 600), "image/jpeg")).status, 400, "PNG labelled as JPEG");
  assert.equal((await up(Buffer.from("<?php system($_GET[1]); ?>".padEnd(300, " ")), "image/jpeg")).status, 400);
  assert.equal((await up(fakePng(100, 100), "image/png")).status, 400, "too small");
  assert.equal((await up(fakePng(9000, 9000), "image/png")).status, 400, "too large");
  assert.equal((await up(Buffer.alloc(20), "image/png")).status, 400, "too few bytes");
  assert.equal((await up(fakePng(600, 600, 3.5 * 1024 * 1024), "image/png")).status, 413, "over 3 MB");
  assert.equal((await api("GET", "/uploads/does-not-exist-123")).status, 404);
});

// ── Product validation ─────────────────────────────────────────────────────
const prod = (over = {}) => ({ name: `Valid Tea ${sfx} ${rnd()}`, description: "Fine Assam tea", price: 300, categoryId, imageUrl: "https://cdn.example.com/tea.jpg", stock: 5, ...over });

test("product validation: unsafe image refs, bad numbers and unknown category are rejected", async () => {
  const post = (over) => api("POST", "/products", { token: adminToken, body: prod(over) });
  for (const bad of ["javascript:alert(1)", "http://insecure.example/x.jpg", "data:image/png;base64,AAAA", "//evil.example/x.png", "https://user:pw@evil.example/x.jpg", "/etc/passwd", "ftp://x.example/a.png"]) {
    assert.equal((await post({ imageUrl: bad })).status, 400, `must reject ${bad}`);
  }
  assert.equal((await post({ images: ["https://ok.example/a.jpg", "javascript:1"] })).status, 400);
  assert.equal((await post({ stock: -1 })).status, 400);
  assert.equal((await post({ stock: 1.5 })).status, 400);
  assert.equal((await post({ price: 0 })).status, 400);
  assert.equal((await post({ price: 500, originalPrice: 400 })).status, 400);
  assert.equal((await post({ categoryId: 999999 })).status, 400);
  assert.equal((await post({ name: "  " })).status, 400);
  assert.equal((await api("POST", "/products", { token: adminToken, body: "{not json" })).status, 400, "malformed JSON is a 400, not a 500");
});

test("product create/update: slug generated, uploaded images accepted, stock changes are ledgered, originalPrice can be cleared", async () => {
  const up = await api("POST", "/uploads/product-image", { token: adminToken, raw: fakePng(700, 700), headers: { "Content-Type": "image/png" } });
  const created = await api("POST", "/products", { token: adminToken, body: prod({ imageUrl: up.body.url, originalPrice: 400, name: `Slug Test ${sfx}` }) });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.slug, `slug-test-${sfx}`);
  const dup = await api("POST", "/products", { token: adminToken, body: prod({ name: `Slug Test ${sfx}` }) });
  assert.equal(dup.body.slug, `slug-test-${sfx}-2`, "slugs stay unique");

  const id = created.body.id;
  const put = await api("PUT", `/products/${id}`, { token: adminToken, body: prod({ imageUrl: up.body.url, name: `Slug Test ${sfx}`, stock: 9, originalPrice: null }) });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.equal(put.body.originalPrice, null);
  const mv = (await pool.query("SELECT delta, reason FROM stock_movements WHERE product_id=$1 ORDER BY id", [id])).rows;
  assert.deepEqual(mv, [{ delta: 5, reason: "manual" }, { delta: 4, reason: "product_edit" }]);
  assert.equal((await api("PUT", "/products/999999999", { token: adminToken, body: prod() })).status, 404);
});

// ── Management APIs ────────────────────────────────────────────────────────
const customer = (email, over = {}) => ({
  customerName: "Mgmt Buyer", customerEmail: email, customerPhone: "9876543210", shippingAddress: "House 1, Test Road",
  shippingCity: "Jorhat", shippingState: "Assam", shippingPincode: "785001", paymentMethod: "cod", ...over,
});

test("customers: aggregation follows the revenue definition (cancelled and unpaid online orders excluded)", async () => {
  const pid = await seedProduct("Cust Tea", "200.00", 50);
  const email = `cust-${sfx}@example.com`;
  const mk = (over = {}) => api("POST", "/orders", { body: customer(email, { customerName: "=HYPERLINK(\"http://evil\")", items: [{ productId: pid, quantity: 1 }], ...over }) });

  const a = await mk();                       // COD → counts
  const b = await mk();                       // COD → will be cancelled → excluded
  await api("PUT", `/orders/${b.body.id}`, { token: adminToken, body: { status: "cancelled" } });
  const c = await seedOnlineOrder({ email, ageMinutes: 1 }); // online unpaid → excluded
  assert.equal(a.status, 201);

  const d = await api("GET", `/manage/customers/detail?email=${encodeURIComponent(email)}`, { token: adminToken });
  assert.equal(d.status, 200);
  assert.equal(d.body.orders, 1);
  assert.equal(d.body.spent, a.body.total);
  assert.equal(d.body.orderList.length, 3);

  const list = await api("GET", `/manage/customers?q=${encodeURIComponent(email)}&sort=spent`, { token: adminToken });
  assert.equal(list.body.total, 1);
  assert.equal(list.body.customers[0].placedOrders, 3);
  assert.equal(list.body.customers[0].spent, a.body.total);

  // paying the online order makes it count
  const pay = "pay_" + rnd();
  await api("POST", "/payments/verify", { body: { razorpay_order_id: c.rzo, razorpay_payment_id: pay, razorpay_signature: sign(`${c.rzo}|${pay}`, KEY_SECRET), orderId: c.id } });
  const d2 = await api("GET", `/manage/customers/detail?email=${encodeURIComponent(email)}`, { token: adminToken });
  assert.equal(d2.body.orders, 2);
  assert.equal(d2.body.spent, a.body.total + 200);

  assert.equal((await api("GET", "/manage/customers/detail?email=nobody@nowhere.example", { token: adminToken })).status, 404);
  assert.equal((await api("GET", "/manage/customers/detail?email=bad", { token: adminToken })).status, 400);
});

test("analytics: overview/trend/top-products/categories are consistent with the database", async () => {
  const pid = await seedProduct("Top Seller", "150.00", 100);
  const email = `an-${sfx}@example.com`;
  for (let i = 0; i < 2; i++) assert.equal((await api("POST", "/orders", { body: customer(email, { items: [{ productId: pid, quantity: 3 }] }) })).status, 201);

  const ov = await api("GET", "/manage/analytics/overview", { token: adminToken });
  assert.equal(ov.status, 200, JSON.stringify(ov.body));
  assert.equal(ov.body.range.days, 30);
  const { rows: [db] } = await pool.query(`
    SELECT COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled','refunded') AND (payment_method='cod' OR payment_status='paid')),0)::float AS revenue,
           COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded') AND (payment_method='cod' OR payment_status='paid'))::int AS orders
    FROM orders WHERE created_at >= now() - interval '40 days'`);
  assert.equal(ov.body.revenue, db.revenue);
  assert.equal(ov.body.orders, db.orders);
  assert.ok(ov.body.averageOrderValue > 0);
  assert.ok(Array.isArray(ov.body.paymentMix) && Array.isArray(ov.body.statusBreakdown));
  assert.equal(typeof ov.body.previous.revenue, "number");

  const trend = await api("GET", "/manage/analytics/trend?group=day", { token: adminToken });
  assert.equal(trend.body.length, 30, "zero-filled daily series");
  assert.equal(Math.round(trend.body.reduce((s, r) => s + r.revenue, 0)), Math.round(ov.body.revenue));
  assert.ok((await api("GET", "/manage/analytics/trend?group=month", { token: adminToken })).body.length >= 1);

  const top = await api("GET", "/manage/analytics/top-products?limit=50", { token: adminToken });
  const mine = top.body.find((p) => p.id === pid);
  assert.equal(mine.units, 6);
  assert.equal(mine.revenue, 900);

  const cats = await api("GET", "/manage/analytics/categories", { token: adminToken });
  assert.ok(cats.body.length >= 1 && cats.body.every((c) => typeof c.revenue === "number"));

  assert.equal((await api("GET", "/manage/analytics/overview?from=2025-02-01&to=2025-01-01", { token: adminToken })).status, 400);
  assert.equal((await api("GET", "/manage/analytics/overview?from=2020-01-01&to=2025-01-01", { token: adminToken })).status, 400, "range cap");
  assert.equal((await api("GET", "/manage/analytics/overview?from=garbage", { token: adminToken })).status, 400);
});

test("dashboard endpoints: revenue excludes cancelled; top products ranked by sales", async () => {
  const stats = await api("GET", "/admin/stats", { token: adminToken });
  assert.equal(stats.status, 200);
  const { rows: [r] } = await pool.query(`SELECT COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled','refunded') AND (payment_method='cod' OR payment_status='paid')),0)::float AS rev FROM orders`);
  assert.equal(stats.body.totalRevenue, r.rev);
  const top = await api("GET", "/admin/top-products?limit=3", { token: adminToken });
  assert.ok(top.body.length >= 1 && top.body[0].units >= top.body[top.body.length - 1].units);
  assert.equal((await api("GET", "/admin/stats")).status, 401);
});

test("inventory: filters, summary, adjustments with ledger, and guards", async () => {
  const outId = await seedProduct("Out Item", "50.00", 0);
  const lowId = await seedProduct("Low Item", "50.00", 2);
  const inv = await api("GET", `/manage/inventory?q=${encodeURIComponent(sfx)}&filter=out`, { token: adminToken });
  assert.ok(inv.body.products.some((p) => p.id === outId));
  assert.ok(!inv.body.products.some((p) => p.id === lowId));
  const low = await api("GET", `/manage/inventory?q=${encodeURIComponent(sfx)}&filter=low&threshold=5`, { token: adminToken });
  assert.ok(low.body.products.some((p) => p.id === lowId));
  assert.ok(inv.body.summary.outOfStock >= 1 && inv.body.summary.lowStock >= 1 && inv.body.summary.stockValue >= 0);

  const add = await api("POST", `/manage/inventory/${lowId}/adjust`, { token: adminToken, body: { mode: "delta", value: 10, reason: "Restock from supplier" } });
  assert.deepEqual([add.status, add.body.stock, add.body.previous], [200, 12, 2]);
  assert.equal((await api("POST", `/manage/inventory/${lowId}/adjust`, { token: adminToken, body: { mode: "set", value: 7, reason: "Stock count" } })).body.stock, 7);
  assert.equal((await api("POST", `/manage/inventory/${lowId}/adjust`, { token: adminToken, body: { mode: "delta", value: -50, reason: "Too many" } })).status, 400);
  assert.equal((await api("POST", `/manage/inventory/${lowId}/adjust`, { token: adminToken, body: { mode: "set", value: 1, reason: "x" } })).status, 400, "reason required");
  assert.equal(await stockOf(lowId), 7, "failed adjustments change nothing");
  assert.equal((await api("POST", "/manage/inventory/99999999/adjust", { token: adminToken, body: { mode: "set", value: 1, reason: "ghost item" } })).status, 404);

  const mv = await api("GET", `/manage/inventory/${lowId}/movements`, { token: adminToken });
  assert.deepEqual(mv.body.map((m) => m.delta), [-5, 10]);
  assert.equal(mv.body[1].note, "Restock from supplier");
});

test("payments: list, filters and summary", async () => {
  const o = await seedOnlineOrder({ ageMinutes: 1, email: `pm-${sfx}@example.com` });
  const list = await api("GET", `/manage/payments?method=razorpay&status=pending&q=${encodeURIComponent(o.email)}`, { token: adminToken });
  assert.equal(list.status, 200);
  assert.equal(list.body.payments.length, 1);
  assert.equal(list.body.payments[0].total, 200);
  assert.ok(list.body.summary.awaitingOnline >= 200);
  assert.equal((await api("GET", "/manage/payments?status=bogus", { token: adminToken })).status, 400);
});

test("reports: CSV exports for every type, with formula-injection protection", async () => {
  const pid = await seedProduct("CSV Tea", "100.00", 10);
  const o = await api("POST", "/orders", { body: customer(`csv-${sfx}@example.com`, { customerName: "=cmd|' /C calc'!A0", items: [{ productId: pid, quantity: 1 }] }) });
  for (const type of ["orders", "customers", "inventory", "payments", "sales"]) {
    const r = await api("GET", `/manage/reports/export?type=${type}`, { token: adminToken });
    assert.equal(r.status, 200, type);
    assert.match(r.headers.get("content-type"), /text\/csv/);
    assert.match(r.headers.get("content-disposition"), new RegExp(`attachment; filename="apunbazar-${type}-`));
    assert.ok(r.body.charCodeAt(0) === 0xfeff && r.body.split("\r\n").length >= 2, `${type} has header + rows`);
  }
  const orders = (await api("GET", "/manage/reports/export?type=orders", { token: adminToken })).body;
  assert.ok(orders.includes(o.body.orderNumber));
  assert.ok(orders.includes("'=cmd|"), "dangerous cells must be neutralised");
  assert.ok(!/(^|,)=cmd/m.test(orders));
  assert.equal((await api("GET", "/manage/reports/export?type=passwords", { token: adminToken })).status, 400);
  assert.equal((await api("GET", "/manage/reports/export?type=orders")).status, 401);
});

test("orders list: admin search + payment-status + date filters", async () => {
  const email = `flt-${sfx}@example.com`;
  const o = await seedOnlineOrder({ email, ageMinutes: 1 });
  const row = await orderRow(o.id);
  const q = await api("GET", `/orders?q=${row.order_number}&paymentStatus=pending`, { token: adminToken });
  assert.equal(q.body.orders.length, 1);
  assert.equal((await api("GET", `/orders?q=${row.order_number}&paymentStatus=paid`, { token: adminToken })).body.orders.length, 0);
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  assert.equal((await api("GET", `/orders?q=${row.order_number}&from=${today}&to=${today}`, { token: adminToken })).body.orders.length, 1);
  assert.equal((await api("GET", `/orders?q=${row.order_number}&from=2000-01-01&to=2000-01-02`, { token: adminToken })).body.orders.length, 0);
  assert.equal((await api("GET", `/orders?q=${row.order_number}`)).status, 400, "public callers cannot search");
});

// ── Permissions on the new APIs ────────────────────────────────────────────
test("management APIs enforce staff permissions", async () => {
  const mkStaff = async (role, perms) => {
    const email = `${role}-${sfx}@example.com`;
    const c = await api("POST", "/staff", { token: adminToken, body: { name: role, email, role, permissions: perms, password: "password123" } });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    return (await api("POST", "/staff/login", { body: { email, password: "password123" } })).body.token;
  };
  const support = await mkStaff("support", ["dashboard", "orders"]);
  assert.equal((await api("GET", "/manage/customers", { token: support })).status, 200);
  assert.equal((await api("GET", "/manage/payments", { token: support })).status, 200);
  assert.equal((await api("GET", "/admin/stats", { token: support })).status, 200);
  assert.equal((await api("GET", "/manage/analytics/overview", { token: support })).status, 403);
  assert.equal((await api("GET", "/manage/inventory", { token: support })).status, 403);
  assert.equal((await api("GET", "/manage/reports/export?type=orders", { token: support })).status, 403);
  assert.equal((await api("POST", "/uploads/product-image", { token: support, raw: fakePng(600, 600), headers: { "Content-Type": "image/png" } })).status, 403);

  const manager = await mkStaff("manager", ["dashboard", "products", "orders", "analytics", "reports"]);
  assert.equal((await api("GET", "/manage/analytics/overview", { token: manager })).status, 200);
  assert.equal((await api("GET", "/manage/inventory", { token: manager })).status, 200);
  assert.equal((await api("GET", "/manage/reports/export?type=sales", { token: manager })).status, 200);
});
