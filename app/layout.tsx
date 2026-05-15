import type { Metadata } from "next";
import { AdminAccessPanel } from "@/app/components/admin-access-panel";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Idea Factory",
  description: "AI-assisted YouTube production operations dashboard",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 이동
        </a>
        {children}
        <AdminAccessPanel />
      </body>
    </html>
  );
}
