"use client";

import { PositionList } from "@/components/positions/PositionList";

export default function PositionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Positions</h1>
        <p className="mt-2 text-zinc-400">
          Your open and closed leveraged positions
        </p>
      </div>
      <PositionList />
    </div>
  );
}
