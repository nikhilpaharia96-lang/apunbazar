/**
 * End-to-end API tests against a REAL PostgreSQL database.
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @workspace/api-server test
 *
 * The database must already have the schema (pnpm --filter @workspace/db push).
 * The Razorpay network call itself is not exercised (needs live keys); payment
 * verification and webhook logic are tested with correctly signed payloads.
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
if (!DATABASE_URL) throw new Error("DATABASE_URL is required to run integration tests");

const PORT = 18080 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}/api`;
const KEY_SECRET = "test_key_secret_value";
const WEBHOOK_SECRET = "test_webhook_secret";
const ADMIN = { email: "admin@test.local", password: "Sup3r-secret-pass" };

let server, pool, adminToken;
const sfx = Date.now().toString(36);

async function api(method, path, { body, token, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

const customer = (over = {}) => ({
  customerName: "Test Buyer", customerEmail: `buyer-${sfx}@example.com`, customerPhone: "9876543210",
  shippingAddress: "House 1, Test Road", shippingCity: "Guwahati", shippingState: "Assam", shippingPincode: "781001",
  paymentMethod: "cod", ...over,
});

async function seedProduct(name, price, stock) {
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, price, category_id, image_url, slug, stock) VALUES ($1,'d',$2,1,'x.jpg',$3,$4) RETURNING id`,
    [name, price, `${name}-${sfx}`.toLowerCase().replace(/\W+/g, "-"), stock],
  );
  return rows[0].id;
}
const stockOf = async (id) => (await pool.query("SELECT stock FROM products WHERE id=$1", [id])).rows[0].stock;
const sign = (s, secret) => crypto.createHmac("sha256", secret).update(s).digest("hex");

before(async () => {
  pool = new pg.Pool({ connectionString: DATABASE_URL });
  await pool.query("DELETE FROM settings WHERE key='shipping_config'");
  const env = {
    ...process.env, PORT: String(PORT), NODE_ENV: "test", DATABASE_URL,
    ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD_HASH: bcrypt.hashSync(ADMIN.password, 4),
    ADMIN_JWT_SECRET: "x".repeat(64), ALLOWED_ORIGINS: "http://localhost:5173",
    RAZORPAY_KEY_ID: "rzp_test_dummy", RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ORDER_RATE_LIMIT_MAX: "1000",
  };
  server = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], { env, stdio: ["ignore", "pipe", "pipe"] });
  server.stderr.on("data", (d) => process.env.DEBUG_API && process.stderr.write(d));
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/health")).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const login = await api("POST", "/admin/login", { body: ADMIN });
  assert.equal(login.status, 200, "admin login must work");
  adminToken = login.body.token;
});

after(async () => { server?.kill(); await pool?.end(); });

// ── Authorization ──────────────────────────────────────────────────────────
test("product writes require authentication", async () => {
  const body = { name: "Hack", description: "d", price: 1, categoryId: 1, imageUrl: "x", stock: 1, slug: "hack" };
  assert.equal((await api("POST", "/products", { body })).status, 401);
  assert.equal((await api("PUT", "/products/1", { body })).status, 401);
  assert.equal((await api("DELETE", "/products/1")).status, 401);
  assert.equal((await api("POST", "/products", { body, token: "garbage" })).status, 401);
});

test("admin can create a product", async () => {
  const r = await api("POST", "/products", { token: adminToken, body: { name: `Admin Tea ${sfx}`, description: "d", price: 250, categoryId: (await pool.query("SELECT id FROM main_categories ORDER BY id LIMIT 1")).rows[0].id, imageUrl: "https://cdn.example.com/x.jpg", stock: 3 } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test("order list / update / coupons admin API are closed to the public", async () => {
  assert.equal((await api("GET", "/orders")).status, 400); // public needs email+phone
  assert.equal((await api("GET", "/orders?email=a")).status, 400); // substring enumeration is gone
  assert.equal((await api("PUT", "/orders/1", { body: { status: "delivered" } })).status, 401);
  assert.equal((await api("GET", "/coupons")).status, 401);
  assert.equal((await api("POST", "/coupons", { body: { code: "HACK10" } })).status, 401);
  assert.equal((await api("PUT", "/settings/shipping", { body: {} })).status, 401);
});

// ── Server-side pricing & stock ────────────────────────────────────────────
test("client-supplied price is ignored; totals come from the database", async () => {
  const pid = await seedProduct("Price Test", "500.00", 10);
  const r = await api("POST", "/orders", { body: customer({ items: [{ productId: pid, quantity: 2, price: 1 }] }) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.subtotal, 1000);               // not 2
  assert.equal(r.body.items[0].price, 500);
  assert.equal(r.body.shippingFee, 30);              // ≥ ₹999 → free delivery, but the COD fee still applies
  assert.equal(r.body.total, 1030);
});

test("stock is decremented and out-of-stock orders are rejected without side effects", async () => {
  const pid = await seedProduct("Stock Test", "100.00", 3);
  assert.equal((await api("POST", "/orders", { body: customer({ items: [{ productId: pid, quantity: 2 }] }) })).status, 201);
  assert.equal(await stockOf(pid), 1);
  const r = await api("POST", "/orders", { body: customer({ items: [{ productId: pid, quantity: 2 }] }) });
  assert.equal(r.status, 409);
  assert.equal(await stockOf(pid), 1, "failed order must not change stock");
});

test("concurrent buyers cannot oversell", async () => {
  const pid = await seedProduct("Race Test", "100.00", 5);
  const results = await Promise.all(
    Array.from({ length: 12 }, () => api("POST", "/orders", { body: customer({ items: [{ productId: pid, quantity: 1 }] }) })),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 5);
  assert.equal(results.filter((r) => r.status === 409).length, 7);
  assert.equal(await stockOf(pid), 0);
});

test("validation rejects bad input", async () => {
  const pid = await seedProduct("Valid Test", "100.00", 5);
  const bad = async (over) => (await api("POST", "/orders", { body: customer({ items: [{ productId: pid, quantity: 1 }], ...over }) })).status;
  assert.equal(await bad({ customerPhone: "123" }), 400);
  assert.equal(await bad({ shippingPincode: "12" }), 400);
  assert.equal(await bad({ customerEmail: "nope" }), 400);
  assert.equal(await bad({ items: [{ productId: pid, quantity: -3 }] }), 400);
  assert.equal(await bad({ items: [{ productId: pid, quantity: 1000 }] }), 400);
  assert.equal(await bad({ items: [{ productId: 99999999, quantity: 1 }] }), 400);
  assert.equal(await bad({ items: [] }), 400);
  assert.equal(await stockOf(pid), 5);
});

// ── Customer order access ──────────────────────────────────────────────────
test("customers can only read their own order (email), and lookup needs email + phone", async () => {
  const pid = await seedProduct("Access Test", "100.00", 5);
  const email = `own-${sfx}@example.com`;
  const o = await api("POST", "/orders", { body: customer({ customerEmail: email, items: [{ productId: pid, quantity: 1 }] }) });
  const id = o.body.id;
  assert.equal((await api("GET", `/orders/${id}`)).status, 404);
  assert.equal((await api("GET", `/orders/${id}?email=other@example.com`)).status, 404);
  assert.equal((await api("GET", `/orders/${id}?email=${encodeURIComponent(email.toUpperCase())}`)).status, 200);
  assert.equal((await api("GET", `/orders/${id}`, { token: adminToken })).status, 200);
  const list = await api("GET", `/orders?email=${encodeURIComponent(email)}&phone=9876543210`);
  assert.equal(list.status, 200); assert.equal(list.body.orders.length, 1);
  assert.equal((await api("GET", `/orders?email=${encodeURIComponent(email)}&phone=9000000000`)).body.orders.length, 0);
});

// ── Coupons ────────────────────────────────────────────────────────────────
test("coupons: server-side validation, discount, usage limit, restore on cancel", async () => {
  const code = `T${sfx}`.toUpperCase().slice(0, 12);
  const c = await api("POST", "/coupons", { token: adminToken, body: { code, discountType: "percent", discountValue: 10, minimumOrderValue: 200, maxUses: 1 } });
  assert.equal(c.status, 201, JSON.stringify(c.body));

  const pid = await seedProduct("Coupon Test", "300.00", 10);
  assert.equal((await api("GET", `/coupons/validate?code=${code}&subtotal=100`)).status, 400); // below minimum
  const v = await api("GET", `/coupons/validate?code=${code}&subtotal=300`);
  assert.equal(v.body.discount, 30);
  assert.equal((await api("GET", "/coupons/validate?code=NOPE&subtotal=300")).status, 400);

  const o = await api("POST", "/orders", { body: customer({ couponCode: code, items: [{ productId: pid, quantity: 1 }] }) });
  assert.equal(o.status, 201, JSON.stringify(o.body));
  assert.equal(o.body.discount, 30);
  assert.equal(o.body.total, o.body.subtotal - 30 + o.body.shippingFee);

  // maxUses = 1 → second use rejected, and stock untouched by the failed attempt
  const again = await api("POST", "/orders", { body: customer({ couponCode: code, items: [{ productId: pid, quantity: 1 }] }) });
  assert.equal(again.status, 400);
  assert.equal(await stockOf(pid), 9);

  // cancelling restores stock AND the coupon use
  const cancel = await api("PUT", `/orders/${o.body.id}`, { token: adminToken, body: { status: "cancelled" } });
  assert.equal(cancel.status, 200);
  assert.equal(await stockOf(pid), 10);
  const retry = await api("POST", "/orders", { body: customer({ couponCode: code, items: [{ productId: pid, quantity: 1 }] }) });
  assert.equal(retry.status, 201, "coupon use must be released on cancel");

  // cancelled orders cannot be revived (would need stock re-reservation)
  assert.equal((await api("PUT", `/orders/${o.body.id}`, { token: adminToken, body: { status: "shipped" } })).status, 409);
  // restock only happens once
  await api("PUT", `/orders/${o.body.id}`, { token: adminToken, body: { status: "cancelled" } });
  assert.equal(await stockOf(pid), 9); // 10 - retry order
});

// ── Shipping config ────────────────────────────────────────────────────────
test("shipping config is served from the DB and used for order totals", async () => {
  const put = await api("PUT", "/settings/shipping", { token: adminToken, body: { shippingFee: 70, freeShippingAbove: 5000, codFee: 20, codEnabled: true, freeShippingEnabled: true } });
  assert.equal(put.status, 200);
  assert.equal((await api("GET", "/settings/shipping")).body.shippingFee, 70);
  const pid = await seedProduct("Ship Test", "100.00", 5);
  const cod = await api("POST", "/orders", { body: customer({ items: [{ productId: pid, quantity: 1 }] }) });
  assert.equal(cod.body.shippingFee, 90); // 70 + 20 COD
  assert.equal(cod.body.total, 190);
});

// ── Razorpay ───────────────────────────────────────────────────────────────
async function razorpayOrderInDb(total = "400.00") {
  const pid = await seedProduct("Pay Test", "100.00", 5);
  const { rows } = await pool.query(
    `INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, items, subtotal, shipping_fee, total, status, payment_method, payment_status, razorpay_order_id)
     VALUES ($1,'n',$2,'9876543210','a','c','s','781001','[]',$3,0,$3,'pending','razorpay','pending',$4) RETURNING id`,
    [`ABT${crypto.randomBytes(5).toString("hex")}`, `pay-${sfx}@example.com`, total, `order_${crypto.randomBytes(6).toString("hex")}`],
  );
  const rzo = (await pool.query("SELECT razorpay_order_id FROM orders WHERE id=$1", [rows[0].id])).rows[0].razorpay_order_id;
  return { id: rows[0].id, rzo, pid };
}

test("payment verify: valid signature marks paid; replay/forged/wrong-order are rejected; idempotent", async () => {
  const a = await razorpayOrderInDb();
  const b = await razorpayOrderInDb();
  const pay = "pay_" + crypto.randomBytes(5).toString("hex");
  const goodSig = sign(`${a.rzo}|${pay}`, KEY_SECRET);

  // forged signature
  assert.equal((await api("POST", "/payments/verify", { body: { razorpay_order_id: a.rzo, razorpay_payment_id: pay, razorpay_signature: "00".repeat(32), orderId: a.id } })).status, 400);
  // valid signature for order A replayed against order B
  assert.equal((await api("POST", "/payments/verify", { body: { razorpay_order_id: a.rzo, razorpay_payment_id: pay, razorpay_signature: goodSig, orderId: b.id } })).status, 400);
  assert.equal((await pool.query("SELECT payment_status FROM orders WHERE id=$1", [b.id])).rows[0].payment_status, "pending");
  // correct
  const ok = await api("POST", "/payments/verify", { body: { razorpay_order_id: a.rzo, razorpay_payment_id: pay, razorpay_signature: goodSig, orderId: a.id } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const row = (await pool.query("SELECT payment_status, status, razorpay_payment_id FROM orders WHERE id=$1", [a.id])).rows[0];
  assert.deepEqual([row.payment_status, row.status, row.razorpay_payment_id], ["paid", "confirmed", pay]);
  // idempotent
  assert.equal((await api("POST", "/payments/verify", { body: { razorpay_order_id: a.rzo, razorpay_payment_id: pay, razorpay_signature: goodSig, orderId: a.id } })).status, 200);
});

test("webhook: bad signature rejected; correct amount marks paid; wrong amount does not", async () => {
  const good = await razorpayOrderInDb("400.00");
  const evt = (rzo, amount) => JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_wh1", order_id: rzo, amount, status: "captured" } } } });

  const badBody = evt(good.rzo, 40000);
  assert.equal((await api("POST", "/payments/webhook", { body: badBody, headers: { "x-razorpay-signature": "ab".repeat(32) } })).status, 400);

  const wrongAmt = evt(good.rzo, 100);
  await api("POST", "/payments/webhook", { body: wrongAmt, headers: { "x-razorpay-signature": sign(wrongAmt, WEBHOOK_SECRET) } });
  assert.equal((await pool.query("SELECT payment_status FROM orders WHERE id=$1", [good.id])).rows[0].payment_status, "pending");

  const okBody = evt(good.rzo, 40000);
  const r = await api("POST", "/payments/webhook", { body: okBody, headers: { "x-razorpay-signature": sign(okBody, WEBHOOK_SECRET) } });
  assert.equal(r.status, 200);
  assert.equal((await pool.query("SELECT payment_status FROM orders WHERE id=$1", [good.id])).rows[0].payment_status, "paid");
});

test("failed gateway order creation releases stock and cancels the order", async () => {
  const pid = await seedProduct("Gateway Fail", "100.00", 4);
  const r = await api("POST", "/orders", { body: customer({ paymentMethod: "razorpay", items: [{ productId: pid, quantity: 2 }] }) });
  assert.ok([502, 201].includes(r.status));
  if (r.status === 502) {
    assert.equal(await stockOf(pid), 4, "stock must be released");
    const row = (await pool.query("SELECT status, payment_status FROM orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 1", [`buyer-${sfx}@example.com`])).rows[0];
    assert.deepEqual([row.status, row.payment_status], ["cancelled", "failed"]);
  }
});

// ── Staff permissions (live DB check) ──────────────────────────────────────
test("staff: permissions are enforced server-side and blocking is immediate", async () => {
  const email = `support-${sfx}@example.com`;
  const created = await api("POST", "/staff", { token: adminToken, body: { name: "Sup", email, role: "support", permissions: ["dashboard", "orders"], password: "password123" } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const login = await api("POST", "/staff/login", { body: { email, password: "password123" } });
  assert.equal(login.status, 200);
  const t = login.body.token;

  const pid = await seedProduct("Staff Test", "100.00", 5);
  const o = await api("POST", "/orders", { body: customer({ items: [{ productId: pid, quantity: 1 }] }) });
  assert.equal((await api("PUT", `/orders/${o.body.id}`, { token: t, body: { status: "processing" } })).status, 200);
  assert.equal((await api("POST", "/products", { token: t, body: { name: "x", description: "d", price: 1, categoryId: 1, imageUrl: "x", slug: "x", stock: 1 } })).status, 403);
  assert.equal((await api("GET", "/coupons", { token: t })).status, 403);
  assert.equal((await api("GET", "/staff", { token: t })).status, 403);

  await api("PATCH", `/staff/${created.body.id}`, { token: adminToken, body: { isBlocked: true } });
  assert.equal((await api("PUT", `/orders/${o.body.id}`, { token: t, body: { status: "shipped" } })).status, 401, "blocked staff token must stop working immediately");
});
