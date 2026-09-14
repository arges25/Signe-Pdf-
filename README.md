# Signé

Application de signature de PDF, 100 % côté client : le document ne quitte
jamais l'appareil de l'utilisateur (aucun envoi à un serveur).

Voir `LIRE-MOI.txt` pour une présentation en français, simple, destinée à
un utilisateur non développeur.

## Stack technique

- [Vite](https://vite.dev) + React 19 + TypeScript
- Tailwind CSS 4, composants [shadcn/ui](https://ui.shadcn.com) vendus dans `src/components/ui`
- [pdf-lib](https://pdf-lib.js.org) (écriture du PDF) + [pdfjs-dist](https://mozilla.github.io/pdf.js/) (aperçu du PDF)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (Workbox) pour le manifest et le service worker de la PWA

Le résultat du build (`npm run build`) est un site **statique** (HTML/CSS/JS),
déployable sur n'importe quel hébergeur : Cloudflare Pages, Netlify, Vercel,
GitHub Pages, ou tout serveur de fichiers statiques. Le projet n'a aucune
dépendance à une plateforme d'hébergement particulière.

## Développement

Prérequis : Node.js ≥ 20.19.

```sh
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # build de production dans dist/
npm run preview  # prévisualiser le build de production
npm run lint      # vérifie le code (ESLint)
```

## Structure

- `src/App.tsx` — logique principale de l'éditeur PDF
- `src/signature-dialog.tsx` — création de la signature (dessin ou saisie du nom)
- `src/lib/pdf-signing.ts` — insertion de la signature dans le PDF
- `src/styles/globals.css` — présentation, thème et adaptation mobile
- `src/components/ui/` — bibliothèque de composants shadcn/ui
- `public/` — polices, favicon et ressources pdf.js (worker, cmaps, polices standard, wasm)
- `public/icons/`, `public/apple-touch-icon.png`, `public/favicon-32.png` — icônes de l'application (PWA / iOS / Android)
- `design/icon-sources/` — sources SVG du logo, pour régénérer les icônes si besoin (rendu à la taille voulue dans un navigateur puis export PNG)

## PWA

Le site est une Progressive Web App : `manifest.webmanifest` et le service
worker (précache de l'app shell, mise en cache à la demande des ressources
pdf.js) sont générés automatiquement au build par `vite-plugin-pwa`
(configuré dans `vite.config.ts`). Rien à faire manuellement après
`npm run build` — le lien `<link rel="manifest">` et l'enregistrement du
service worker sont injectés dans `dist/index.html`.
