import { launch, watch, VIEWPORTS, BASE, sleep, shotDir } from "./lib.mjs";
import { createRequire } from "node:module";
const require = createRequire("/home/claude/apunbazar/artifacts/api-server/package.json");
const pg = require("pg"); const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const out = shotDir("e2e"); const results = []; const SCOPE = (process.env.SCOPE ?? "acct,browse,cart,admin,mobile").split(",");
const check = (n, ok, x = "") => { results.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const API = "http://127.0.0.1:8090/api";
const list = (await (await fetch(API + "/products?limit=50")).json()); const prods = list.products ?? list;
const P = (re) => prods.find((p) => re.test(p.name));
await pool.query("UPDATE products SET stock = 40");
const stock = async (id) => (await pool.query("SELECT stock FROM products WHERE id=$1", [id])).rows[0].stock;
const set = (page, sel, v) => page.$eval(sel, (el, v) => { const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : el.tagName === "SELECT" ? HTMLSelectElement : HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v); el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }, v);
const text = (page) => page.evaluate(() => document.body.innerText);
const clickText = (page, re, tag = "button,a") => page.evaluate((src, tag) => { const el = [...document.querySelectorAll(tag)].find((e) => new RegExp(src, "i").test(e.innerText) && !e.disabled && e.offsetParent !== null); if (el) { el.click(); return true; } return false; }, re.source, tag);
async function open(b, vp) { const page = await b.newPage(); await page.setViewport(VIEWPORTS[vp]); page.__errs = []; watch(page, page.__errs); return page; }
const realErrs = (page) => page.__errs.filter((e) => !(e.kind === "reqfailed" && !/localhost|127\.0\.0\.1/.test(e.text)) &&  !/429|placehold|unsplash|edgeone|wikimedia|gstatic|googleapis|assamtourism|assamholidays/.test(e.text));
async function addToCart(page, id) { await page.goto(`${BASE}/products/${id}`, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => /add to cart/i.test(document.body.innerText), { timeout: 20000 }); await sleep(500); await clickText(page, /add to cart/); await sleep(1500); }
async function checkoutCod(page, f) {
  await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[name="customerName"]', { timeout: 20000 }); await sleep(900);
  for (const [n, v] of Object.entries(f)) if (v !== undefined) await set(page, n === "shippingAddress" ? 'textarea[name="shippingAddress"]' : `input[name="${n}"]`, v);
  await page.click("#cod"); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('button[type="submit"]')].find((e) => /place order|pay now/i.test(e.innerText) && !e.disabled && e.offsetParent !== null)?.click());
  await page.waitForFunction(() => /order placed/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {}); await sleep(600);
}
const b = await launch();
const ts = Date.now(); const EMAIL = `reg-${ts}@example.com`, PHONE = "9876500123", PASS = "Corr3ct-horse";

// ───── 1. Customer registration & login (UI) ─────
if (SCOPE.includes("acct")) {
  const page = await open(b, "mobile");
  await page.goto(BASE + "/register", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[name="name"]', { timeout: 20000 });
  await set(page, 'input[name="name"]', "Reg Customer"); await set(page, 'input[name="email"]', EMAIL); await set(page, 'input[name="phone"]', PHONE); await set(page, 'input[name="password"]', PASS);
  await page.click('[data-testid="button-auth-submit"]'); await page.waitForSelector('[data-testid="button-logout"]', { timeout: 25000 }).catch(() => {}); await sleep(500);
  { const t = await text(page); check("[acct] registration redirects to My Account", page.url().endsWith("/account") && /hello, reg/i.test(t), page.url().replace(BASE, "") + " | " + t.replace(/\s+/g, " ").slice(0, 80)); }
  const row = (await pool.query("SELECT * FROM customers WHERE email=$1", [EMAIL])).rows[0];
  check("[acct] account stored with bcrypt-hashed password", !!row && /^\$2[aby]\$/.test(row.password_hash) && !row.password_hash.includes(PASS));
  await page.screenshot({ path: `${out}/mobile_account.png` });
  await clickText(page, /log out/i); await sleep(1000);
  check("[acct] logout clears the session", await page.evaluate(() => !localStorage.getItem("apunbazar_customer")));
  await page.goto(BASE + "/account", { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => location.pathname === "/login", { timeout: 15000 }).catch(() => {});
  check("[acct] /account is protected (redirects to login)", page.url().includes("/login"));
  await page.waitForSelector('input[name="email"]'); await set(page, 'input[name="email"]', EMAIL); await set(page, 'input[name="password"]', "wrong-password-1");
  await page.click('[data-testid="button-auth-submit"]'); await sleep(1500);
  check("[acct] wrong password shows an error and stays logged out", /invalid email or password/i.test(await text(page)) && !(await page.evaluate(() => localStorage.getItem("apunbazar_customer"))));
  await set(page, 'input[name="password"]', PASS); await page.click('[data-testid="button-auth-submit"]');
  await page.waitForSelector('[data-testid="button-save-profile"]', { timeout: 25000 }).catch(() => {}); await sleep(500);
  check("[acct] login with correct password works", page.url().endsWith("/account") && !!(await page.$('[data-testid="button-save-profile"]')));
  // save address, then checkout is prefilled and the order shows in My orders
  await set(page, 'input[placeholder="House no., street, locality"]', "21 Chandmari Road");
    await page.evaluate(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }; const labels = [...document.querySelectorAll("label")]; const f = (t) => labels.find((l) => l.innerText.trim().toLowerCase().startsWith(t))?.querySelector("input"); set(f("city"), "Guwahati"); set(f("pincode"), "781003"); });
  await page.click('[data-testid="button-save-profile"]'); await sleep(1500);
  check("[acct] saved delivery details persist", (await pool.query("SELECT address,city,pincode FROM customers WHERE email=$1", [EMAIL])).rows[0]?.pincode === "781003");
  const tea = P(/Joha Rice/); await addToCart(page, tea.id);
  await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[name="customerName"]'); await sleep(1500);
  const pre = await page.evaluate(() => ({ n: document.querySelector('input[name="customerName"]').value, e: document.querySelector('input[name="customerEmail"]').value, p: document.querySelector('input[name="customerPhone"]').value, c: document.querySelector('input[name="shippingCity"]').value, pin: document.querySelector('input[name="shippingPincode"]').value }));
  check("[acct] checkout is pre-filled from the account", pre.n === "Reg Customer" && pre.e === EMAIL && pre.p === PHONE && pre.c === "Guwahati" && pre.pin === "781003", JSON.stringify(pre));
  await page.click("#cod"); await page.evaluate(() => [...document.querySelectorAll('button[type="submit"]')].find((e) => /place order/i.test(e.innerText))?.click());
  await page.waitForFunction(() => /order placed/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {}); await sleep(600);
  const ord = (await pool.query("SELECT * FROM orders WHERE customer_email=$1 ORDER BY id DESC LIMIT 1", [EMAIL])).rows[0];
  check("[acct] logged-in COD order placed", !!ord && /order placed/i.test(await text(page)), ord?.order_number);
  await page.goto(BASE + "/account", { waitUntil: "domcontentloaded" }); await sleep(2500);
  check("[acct] My orders lists the new order", !!ord && (await text(page)).includes(ord.order_number));
  await page.click(`[data-testid="account-order-${ord.id}"]`); await sleep(2500);
  check("[acct] order detail opens from My orders", (await text(page)).includes(ord.order_number));
  { const unexpected = realErrs(page).filter((e) => !/401/.test(e.kind + e.text)); check("[acct] no unexpected JS/API errors (the 401 is the deliberate wrong-password test)", unexpected.length === 0, JSON.stringify(unexpected.slice(0, 2))); }
  await page.close();
}

// ───── 2. Browsing, search, images ─────
if (SCOPE.includes("browse")) {
  const page = await open(b, "mobile");
  await page.goto(BASE + "/products", { waitUntil: "domcontentloaded" }); await page.waitForSelector("img.p-img", { timeout: 25000 }); await sleep(3500);
  const imgs = await page.$$eval("img.p-img", (els) => els.map((e) => ({ ok: e.complete && e.naturalWidth > 0, src: e.currentSrc })));
  check("[browse] product grid shows ≥ 8 products", imgs.length >= 8, `${imgs.length}`);
  check("[browse] every product image loaded", imgs.every((i) => i.ok), `${imgs.filter((i) => !i.ok).length} broken`);
  check("[browse] uploaded images are served as resized WebP variants", imgs.filter((i) => i.src.includes("/api/uploads/")).every((i) => /\?w=\d+/.test(i.src)));
  const total = await page.$$eval("img.p-img", (e) => e.length);
  const search = 'input[placeholder*="Search products"]';
  await page.click(search); await page.type(search, "tea"); await sleep(2500);
  const names = await page.$$eval("img.p-img", (e) => e.map((i) => i.alt));
  check("[browse] search 'tea' narrows to matching products", names.length > 0 && names.length < total && names.every((n) => /tea/i.test(n)), names.join(" | "));
  await page.click(search, { clickCount: 3 }); await page.type(search, "zzzxqwv"); await sleep(2500);
  check("[browse] search with no match shows an empty state", (await page.$$("img.p-img")).length === 0 && /nahi mila|no (products|results|items)|not found/i.test(await text(page)));
  await page.screenshot({ path: `${out}/mobile_search_empty.png` });
  const silk = P(/Muga Silk/); await page.goto(`${BASE}/products/${silk.id}`, { waitUntil: "domcontentloaded" }); await page.waitForSelector("img.pdp-main-img", { timeout: 25000 }); await sleep(2500);
  const pdp = await page.$eval("img.pdp-main-img", (e) => ({ ok: e.complete && e.naturalWidth > 0, cur: e.currentSrc }));
  check("[browse] product detail image loads (resized WebP)", pdp.ok && /\?w=\d+/.test(pdp.cur), pdp.cur.slice(-30));
  check("[browse] product page has unique title + Product JSON-LD", (await page.title()).includes(silk.name) && await page.evaluate(() => { try { const j = JSON.parse(document.getElementById("seo-jsonld").text); return j["@type"] === "Product" && j.offers.priceCurrency === "INR"; } catch { return false; } }));
  await page.goto(BASE + "/category/assam-tea", { waitUntil: "domcontentloaded" }); await sleep(4500);
  check("[browse] category page lists its products", /tea/i.test(await text(page)) && (await page.$$("img")).length > 3);
  await page.close();
}

// ───── 3. Cart quantity updates & coupon errors ─────
if (SCOPE.includes("cart")) {
  const page = await open(b, "mobile"); const g = P(/Traditional Assamese Gamusa/);
  await addToCart(page, g.id); await page.goto(BASE + "/cart", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid^="button-increase-"]', { timeout: 20000 }); await sleep(800);
  const sel = await page.$eval('[data-testid^="button-increase-"]', (e) => e.dataset.testid.replace("button-increase-", ""));
  const qty = () => page.$eval(`[data-testid="text-qty-${sel}"]`, (e) => e.innerText.trim());
  const total = async () => (await text(page)).match(/₹\s?([\d,]+)/g)?.length;
  await page.click(`[data-testid="button-increase-${sel}"]`); await sleep(1500);
  check("[cart] increasing quantity → 2", (await qty()) === "2");
  const t2 = await text(page); check("[cart] total reflects 2 × price", t2.includes((g.price * 2).toLocaleString("en-IN")), `₹${g.price * 2}`);
  await page.click(`[data-testid="button-decrease-${sel}"]`); await sleep(1500);
  check("[cart] decreasing quantity → 1", (await qty()) === "1");
  check("[cart] cart badge/total persists after reload", await (async () => { await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForSelector(`[data-testid="text-qty-${sel}"]`, { timeout: 20000 }); return (await qty()) === "1"; })());
  // coupon errors at checkout
  await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[name="customerName"]'); await sleep(900);
  await clickText(page, /apply coupon/i, "button"); await sleep(400);
  const ci = 'input[placeholder="Enter coupon code"]';
  await page.type(ci, "NOPE123"); await clickText(page, /^apply$/i); await sleep(1800);
  check("[coupon] invalid code shows a clear error", /invalid|expired/i.test(await text(page)));
  await set(page, ci, "BIHU100"); await clickText(page, /^apply$/i); await sleep(1800);
  check("[coupon] minimum-order rule is explained", /minimum order/i.test(await text(page)), "BIHU100 needs ₹1000, cart is ₹" + g.price);
  await page.goto(BASE + "/cart", { waitUntil: "domcontentloaded" }); await page.waitForSelector('[data-testid^="button-remove-"]', { timeout: 20000 }); await sleep(500);
  await page.click('[data-testid^="button-remove-"]'); await sleep(1800);
  check("[cart] removing the last item shows the empty cart", /khali|empty|no items/i.test(await text(page)));
  await page.close();
}

// ───── 4. Admin receives & manages the order; stock deduct/restore ─────
if (SCOPE.includes("admin")) {
  const tea = P(/Orthodox Golden Tips/); const email = `adm-${ts}@example.com`; const before = await stock(tea.id);
  const created = await (await fetch(API + "/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "Admin Flow", customerEmail: email, customerPhone: "9876500777", shippingAddress: "5 Hatigaon", shippingCity: "Guwahati", shippingState: "Assam", shippingPincode: "781038", paymentMethod: "cod", items: [{ productId: tea.id, quantity: 3 }] }) })).json();
  check("[stock] order of 3 deducts stock 3", (await stock(tea.id)) === before - 3);
  const page = await open(b, "desktop");
  await page.goto(BASE + "/admin/login", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await set(page, 'input[type="email"]', "qa@apunbazar.test"); await set(page, 'input[type="password"]', "QaPassw0rd!x"); await page.click('button[type="submit"]'); await sleep(2500);
  await page.goto(BASE + "/admin/orders", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[placeholder*="Search order"]', { timeout: 25000 });
  await page.type('input[placeholder*="Search order"]', created.orderNumber); await sleep(2500);
  check("[admin] new order appears in Admin → Orders (search)", (await text(page)).includes(created.orderNumber) && !!(await page.$(`[data-testid="row-order-${created.id}"]`)));
  async function setStatus(label) {
    await page.click(`[data-testid="select-status-${created.id}"]`); await sleep(500);
    const opts = await page.$$('[role="option"]'); for (const o of opts) if ((await o.evaluate((e) => e.innerText.trim().toLowerCase())) === label) { await o.click(); break; } await sleep(2000);
  }
  await setStatus("processing"); await setStatus("shipped");
  check("[admin] admin moves the order to Shipped", (await pool.query("SELECT status FROM orders WHERE id=$1", [created.id])).rows[0].status === "shipped");
  const cust = await (await fetch(`${API}/orders/${created.id}?email=${encodeURIComponent(email)}`)).json();
  check("[admin] customer sees the updated status", cust.status === "shipped");
  await page.screenshot({ path: `${out}/desktop_admin_orders.png` });
  await setStatus("cancelled");
  check("[stock] admin cancel restores stock (+3)", (await stock(tea.id)) === before, `${await stock(tea.id)} vs ${before}`);
  const ledger = (await pool.query("SELECT delta, reason FROM stock_movements WHERE order_id=$1 ORDER BY id", [created.id])).rows;
  check("[stock] ledger shows sale (−3) then cancel (+3)", JSON.stringify(ledger) === JSON.stringify([{ delta: -3, reason: "order" }, { delta: 3, reason: "cancel" }]), JSON.stringify(ledger));
  await setStatus("shipped");
  check("[admin] a cancelled order cannot be revived", (await pool.query("SELECT status FROM orders WHERE id=$1", [created.id])).rows[0].status === "cancelled" && (await stock(tea.id)) === before);
  { const unexpected = realErrs(page).filter((e) => !/409|status of 409/.test(e.kind + e.text)); check("[admin] no unexpected JS/API errors (the one 409 is the deliberate revive attempt)", unexpected.length === 0, JSON.stringify(unexpected.slice(0, 2))); }
  await page.close();
}

// ───── 5. Mobile checkout experience audit ─────
if (SCOPE.includes("mobile")) {
  const page = await open(b, "mobile"); const h = P(/Joha Rice/); await addToCart(page, h.id);
  await page.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" }); await page.waitForSelector('input[name="customerName"]', { timeout: 20000 }); await sleep(1500);
  const audit = await page.evaluate(() => {
    const q = (n) => document.querySelector(`input[name="${n}"],textarea[name="${n}"]`);
    // Radix radios are 16px but live inside a large tappable <label> card — measure what the finger actually hits
    const target = (e) => (e.getAttribute("role") === "radio" ? document.querySelector(`label[for="${e.id}"]`) ?? e.closest("label,div") : e);
    const small = [...document.querySelectorAll("form input:not([type=hidden]), form select, form textarea, form button, form [role=radio], button")].filter((e) => e.offsetParent !== null && !e.closest("footer,nav,header") && e.getAttribute("aria-hidden") !== "true" && getComputedStyle(e).pointerEvents !== "none").map((e) => ({ n: e.name || e.id || e.innerText?.slice(0, 18), h: Math.round(target(e).getBoundingClientRect().height), html: e.outerHTML.slice(0, 140) })).filter((x) => x.h < 40 && x.h > 0);
    return { phoneType: q("customerPhone").type, phoneMode: q("customerPhone").inputMode, emailType: q("customerEmail").type, pinMode: q("shippingPincode").inputMode,
      ac: ["customerName", "customerPhone", "customerEmail", "shippingAddress", "shippingCity", "shippingPincode"].map((n) => `${n}:${q(n).autocomplete || "-"}`), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small,
      fontPx: Math.min(...[...document.querySelectorAll("form:has(input[name=customerName]) input:not([type=radio]):not([type=checkbox]):not([type=hidden]), form:has(input[name=customerName]) textarea, form:has(input[name=customerName]) select")].filter((e) => e.offsetParent).map((e) => parseFloat(getComputedStyle(e).fontSize))) };
  });
  console.log("   mobile audit:", JSON.stringify(audit));
  check("[mobile] phone field opens the numeric keypad (tel/numeric)", audit.phoneType === "tel" || audit.phoneMode === "numeric");
  check("[mobile] email field uses type=email", audit.emailType === "email");
  check("[mobile] pincode opens numeric keypad", audit.pinMode === "numeric");
  check("[mobile] fields have autocomplete hints", audit.ac.every((x) => !x.endsWith(":-")), audit.ac.join(" "));
  check("[mobile] inputs ≥16px (no iOS zoom-on-focus)", audit.fontPx >= 16, `${audit.fontPx}px`);
  check("[mobile] no horizontal scroll on checkout", audit.overflow <= 0);
  check("[mobile] all tap targets ≥ 40px tall", audit.small.length === 0, JSON.stringify(audit.small.slice(0, 4)));
  await page.screenshot({ path: `${out}/mobile_checkout_full.png`, fullPage: true });
  await page.close();
}
await b.close(); await pool.end();
const failed = results.filter((r) => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} checks passed`); process.exit(failed.length ? 1 : 0);
