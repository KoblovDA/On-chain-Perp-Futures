"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { toast } from "sonner";
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
import { parseError } from "@/lib/errors";

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

  const [side, setSide] = useState<Side>("long");
  const [marginInput, setMarginInput] = useState("");
  const [leverageBps, setLeverageBps] = useState(20000);

  const { data: usdcBalance, refetch: refetchBalance } = useTokenBalance(USDC_ADDRESS, address, { refetchInterval: 5000 });
  const { data: allowance, refetch: refetchAllowance } = useAllowance(
    USDC_ADDRESS,
    address,
    POSITION_MANAGER_ADDRESS
  );

  const approve = useApproveToken();
  const openLong = useOpenLong();
  const openShort = useOpenShort();

  const marginAmount = useMemo(() => {
    try {
      return parseUnits(marginInput || "0", 6);
    } catch {
      return 0n;
    }
  }, [marginInput]);

  const leverageDisplay = (leverageBps / 10000).toFixed(1) + "x";
  const totalPosition = marginInput
    ? (parseFloat(marginInput) * leverageBps / 10000).toFixed(2)
    : "0.00";
  const borrowAmount = marginInput
    ? (parseFloat(marginInput) * (leverageBps / 10000 - 1)).toFixed(2)
    : "0.00";

  const needsApproval = allowance !== undefined && marginAmount > 0n && allowance < marginAmount;
  const balanceLoading = isConnected && !!address && usdcBalance === undefined;
  const hasBalance = usdcBalance !== undefined && marginAmount > 0n && usdcBalance >= marginAmount;
  const insufficientBalance = usdcBalance !== undefined && marginAmount > 0n && usdcBalance < marginAmount;

  // Toast notifications
  useEffect(() => {
    if (approve.isSuccess) {
      toast.success("USDC approved for trading");
      refetchAllowance();
    }
  }, [approve.isSuccess, refetchAllowance]);

  useEffect(() => {
    if (approve.error) {
      toast.error("Approval failed", { description: parseError(approve.error) });
    }
  }, [approve.error]);

  useEffect(() => {
    if (openLong.isSuccess || openShort.isSuccess) {
      toast.success("Position opened!", {
        description: `${leverageDisplay} ${side === "long" ? "Long" : "Short"} WETH/USDC`,
      });
      refetchBalance();
      refetchAllowance();
      setMarginInput("");
    }
  }, [openLong.isSuccess, openShort.isSuccess, refetchBalance, refetchAllowance, leverageDisplay, side]);

  useEffect(() => {
    const err = openLong.error || openShort.error;
    if (err) {
      toast.error("Transaction failed", { description: parseError(err) });
    }
  }, [openLong.error, openShort.error]);

  const handleApprove = () => {
    toast.loading("Waiting for approval...", { id: "approve" });
    approve.approve(USDC_ADDRESS, maxUint256);
  };

  const handleTrade = () => {
    toast.loading("Opening position...", { id: "trade" });
    if (side === "long") {
      openLong.openLong(marginAmount, BigInt(leverageBps));
    } else {
      openShort.openShort(marginAmount, BigInt(leverageBps));
    }
  };

  // Dismiss loading toasts on completion
  useEffect(() => {
    if (approve.isSuccess || approve.error) toast.dismiss("approve");
  }, [approve.isSuccess, approve.error]);

  useEffect(() => {
    if (openLong.isSuccess || openShort.isSuccess || openLong.error || openShort.error) {
      toast.dismiss("trade");
    }
  }, [openLong.isSuccess, openShort.isSuccess, openLong.error, openShort.error]);

  const isTrading =
    openLong.isPending || openLong.isConfirming || openShort.isPending || openShort.isConfirming;
  const isApproving = approve.isPending || approve.isConfirming;

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Open Position</CardTitle>
        <p className="text-sm text-zinc-400">WETH / USDC on Sepolia</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Long / Short toggle */}
        <div className="flex rounded-lg bg-zinc-800 p-1">
          <button
            onClick={() => setSide("long")}
            className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-all ${
              side === "long"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setSide("short")}
            className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-all ${
              side === "short"
                ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
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
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-lg text-white placeholder-zinc-500 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
          />
        </div>

        {/* Leverage slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Leverage</label>
            <span
              className={`rounded-md px-2 py-0.5 text-sm font-bold ${
                leverageBps >= 35000
                  ? "bg-red-600/20 text-red-400"
                  : leverageBps >= 25000
                  ? "bg-amber-600/20 text-amber-400"
                  : "bg-emerald-600/20 text-emerald-400"
              }`}
            >
              {leverageDisplay}
            </span>
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
              <span
                key={m.value}
                className={leverageBps === m.value ? "text-violet-400 font-medium" : ""}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Trade preview */}
        {marginInput && parseFloat(marginInput) > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Position</span>
              <span className="font-medium text-white">${totalPosition}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Borrow Amount</span>
              <span className="font-medium text-white">${borrowAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Direction</span>
              <span
                className={`font-medium ${
                  side === "long" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {side === "long" ? "Long WETH" : "Short WETH"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Flash Loan Fee</span>
              <span className="text-zinc-300">~0.05%</span>
            </div>
          </div>
        )}

        {/* Action button */}
        {!isConnected ? (
          <Button disabled className="w-full h-12 text-base" size="lg">
            Connect Wallet
          </Button>
        ) : needsApproval ? (
          <Button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full h-12 text-base bg-violet-600 hover:bg-violet-700 transition-colors"
            size="lg"
          >
            {isApproving ? (
              <span className="flex items-center gap-2">
                <Spinner /> Approving...
              </span>
            ) : (
              "Approve USDC"
            )}
          </Button>
        ) : (
          <Button
            onClick={handleTrade}
            disabled={balanceLoading || insufficientBalance || marginAmount === 0n || isTrading}
            className={`w-full h-12 text-base transition-colors ${
              side === "long"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
            size="lg"
          >
            {isTrading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Opening Position...
              </span>
            ) : balanceLoading ? (
              <span className="flex items-center gap-2">
                <Spinner /> Loading balance...
              </span>
            ) : insufficientBalance ? (
              "Insufficient USDC"
            ) : marginAmount === 0n ? (
              "Enter Amount"
            ) : (
              `Open ${leverageDisplay} ${side === "long" ? "Long" : "Short"}`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
