import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motofy Garage",
  description: "The simple garage workspace.",
  other: {
    "codex-preview": "development",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="el">
      <body className="antialiased">
        <style>{`
          .brand-ver {
            margin-left: -3px;
            color: #7f8faa;
            font-size: 0 !important;
            font-weight: 650;
            line-height: 1;
            letter-spacing: .02em;
            opacity: .72;
          }
          .brand-ver::after {
            content: "v2.2.0";
            font-size: 8px;
          }
          .app-version {
            font-size: 0 !important;
          }
          .app-version::after {
            content: "Motofy v2.2.0 · Production";
            font-size: 10px;
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
