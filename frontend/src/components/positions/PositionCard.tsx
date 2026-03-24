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

  const collateralDec =
    position.collateralAsset.toLowerCase() === WETH_ADDRESS.toLowerCase() ? 18 : 6;
  const debtDec =
    position.debtAsset.toLowerCase() === WETH_ADDRESS.toLowerCase() ? 18 : 6;
  const collateral = parseFloat(formatUnits(position.collateralAmount, collateralDec)).toFixed(
    collateralDec === 18 ? 6 : 2
  );
  const debt = parseFloat(formatUnits(position.debtAmount, debtDec)).toFixed(
    debtDec === 18 ? 6 : 2
  );

  // entryPrice stored as (usdcAmount_6dec * 1e18) / wethAmount_18dec
  // Result is 1e12 too small because USDC has 6 decimals, not 18. Format with 6 to compensate.
  const entryPrice = parseFloat(formatUnits(position.entryPrice, 6)).toFixed(2);
  const openDate = new Date(Number(position.openTimestamp) * 1000).toLocaleDateString();

  return (
    <Card
      className={`border-zinc-800 bg-zinc-900 transition-opacity ${
        !position.isActive ? "opacity-50" : ""
      }`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Position info */}
          <div className="space-y-3 min-w-0">
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                  isLong
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "bg-red-600/20 text-red-400"
                }`}
              >
                {isLong ? "LONG" : "SHORT"}
              </span>
              <span className="text-sm font-semibold text-white">WETH/USDC</span>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {leverage}x
              </span>
              <span className="text-xs text-zinc-500">#{positionId.toString()}</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-zinc-500 text-xs">Margin</span>
                <p className="text-white font-medium">{parseFloat(margin).toFixed(2)} USDC</p>
              </div>
              <div>
                <span className="text-zinc-500 text-xs">Position Size</span>
                <p className="text-white font-medium">${totalPosition}</p>
              </div>
              <div>
                <span className="text-zinc-500 text-xs">Entry Price</span>
                <p className="text-white font-medium">${entryPrice}</p>
              </div>
              <div>
                <span className="text-zinc-500 text-xs">Collateral</span>
                <p className="text-white">
                  {collateral} {collateralDec === 18 ? "WETH" : "USDC"}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 text-xs">Debt</span>
                <p className="text-white">
                  {debt} {debtDec === 18 ? "WETH" : "USDC"}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 text-xs">Opened</span>
                <p className="text-white">{openDate}</p>
              </div>
            </div>
          </div>

          {/* Close button */}
          <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
            {position.isActive ? (
              <Button
                onClick={() => onClose(positionId)}
                disabled={isClosing}
                variant="outline"
                size="sm"
                className="border-zinc-700 hover:border-red-500 hover:text-red-400 transition-colors w-full sm:w-auto"
              >
                {isClosing ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Closing...
                  </span>
                ) : (
                  "Close Position"
                )}
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
