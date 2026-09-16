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
if ("serviceWorker" in navigator) registerSW({ immediate: true });

const container = document.getElementById("root");
if (!container) throw new Error("Élément racine #root introuvable.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
