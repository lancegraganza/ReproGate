import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { WalletProvider } from "@/features/wallet/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReproGate", template: "%s · ReproGate" },
  description:
    "Independent GitHub bug reproduction with structured evidence and transparent Stellar Testnet rewards.",
  icons: { icon: "/reprogatelogo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <WalletProvider>{children}</WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
