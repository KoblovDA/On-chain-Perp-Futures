"use client";

import { formatUnits } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WETH_ADDRESS } from "@/lib/contracts";

export interface Position {
  owner: string;
  positionType: number;
  collateralAsset: string;
  debtAsset: string;
  collateralAmount: bigint;
  debtAmount: bigint;
  entryPrice: bigint;
  leverageBps: bigint;
  marginAmount: bigint;
  openTimestamp: bigint;
  isActive: boolean;
}

interface PositionCardProps {
  positionId: bigint;
  position: Position;
  onClose: (id: bigint) => void;
  isClosing: boolean;
}

export function PositionCard({ positionId, position, onClose, isClosing }: PositionCardProps) {
  const isLong = position.positionType === 0;
  const leverage = (Number(position.leverageBps) / 10000).toFixed(1);
  const margin = formatUnits(position.marginAmount, 6);
  const totalPosition = (parseFloat(margin) * Number(position.leverageBps) / 10000).toFixed(2);

  const collateralDec = position.collateralAsset.toLowerCase() === WETH_ADDRESS.toLowerCase() ? 18 : 6;
  const debtDec = position.debtAsset.toLowerCase() === WETH_ADDRESS.toLowerCase() ? 18 : 6;
  const collateral = parseFloat(formatUnits(position.collateralAmount, collateralDec)).toFixed(
    collateralDec === 18 ? 6 : 2
  );
  const debt = parseFloat(formatUnits(position.debtAmount, debtDec)).toFixed(
    debtDec === 18 ? 6 : 2
  );

  const entryPrice = parseFloat(formatUnits(position.entryPrice, 18)).toFixed(2);
  const openDate = new Date(Number(position.openTimestamp) * 1000).toLocaleDateString();

  return (
    <Card className={`border-zinc-800 bg-zinc-900 ${!position.isActive ? "opacity-50" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          {/* Left: position info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                  isLong
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "bg-red-600/20 text-red-400"
                }`}
              >
                {isLong ? "LONG" : "SHORT"}
              </span>
              <span className="text-sm font-semibold text-white">
                WETH/USDC
              </span>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {leverage}x
              </span>
              <span className="text-xs text-zinc-500">#{positionId.toString()}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div>
                <span className="text-zinc-500">Margin</span>
                <p className="text-white">{parseFloat(margin).toFixed(2)} USDC</p>
              </div>
              <div>
                <span className="text-zinc-500">Position Size</span>
                <p className="text-white">${totalPosition}</p>
              </div>
              <div>
                <span className="text-zinc-500">Collateral</span>
                <p className="text-white">
                  {collateral} {collateralDec === 18 ? "WETH" : "USDC"}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Debt</span>
                <p className="text-white">
                  {debt} {debtDec === 18 ? "WETH" : "USDC"}
                </p>
              </div>
              <div>
                <span className="text-zinc-500">Entry Price</span>
                <p className="text-white">${entryPrice}</p>
              </div>
              <div>
                <span className="text-zinc-500">Opened</span>
                <p className="text-white">{openDate}</p>
              </div>
            </div>
          </div>

          {/* Right: close button */}
          <div className="flex flex-col items-end gap-2">
            {position.isActive ? (
              <Button
                onClick={() => onClose(positionId)}
                disabled={isClosing}
                variant="outline"
                size="sm"
                className="border-zinc-700 hover:border-red-500 hover:text-red-400"
              >
                {isClosing ? "Closing..." : "Close"}
              </Button>
            ) : (
              <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
                Closed
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
