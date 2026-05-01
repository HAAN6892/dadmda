import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "다듬다",
  description: "개떡같이 던지면 찰떡같이 다듬어줍니다",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
