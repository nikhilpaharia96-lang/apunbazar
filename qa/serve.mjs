// Static server for the built SPA with /api proxy → API server (mirrors the Vercel rewrite)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = "/home/claude/apunbazar/artifacts/assam-bazaar/dist/public";
const API = { host: "127.0.0.1", port: 8090 };
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml", ".ico": "image/x-icon" };
http.createServer((req, res) => {
  if (req.url.startsWith("/api")) {
    const p = http.request({ ...API, path: req.url, method: req.method, headers: { ...req.headers, host: "localhost" } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on("error", () => { res.writeHead(502); res.end("bad gateway"); }); req.pipe(p); return;
  }
  let f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "index.html");
  const ext = path.extname(f);
  const headers = { "Content-Type": types[ext] ?? "application/octet-stream" };
  if (f.includes("/assets/")) headers["Cache-Control"] = "public, max-age=31536000, immutable";
  res.writeHead(200, headers); fs.createReadStream(f).pipe(res);
}).listen(5199, () => console.log("static on 5199"));
