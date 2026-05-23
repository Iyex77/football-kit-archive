import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Colección Camisetas",
  description: "Mi colección personal de camisetas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}