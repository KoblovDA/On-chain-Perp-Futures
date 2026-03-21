import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import { Header } from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Leveraged Trading | Aave V3 Flash Loans",
  description:
    "Open leveraged long/short positions on WETH/USDC using Aave V3 flash loans on Sepolia testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100 antialiased`}
      >
        <Web3Provider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Web3Provider>
      </body>
    </html>
  );
}
