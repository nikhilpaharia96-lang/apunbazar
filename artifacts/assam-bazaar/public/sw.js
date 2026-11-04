// Minimal service worker — app installable banane ke liye (Chrome/Android ko chahiye)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
