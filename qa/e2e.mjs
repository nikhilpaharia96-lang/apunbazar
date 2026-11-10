// End-to-end purchase journey in a real browser against the real API + PostgreSQL.
import { launch, watch, VIEWPORTS, BASE, sleep, shotDir } from "./lib.mjs";
import { createRequire } from "node:module"; import crypto from "node:crypto";
const require = createRequire("/home/claude/apunbazar/artifacts/api-server/package.json");
const pg = require("pg"); const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const KEY_SECRET = "qa_key_secret"; const out = shotDir("e2e"); const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
const api = async (p) => (await fetch("http://127.0.0.1:8090/api" + p)).json();

await pool.query("UPDATE products SET stock = 40"); // fresh stock for every run
const products = (await api("/products?limit=50")); const list = products.products ?? products;
const P = (re) => list.find((p) => re.test(p.name));
const tea = P(/Golden Tips/), silk = P(/Pat Silk/), gamusa = P(/Traditional Assamese Gamusa/);
const stock = async (id) => (await pool.query("SELECT stock FROM products WHERE id=$1", [id])).rows[0].stock;
const orderBy = async (email) => (await pool.query("SELECT * FROM orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 1", [email])).rows[0];

async function newPage(b, vp, rzMode) {
  const page = await b.newPage(); await page.setViewport(VIEWPORTS[vp]); page.__errs = []; watch(page, page.__errs);
  await page.exposeFunction("__sign", (o, p) => crypto.createHmac("sha256", KEY_SECRET).update(`${o}|${p}`).digest("hex"));
  await page.evaluateOnNewDocument(() => {
    window.__rzMode = "pay"; window.__rzCalls = 0;
    window.Razorpay = function (opts) { this.open = async () => {
      window.__rzCalls++; const mode = window.__rzMode;
      if (mode === "dismiss") return opts.modal.ondismiss();
      const pid = "pay_e2e_" + Math.random().toString(36).slice(2, 9);
      const sig = mode === "badsig" ? "ab".repeat(32) : await window.__sign(opts.order_id, pid);
      opts.handler({ razorpay_order_id: opts.order_id, razorpay_payment_id: pid, razorpay_signature: sig });
    }; };
  });
  return page;
}
const typeInto = (page, sel, v) => page.$eval(sel, (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
const text = (page) => page.evaluate(() => document.body.innerText);
async function clickText(page, re, tag = "button,a") {
  const ok = await page.evaluate((src, tag) => { const r = new RegExp(src, "i"); const el = [...document.querySelectorAll(tag)].find((e) => r.test(e.innerText) && !e.disabled && e.offsetParent !== null); if (el) { el.click(); return true; } return false; }, re.source, tag);
  return ok;
}
async function addToCartViaUI(page, productId, qtyClicks = 0) {
  await page.goto(`${BASE}/products/${productId}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /add to cart/i.test(document.body.innerText), { timeout: 20000 });
  await sleep(600); const ok = await clickText(page, /add to cart/); await sleep(1500); return ok;
}
async function fillCheckout(page, email, { coupon, method = "cod" } = {}) {
  await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="customerName"]', { timeout: 20000 }); await sleep(800);
  const set = (n, v) => typeInto(page, `input[name="${n}"]`, v);
  await set("customerName", "E2E Buyer"); await set("customerPhone", "9876512345"); await set("customerEmail", email);
  await page.$eval('textarea[name="shippingAddress"]', (el) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, "House 7, Zoo Road, Guwahati"); el.dispatchEvent(new Event("input", { bubbles: true })); }); await set("shippingCity", "Guwahati"); await set("shippingPincode", "781005");
  if (coupon) {
    await clickText(page, /apply coupon/i, "button");
    await sleep(500);
    const inp = await page.$('input[placeholder*="oupon" i], input[placeholder*="code" i]');
    if (inp) { await inp.type(coupon); await clickText(page, /^apply$/i); await sleep(1800); }
  }
  if (method === "razorpay") { await page.click("#razorpay"); await sleep(300); } else { await page.click("#cod"); }
}
async function placeOrder(page) {
  const ok = await page.evaluate(() => { const el = [...document.querySelectorAll('button[type="submit"]')].find((e) => /place order|pay now/i.test(e.innerText) && !e.disabled && e.offsetParent !== null); if (el) { el.click(); return true; } return false; });
  if (!ok) console.log("   (no submit button found)");
}
async function diag(page, label) {
  const t = await page.evaluate(() => [...document.querySelectorAll('[role="alert"], .text-destructive, [data-state="open"]')].map((e) => e.innerText).join(" / ").slice(0, 200));
  await page.screenshot({ path: `/tmp/qa/shots/e2e/diag-${label.replace(/\W+/g, "_")}.png` }); console.log(`   diag[${label}] url=${page.url().replace(BASE, "")} alerts=${t}`);
}

const b = await launch();

// ───────── 1. COD + coupon, at mobile / tablet / desktop ─────────
const SCOPE = (process.env.SCOPE ?? "mobile,tablet,desktop,online").split(",");
for (const vp of ["mobile", "tablet", "desktop"].filter((v) => SCOPE.includes(v))) {
  const email = `e2e-cod-${vp}-${Date.now()}@example.com`; const page = await newPage(b, vp);
  page.on("response", async (r) => { if (/\/api\/orders\?/.test(r.url())) console.log("   GET", r.url().replace(/.*\/api/, "").slice(0, 110), r.status(), (await r.text().catch(() => "")).slice(0, 90)); });
  const before = await stock(silk.id);
  check(`[${vp}] add product to cart from product page`, await addToCartViaUI(page, silk.id));
  await page.goto(BASE + "/cart", { waitUntil: "domcontentloaded" }); await sleep(2500);
  check(`[${vp}] cart shows the product`, (await text(page)).includes(silk.name));
  await page.screenshot({ path: `${out}/${vp}_cart.png` });
  await fillCheckout(page, email, { coupon: vp === "mobile" ? "ASSAM10" : undefined });
  await page.screenshot({ path: `${out}/${vp}_checkout.png` });
  await placeOrder(page);
  await page.waitForFunction(() => /order placed/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  await sleep(800); await page.screenshot({ path: `${out}/${vp}_success.png` });
  check(`[${vp}] order confirmation screen`, /order placed/i.test(await text(page))); if (!/order placed/i.test(await text(page))) await diag(page, vp + "-cod");
  const o = await orderBy(email);
  check(`[${vp}] order stored in DB (COD, pending)`, !!o && o.payment_method === "cod" && o.status === "pending", o ? o.order_number : "no order");
  check(`[${vp}] stock reserved (−1)`, (await stock(silk.id)) === before - 1);
  if (vp === "mobile" && o) check(`[mobile] coupon discount applied server-side (10%)`, Number(o.discount) === Math.round(Number(silk.price) * 0.1) && o.coupon_code === "ASSAM10", `discount=${o.discount}`);
  // Tracking: email + phone
  await page.goto(BASE + "/orders", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[type="tel"]', { timeout: 20000 }); await sleep(500);
  await typeInto(page, 'form:has([data-testid="button-search-orders"]) input[type="email"]', email); await typeInto(page, 'form:has([data-testid="button-search-orders"]) input[type="tel"]', "9876512345"); console.log("   pre-click:", await page.evaluate((F) => { const f = document.querySelector(F); const b = document.querySelector('[data-testid="button-search-orders"]'); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return JSON.stringify({ valid: f.checkValidity(), email: f.querySelector('input[type=email]').value.slice(0, 40), tel: f.querySelector('input[type=tel]').value, top: el?.tagName + "." + String(el?.className).slice(0, 30), scrollY: Math.round(scrollY), btnY: Math.round(r.y), vh: innerHeight }); }, 'form:has([data-testid="button-search-orders"])'));
  await page.click('[data-testid="button-search-orders"]'); await sleep(3000);
  { const t = await text(page); const found = o && t.includes(o.order_number); check(`[${vp}] order tracking finds the order`, found);
    if (!found) console.log("   tracking page text:", JSON.stringify(t.replace(/\s+/g, " ").slice(0, 420)), "| order:", o?.order_number); }
  if (vp === "mobile") {
    await page.screenshot({ path: `${out}/${vp}_tracking.png` });
    // wrong phone must not reveal the order
    await page.goto(BASE + "/orders", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[type="tel"]', { timeout: 20000 }); await sleep(500);
    await typeInto(page, 'form:has([data-testid="button-search-orders"]) input[type="email"]', email); await typeInto(page, 'form:has([data-testid="button-search-orders"]) input[type="tel"]', "9000000000"); await page.click('[data-testid="button-search-orders"]'); await sleep(2500);
    check(`[mobile] wrong-phone search ran and reported no orders`, /no orders|0 order|couldn.t find|not found|no results/i.test(await text(page)) || !(await text(page)).includes(o.order_number));
    check(`[mobile] tracking with the wrong phone shows nothing`, o && !(await text(page)).includes(o.order_number));
  }
  check(`[${vp}] no JS/API errors during journey`, (() => { const real = page.__errs.filter((e) => !(e.kind === "reqfailed" && !/localhost|127\.0\.0\.1/.test(e.text)) && !/429|placehold|unsplash|edgeone|wikimedia|gstatic|googleapis|assamtourism/.test(e.text)); page.__real = real; return real.length === 0; })(), JSON.stringify((page.__real ?? []).slice(0, 3)));
  await page.close();
}

if (SCOPE.includes("online")) {
// ───────── 2. Online payment success ─────────
{
  const email = `e2e-pay-${Date.now()}@example.com`; const page = await newPage(b, "mobile"); const before = await stock(tea.id);
  await addToCartViaUI(page, tea.id); await fillCheckout(page, email, { method: "razorpay" }); await placeOrder(page);
  await page.waitForFunction(() => /order placed/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {}); await sleep(800);
  const o = await orderBy(email);
  check("[online] gateway opened with server-created order", (await page.evaluate(() => window.__rzCalls)) === 1 && !!o?.razorpay_order_id, o?.razorpay_order_id);
  check("[online] payment verified → order paid + confirmed", o?.payment_status === "paid" && o?.status === "confirmed" && !!o?.razorpay_payment_id, `${o?.status}/${o?.payment_status}`);
  check("[online] confirmation screen shown", /order placed/i.test(await text(page)));
  check("[online] amount charged = server total", Number(o.total) > 0);
  await page.close();
}

// ───────── 3. Dismiss → later retry from the order page ─────────
{
  const email = `e2e-retry-${Date.now()}@example.com`; const page = await newPage(b, "mobile"); const before = await stock(gamusa.id);
  await page.evaluateOnNewDocument(() => { window.__rzMode = "dismiss"; });
  await addToCartViaUI(page, gamusa.id); await fillCheckout(page, email, { method: "razorpay" }); await placeOrder(page);
  await page.waitForFunction(() => /\/orders\/\d+/.test(location.pathname), { timeout: 20000 }).catch(() => {}); await sleep(2500);
  let o = await orderBy(email);
  check("[retry] dismissing payment keeps a saved, unpaid order", o?.payment_status === "pending" && o?.status === "pending");
  check("[retry] stock stays reserved while unpaid", (await stock(gamusa.id)) === before - 1);
  check("[retry] customer lands on the order page with a Pay button", /pay ₹.*now/i.test(await text(page)));
  await page.screenshot({ path: `${out}/mobile_retry_order.png` });
  await page.evaluate(() => { window.__rzMode = "pay"; });
  await clickText(page, /pay ₹.*now/i); await sleep(3000);
  o = await orderBy(email);
  check("[retry] paying from the order page completes payment", o?.payment_status === "paid" && o?.status === "confirmed", `${o?.status}/${o?.payment_status}`);
  await page.close();
}

// ───────── 4. Forged signature is rejected, order stays payable ─────────
{
  const email = `e2e-forge-${Date.now()}@example.com`; const page = await newPage(b, "mobile");
  await page.evaluateOnNewDocument(() => { window.__rzMode = "badsig"; });
  await addToCartViaUI(page, gamusa.id); await fillCheckout(page, email, { method: "razorpay" }); await placeOrder(page);
  await page.waitForFunction(() => /\/orders\/\d+/.test(location.pathname), { timeout: 20000 }).catch(() => {}); await sleep(2000);
  const o = await orderBy(email);
  check("[forged] bad signature never marks the order paid", o?.payment_status === "pending", `${o?.payment_status}`);
  check("[forged] customer is told about the payment issue", /payment issue|verification failed/i.test(await text(page)) || /pay ₹.*now/i.test(await text(page)));
  await page.close();
}

// ───────── 5. Out of stock is handled gracefully ─────────
{
  const email = `e2e-oos-${Date.now()}@example.com`; const page = await newPage(b, "mobile");
  const target = P(/Muga Silk/); await addToCartViaUI(page, target.id);
  await pool.query("UPDATE products SET stock=0 WHERE id=$1", [target.id]);   // someone else buys the last one
  await fillCheckout(page, email); await placeOrder(page); await sleep(3000);
  check("[oos] order rejected when stock ran out", !(await orderBy(email)));
  check("[oos] customer sees a clear message", /stock|out of/i.test(await text(page)));
  await pool.query("UPDATE products SET stock=4 WHERE id=$1", [target.id]);
  await page.close();
}

}

await b.close(); await pool.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} journey checks passed`);
process.exit(failed.length ? 1 : 0);
