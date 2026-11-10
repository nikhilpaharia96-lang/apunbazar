// QA-ONLY (not part of the repo): redirects the Razorpay SDK's HTTPS calls to a local fake gateway.
const https = require("https"), http = require("http"), crypto = require("crypto");
const orders = new Map();
http.createServer((req, res) => {
  let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url.startsWith("/v1/orders")) {
      const b = JSON.parse(body || "{}"); const id = "order_" + crypto.randomBytes(7).toString("hex");
      const o = { id, entity: "order", amount: b.amount, currency: b.currency, receipt: b.receipt, status: "created", notes: b.notes ?? {} };
      orders.set(id, o); return res.end(JSON.stringify(o));
    }
    if (req.method === "GET" && /\/payments/.test(req.url)) return res.end(JSON.stringify({ entity: "collection", count: 0, items: [] }));
    res.statusCode = 404; res.end(JSON.stringify({ error: { description: "not found" } }));
  });
}).listen(9099, "127.0.0.1");
const orig = https.request;
https.request = function (o, ...rest) {
  if (o && typeof o === "object" && !(o instanceof URL) && /razorpay\.com$/.test(o.hostname || o.host || "")) {
    const { agent, ...clean } = o;
    return http.request({ ...clean, protocol: "http:", hostname: "127.0.0.1", host: "127.0.0.1", port: 9099, headers: { ...o.headers, host: "127.0.0.1:9099" } }, ...rest);
  }
  return orig.call(this, o, ...rest);
};
