import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { ToastProvider } from "./components/ToastProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas-neue",
  display: "swap",
});

const lemonMilk = localFont({
  src: [
    {
      path: "./fonts/LEMONMILK-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/LEMONMILK-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/LEMONMILK-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-lemon-milk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Football Kit Archive",
  description: "Colección privada de camisetas de fútbol y baloncesto.",
  applicationName: "Football Kit Archive",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`h-full antialiased ${inter.variable} ${bebasNeue.variable} ${lemonMilk.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {"try{var t=localStorage.getItem('theme')||'system';var r=t==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;document.documentElement.dataset.theme=r;}catch(e){}"}
        </Script>
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
