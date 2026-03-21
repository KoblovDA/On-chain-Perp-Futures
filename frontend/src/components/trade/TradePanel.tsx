"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useTokenBalance,
  useAllowance,
  useApproveToken,
  useOpenLong,
  useOpenShort,
} from "@/hooks/usePositionManager";
import { USDC_ADDRESS, POSITION_MANAGER_ADDRESS } from "@/lib/contracts";

type Side = "long" | "short";

const LEVERAGE_MARKS = [
  { value: 15000, label: "1.5x" },
  { value: 20000, label: "2x" },
  { value: 25000, label: "2.5x" },
  { value: 30000, label: "3x" },
  { value: 35000, label: "3.5x" },
  { value: 40000, label: "4x" },
];

export function TradePanel() {
  const { address, isConnected } = useAccount();

  // Form state
  const [side, setSide] = useState<Side>("long");
  const [marginInput, setMarginInput] = useState("");
  const [leverageBps, setLeverageBps] = useState(20000);

  // Read hooks
  const { data: usdcBalance, refetch: refetchBalance } = useTokenBalance(USDC_ADDRESS, address);
  const { data: allowance, refetch: refetchAllowance } = useAllowance(
    USDC_ADDRESS,
    address,
    POSITION_MANAGER_ADDRESS
  );

  // Write hooks
  const approve = useApproveToken();
  const openLong = useOpenLong();
  const openShort = useOpenShort();

  // Derived
  const marginAmount = useMemo(() => {
    try {
      return parseUnits(marginInput || "0", 6);
    } catch {
      return 0n;
    }
  }, [marginInput]);

  const leverageDisplay = (leverageBps / 10000).toFixed(1) + "x";
  const totalPosition = marginInput ? (parseFloat(marginInput) * leverageBps / 10000).toFixed(2) : "0.00";
  const borrowAmount = marginInput ? (parseFloat(marginInput) * (leverageBps / 10000 - 1)).toFixed(2) : "0.00";

  const needsApproval = allowance !== undefined && marginAmount > 0n && allowance < marginAmount;
  const hasBalance = usdcBalance !== undefined && marginAmount > 0n && usdcBalance >= marginAmount;

  // Refetch on success
  useEffect(() => {
    if (approve.isSuccess) {
      refetchAllowance();
    }
  }, [approve.isSuccess, refetchAllowance]);

  useEffect(() => {
    if (openLong.isSuccess || openShort.isSuccess) {
      refetchBalance();
      refetchAllowance();
      setMarginInput("");
    }
  }, [openLong.isSuccess, openShort.isSuccess, refetchBalance, refetchAllowance]);

  const handleApprove = () => {
    approve.approve(USDC_ADDRESS, maxUint256);
  };

  const handleTrade = () => {
    if (side === "long") {
      openLong.openLong(marginAmount, BigInt(leverageBps));
    } else {
      openShort.openShort(marginAmount, BigInt(leverageBps));
    }
  };

  const isTrading = openLong.isPending || openLong.isConfirming || openShort.isPending || openShort.isConfirming;
  const isApproving = approve.isPending || approve.isConfirming;
  const tradeError = openLong.error || openShort.error || approve.error;

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Open Position</CardTitle>
        <p className="text-sm text-zinc-400">WETH / USDC</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Long / Short toggle */}
        <div className="flex rounded-lg bg-zinc-800 p-1">
          <button
            onClick={() => setSide("long")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              side === "long"
                ? "bg-emerald-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setSide("short")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              side === "short"
                ? "bg-red-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Short
          </button>
        </div>

        {/* Margin input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Margin (USDC)</label>
            {isConnected && usdcBalance !== undefined && (
              <button
                onClick={() => setMarginInput(formatUnits(usdcBalance, 6))}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                Balance: {parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)}
              </button>
            )}
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={marginInput}
            onChange={(e) => setMarginInput(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-lg text-white placeholder-zinc-500 outline-none focus:border-violet-500"
          />
        </div>

        {/* Leverage slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Leverage</label>
            <span className="text-sm font-semibold text-white">{leverageDisplay}</span>
          </div>
          <input
            type="range"
            min={15000}
            max={40000}
            step={5000}
            value={leverageBps}
            onChange={(e) => setLeverageBps(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            {LEVERAGE_MARKS.map((m) => (
              <span key={m.value}>{m.label}</span>
            ))}
          </div>
        </div>

        {/* Trade preview */}
        {marginInput && parseFloat(marginInput) > 0 && (
          <div className="rounded-lg bg-zinc-800/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Position</span>
              <span className="text-white">${totalPosition} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Borrow Amount</span>
              <span className="text-white">${borrowAmount} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Direction</span>
              <span className={side === "long" ? "text-emerald-400" : "text-red-400"}>
                {side === "long" ? "Long WETH" : "Short WETH"}
              </span>
            </div>
          </div>
        )}

        {/* Action button */}
        {!isConnected ? (
          <Button disabled className="w-full" size="lg">
            Connect Wallet
          </Button>
        ) : needsApproval ? (
          <Button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full bg-violet-600 hover:bg-violet-700"
            size="lg"
          >
            {isApproving ? "Approving..." : "Approve USDC"}
          </Button>
        ) : (
          <Button
            onClick={handleTrade}
            disabled={!hasBalance || marginAmount === 0n || isTrading}
            className={`w-full ${
              side === "long"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
            size="lg"
          >
            {isTrading
              ? "Opening Position..."
              : !hasBalance && marginAmount > 0n
              ? "Insufficient USDC"
              : marginAmount === 0n
              ? "Enter Amount"
              : `Open ${leverageDisplay} ${side === "long" ? "Long" : "Short"}`}
          </Button>
        )}

        {/* Status messages */}
        {(openLong.isSuccess || openShort.isSuccess) && (
          <p className="text-center text-sm text-emerald-400">
            Position opened successfully!
          </p>
        )}
        {tradeError && (
          <p className="text-center text-sm text-red-400">
            {(tradeError as Error).message?.slice(0, 100) || "Transaction failed"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
