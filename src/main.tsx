import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./i18n";
import "./styles/globals.css";

// The default HTML-injected service worker registration only registers —
// it never reloads an already-open page once a new version has activated,
// so a tab left open (or restored by the browser) can keep running old
// code indefinitely even though the new one is already installed. Calling
// the plugin's own registerSW() wires up that missing piece: with
// registerType "autoUpdate" it reloads automatically as soon as the new
// service worker takes over.
//
// That reload only fires once the browser actually checks for a new
// service worker, and browsers only do that on navigation (or roughly
// once every 24h in the background) — a tab left open and never
// reloaded across a deploy can sit on the old version well past that.
// Polling registration.update() ourselves (every 60s while the tab is
// visible, and immediately whenever it regains focus) closes that gap
// without waiting on the browser's own schedule.
if ("serviceWorker" in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    },
  });
}

const container = document.getElementById("root");
if (!container) throw new Error("Élément racine #root introuvable.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
