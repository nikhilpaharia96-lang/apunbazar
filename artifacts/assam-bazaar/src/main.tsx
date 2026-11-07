import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getBestAuthToken } from "@/lib/api";

// Admin/staff API calls (products, orders…) carry the JWT; the server enforces permissions
setAuthTokenGetter(getBestAuthToken);

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root nahi mila — index.html check karo");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker — app install support (sirf production mein)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
