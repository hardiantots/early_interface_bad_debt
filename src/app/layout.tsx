import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bad Debt Early-Warning | Kalla Group",
  description: "Sistem deteksi dini risiko bad debt berbasis machine learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen antialiased transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
