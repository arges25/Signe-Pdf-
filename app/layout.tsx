import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signé — Signez vos PDF simplement",
  description: "Importez votre PDF, ajoutez votre signature et téléchargez votre document signé. Vos fichiers restent sur votre appareil.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
