import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MapFlow — Tu copiloto financiero",
  description:
    "MapFlow es el copiloto financiero para dueños de PYMEs: cobra, controla y crece.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
