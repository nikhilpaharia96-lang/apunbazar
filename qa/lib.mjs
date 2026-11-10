import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import fs from "node:fs";
export const BASE = "http://localhost:5199";
export const VIEWPORTS = {
  mobile:  { width: 390,  height: 844,  deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet:  { width: 820,  height: 1180, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900,  deviceScaleFactor: 1 },
};
export async function launch() {
  return puppeteer.launch({ args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"], executablePath: await chromium.executablePath(), headless: "shell" });
}
/** Attach listeners collecting console errors, failed requests and HTTP >= 400 */
export function watch(page, bucket) {
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(m.text())) bucket.push({ kind: "console", text: m.text().slice(0, 200), url: page.url() }); });
  page.on("pageerror", (e) => bucket.push({ kind: "pageerror", text: String(e).slice(0, 200), url: page.url() }));
  page.on("requestfailed", (r) => { if (!/google|clarity|facebook|fonts\.g|razorpay/.test(r.url())) bucket.push({ kind: "reqfailed", text: r.url().slice(0, 120), url: page.url() }); });
  page.on("response", (r) => { if (r.status() >= 400 && !/google|clarity/.test(r.url())) bucket.push({ kind: "http" + r.status(), text: r.url().slice(0, 120), url: page.url() }); });
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
export function shotDir(name) { fs.mkdirSync(`/tmp/qa/shots/${name}`, { recursive: true }); return `/tmp/qa/shots/${name}`; }
