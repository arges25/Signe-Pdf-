import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Most hosts (Netlify, Vercel, Cloudflare Pages...) serve the site from the
// domain root. GitHub Pages serves a project site from a /<repo>/ subpath,
// so the CI workflow that deploys there sets VITE_BASE_PATH accordingly.
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "Signé — Signature de PDF",
        short_name: "Signé",
        description:
          "Importez un PDF, ajoutez votre signature et téléchargez le document signé. Vos fichiers restent sur votre appareil.",
        lang: "fr",
        dir: "ltr",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f9fafc",
        theme_color: "#2457ea",
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: `${base}icons/maskable-192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: `${base}icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache only the app shell (JS/CSS/HTML, icons, the UI fonts). The
        // pdf.js worker, wasm and per-encoding cmaps are large and lazily
        // loaded only when actually needed, so they are runtime-cached
        // instead of bloating the initial install.
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        // The CV builder's font library (public/fonts/cv/) is large and
        // mostly unused per visit — only the handful of families a given
        // CV actually selects are ever needed — so, like pdf-assets, it's
        // fetched and cached at runtime on first use instead of being
        // downloaded on every install.
        globIgnores: ["pdf-assets/**", "fonts/cv/**"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // NOTE: this becomes a standalone function in the generated
            // service worker (workbox-build stringifies it), so it must not
            // close over anything from this config file — `base` would be
            // undefined at runtime and throw on every fetch. Matching on the
            // path segment alone works regardless of the base prefix.
            urlPattern: /\/pdf-assets\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pdf-assets-v2",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/fonts\/cv\//,
            handler: "CacheFirst",
            options: {
              cacheName: "cv-fonts-v1",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
