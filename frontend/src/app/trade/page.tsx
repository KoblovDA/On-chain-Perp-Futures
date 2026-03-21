"use client";

import { TradePanel } from "@/components/trade/TradePanel";

export default function TradePage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Trade</h1>
        <p className="mt-2 text-zinc-400">
          Open leveraged long/short positions on WETH/USDC via Aave V3 Flash Loans
        </p>
      </div>
      <TradePanel />
    </div>
  );
}
