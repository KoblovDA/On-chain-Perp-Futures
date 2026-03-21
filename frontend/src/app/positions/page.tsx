"use client";

export default function PositionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Positions</h1>
      <p className="text-zinc-400">Your open and closed leveraged positions</p>
      {/* PositionTable component will go here */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-center text-zinc-500">
          Connect your wallet to view positions
        </p>
      </div>
    </div>
  );
}
