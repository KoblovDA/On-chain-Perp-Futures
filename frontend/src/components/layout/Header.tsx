"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV_ITEMS = [
  { href: "/trade", label: "Trade" },
  { href: "/positions", label: "Positions" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/trade" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 font-bold text-white text-sm">
            LT
          </div>
          <span className="hidden sm:inline text-lg font-semibold text-white">
            Leveraged Trading
          </span>
          <span className="hidden sm:inline rounded-full bg-amber-600/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
            Sepolia
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet */}
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
        />
      </div>
    </header>
  );
}
