import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Funcap",
  description: "Community singles tennis tournaments.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
