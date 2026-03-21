"use client";

export default function TradePage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-3xl font-bold">Trade</h1>
      <p className="text-zinc-400">
        Open leveraged long/short positions on WETH/USDC
      </p>
      {/* TradePanel component will go here */}
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-center text-zinc-500">
          Trading interface coming soon...
        </p>
      </div>
    </div>
  );
}
