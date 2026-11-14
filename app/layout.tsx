import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omail — Outlook OAuth2 OTP & Inbox Reader",
  description: "Cek OTP & kotak masuk Outlook secara instan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
