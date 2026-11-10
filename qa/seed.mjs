// Seeds a QA database through the real API (admin login, validated uploads, product creation, orders)
import fs from "node:fs"; import { createRequire } from "node:module";
const require = createRequire("/home/claude/apunbazar/artifacts/api-server/package.json");
const pg = require("pg"); const crypto = require("node:crypto");
const BASE = "http://127.0.0.1:8090/api"; const KS = "qa_key_secret";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const j = async (m, p, b, t, h = {}) => { const r = await fetch(BASE + p, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...h }, body: b ? JSON.stringify(b) : undefined }); const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${JSON.stringify(x)}`); return x; };
const up = async (name, t) => { const r = await fetch(BASE + "/uploads/product-image", { method: "POST", headers: { "Content-Type": "image/jpeg", Authorization: `Bearer ${t}` }, body: fs.readFileSync(`img/${name}.jpg`) }); const x = await r.json(); if (!r.ok) throw new Error("upload " + JSON.stringify(x)); return x.url; };
const { token } = await j("POST", "/admin/login", { email: "qa@apunbazar.test", password: "QaPassw0rd!x" });

const cats = [["Assam Tea","assam-tea","cat_tea"],["Traditional Clothing","traditional-clothing","cat_cloth"],["Gamusa","gamusa","cat_gamusa"],["Handloom Products","handloom","cat_handloom"],["Bamboo & Handicrafts","bamboo-handicrafts","cat_bamboo"],["Traditional Foods","traditional-foods","cat_food"],["Local Assamese Products","local-products","cat_craft"]];
const catId = {};
for (const [name, slug, img] of cats) { const c = await j("POST", "/categories/main", { name, slug, description: `Authentic ${name} from Assam`, imageUrl: await up(img, token) }, token); catId[slug] = c.id; }

const P = [
 ["assam-tea","Assam CTC Black Tea 500g","Bold, malty everyday Assam tea from Dibrugarh gardens.",280,340,"tea1",60,"Dibrugarh","true"],
 ["assam-tea","Orthodox Golden Tips Tea 250g","Hand-rolled orthodox leaf with golden tips and a honeyed finish.",890,1090,"tea2",25,"Jorhat","true"],
 ["assam-tea","Organic Green Tea 100g","Light, grassy organic green tea, hand-picked in the first flush.",420,null,"tea3",3,"Tinsukia","false"],
 ["traditional-clothing","Muga Silk Mekhela Chador","Golden Muga silk — Assam's own — woven by master weavers of Sualkuchi.",14500,16900,"cl1",4,"Sualkuchi","true"],
 ["traditional-clothing","Pat Silk Mekhela Chador","Lustrous Pat silk set with traditional motifs, ideal for Bihu & weddings.",6800,null,"cl2",9,"Sualkuchi","true"],
 ["traditional-clothing","Eri Silk Shawl","Warm, soft Eri (Ahimsa) silk shawl, naturally cruelty-free.",3200,3600,"cl3",14,"Nagaon","false"],
 ["gamusa","Traditional Assamese Gamusa","The iconic red-bordered cotton gamusa — a symbol of Assamese respect.",350,null,"ga1",120,"Barpeta","true"],
 ["gamusa","Handwoven Phulam Gamusa","Floral phulam gamusa with intricate hand-woven motifs.",650,750,"ga2",40,"Barpeta","false"],
 ["handloom","Handloom Cotton Table Runner","Handwoven cotton runner with Assamese border motifs.",799,null,"hl1",22,"Sualkuchi","false"],
 ["handloom","Handloom Cushion Cover Set","Set of two handwoven cushion covers, 16×16 inch.",1100,1300,"hl2",0,"Sualkuchi","false"],
 ["bamboo-handicrafts","Bamboo Jaapi (Decorative)","Traditional Assamese conical hat, crafted from bamboo and cane.",1200,null,"ba1",18,"Nalbari","true"],
 ["bamboo-handicrafts","Cane & Bamboo Basket Set","Set of three nesting baskets, handwoven by Assam artisans.",950,1100,"ba2",12,"Jorhat","false"],
 ["bamboo-handicrafts","Bamboo Serving Tray","Natural bamboo serving tray with a smooth lacquer finish.",540,null,"ba3",30,"Nalbari","false"],
 ["traditional-foods","Joha Rice 1kg","Fragrant Joha — Assam's GI-tagged aromatic rice.",260,300,"fo1",80,"Golaghat","true"],
 ["traditional-foods","Pitha Mix Powder 500g","Ready-to-cook rice flour mix for traditional Assamese pitha.",180,null,"fo2",45,"Sivasagar","false"],
 ["traditional-foods","Bhut Jolokia Pickle 250g","Fiery ghost-pepper pickle made in small batches.",320,null,"fo3",5,"Tezpur","false"],
 ["traditional-foods","Pure Jorhat Honey 500g","Raw forest honey from Assam's foothills.",450,520,"fo4",35,"Jorhat","false"],
 ["local-products","Bell Metal Kahi Set","Traditional Assamese bell metal serving set from Sarthebari.",2400,null,"cr1",8,"Sarthebari","true"],
];
const pid = [];
for (const [c, name, description, price, op, img, stock, origin, feat] of P) {
  const url = await up(img, token);
  const p = await j("POST", "/products", { name, description, price, originalPrice: op, categoryId: catId[c], imageUrl: url, images: [url], stock, featured: feat === "true", origin, artisan: "Local Assam artisans", tags: ["assam", "handmade"] }, token);
  pid.push(p.id);
}
// Coupons
await j("POST", "/coupons", { code: "ASSAM10", discountType: "percent", discountValue: 10, minimumOrderValue: 500 }, token);
await j("POST", "/coupons", { code: "BIHU100", discountType: "flat", discountValue: 100, minimumOrderValue: 1000, maxUses: 50 }, token);

// Orders spread over 30 days
const names = ["Priya Das","Rahul Borah","Anjali Gogoi","Bikash Kalita","Meera Saikia","Dipankar Hazarika","Nandita Baruah","Jyoti Phukan"];
const cities = ["Guwahati","Jorhat","Dibrugarh","Silchar","Tezpur","Nagaon"];
let seq = 0; const made = [];
for (let d = 29; d >= 0; d--) {
  const n = 1 + (d % 3);
  for (let k = 0; k < n; k++) {
    const nm = names[(seq + k) % names.length]; const e = nm.toLowerCase().replace(" ", ".") + "@example.com";
    const items = [{ productId: pid[(seq * 3) % pid.length], quantity: 1 + (seq % 2) }]; if (seq % 3 === 0) items.push({ productId: pid[(seq * 5 + 1) % pid.length], quantity: 1 });
    const stockRows = await pool.query("SELECT id, stock FROM products WHERE id = ANY($1)", [items.map(i => i.productId)]);
    if (stockRows.rows.some(r => r.stock < 3)) { seq++; continue; }
    const o = await j("POST", "/orders", { customerName: nm, customerEmail: e, customerPhone: "9" + String(876543210 + seq).slice(0, 9), shippingAddress: `${10 + seq}, Station Road`, shippingCity: cities[seq % cities.length], shippingState: "Assam", shippingPincode: "781001", paymentMethod: "cod", items });
    made.push({ id: o.id, d, seq }); seq++;
  }
}
for (const m of made) {
  await pool.query("UPDATE orders SET created_at = now() - ($1 || ' days')::interval - ($2 || ' hours')::interval WHERE id=$3", [String(m.d), String(m.seq % 10), m.id]);
  const status = m.d > 8 ? "delivered" : m.d > 4 ? "shipped" : m.d > 1 ? "processing" : "pending";
  if (m.seq % 11 === 0) await j("PUT", `/orders/${m.id}`, { status: "cancelled" }, token);
  else await j("PUT", `/orders/${m.id}`, { status }, token);
}
// Online paid orders (as if Razorpay verified), one unpaid awaiting, one late-paid cancelled (refund needed)
const mkOnline = async (idx, paid, status, ageH) => {
  const p = (await pool.query("SELECT id, name, price FROM products WHERE id=$1", [pid[idx]])).rows[0];
  const rzo = "order_" + crypto.randomBytes(6).toString("hex");
  await pool.query(`INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, items, subtotal, shipping_fee, total, status, payment_method, payment_status, razorpay_order_id, razorpay_payment_id, created_at)
    VALUES ($1,$2,$3,'9876501234','22 MG Road','Guwahati','Assam','781005',$4,$5,0,$5,$6,'razorpay',$7,$8,$9, now() - ($10 || ' hours')::interval)`,
    ["ABQ" + crypto.randomBytes(4).toString("hex").toUpperCase(), "Online Buyer", `online${idx}@example.com`, JSON.stringify([{ productId: p.id, name: p.name, price: Number(p.price), quantity: 1 }]), p.price, status, paid ? "paid" : "pending", rzo, paid ? "pay_" + crypto.randomBytes(5).toString("hex") : null, String(ageH)]);
};
await mkOnline(3, true, "confirmed", 30); await mkOnline(1, true, "processing", 60); await mkOnline(13, true, "delivered", 200);
await mkOnline(4, false, "pending", 1); await mkOnline(5, true, "cancelled", 70);
console.log("seeded", pid.length, "products,", made.length, "cod orders");
await pool.end();
