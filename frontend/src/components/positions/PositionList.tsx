"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useReadContracts } from "wagmi";
import { toast } from "sonner";
import {
  useUserPositions,
  useCloseLong,
  useCloseShort,
} from "@/hooks/usePositionManager";
import { POSITION_MANAGER_ADDRESS, POSITION_MANAGER_ABI } from "@/lib/contracts";
import { PositionCard, type Position } from "./PositionCard";

export function PositionList() {
  const { address, isConnected } = useAccount();
  const { data: positionIds, isLoading: isLoadingIds, refetch: refetchIds } =
    useUserPositions(address);

  const closeLong = useCloseLong();
  const closeShort = useCloseShort();
  const [closingId, setClosingId] = useState<bigint | null>(null);

  const contracts = (positionIds || []).map((id) => ({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: "getPosition" as const,
    args: [id] as const,
  }));

  const { data: positionsData, isLoading: isLoadingPositions, refetch: refetchPositions } =
    useReadContracts({
      contracts,
      query: { enabled: contracts.length > 0 },
    });

  // Toast + refetch on close success
  useEffect(() => {
    if (closeLong.isSuccess || closeShort.isSuccess) {
      toast.dismiss("close");
      toast.success("Position closed successfully");
      setClosingId(null);
      refetchIds();
      refetchPositions();
    }
  }, [closeLong.isSuccess, closeShort.isSuccess, refetchIds, refetchPositions]);

  // Toast on close error
  useEffect(() => {
    const err = closeLong.error || closeShort.error;
    if (err) {
      toast.dismiss("close");
      toast.error("Failed to close position", {
        description: (err as Error).message?.slice(0, 80),
      });
      setClosingId(null);
    }
  }, [closeLong.error, closeShort.error]);

  const handleClose = (positionId: bigint) => {
    const idx = (positionIds || []).findIndex((id) => id === positionId);
    if (idx === -1 || !positionsData?.[idx]?.result) return;

    const pos = positionsData[idx].result as unknown as Position;
    setClosingId(positionId);
    toast.loading("Closing position...", { id: "close" });

    if (pos.positionType === 0) {
      closeLong.closeLong(positionId);
    } else {
      closeShort.closeShort(positionId);
    }
  };

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
        <p className="text-zinc-500">Connect your wallet to view positions</p>
      </div>
    );
  }

  if (isLoadingIds || isLoadingPositions) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
          />
        ))}
      </div>
    );
  }

  if (!positionIds || positionIds.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
        <p className="text-zinc-400 text-lg">No positions yet</p>
        <p className="mt-2 text-zinc-500 text-sm">
          Open your first position on the Trade page
        </p>
      </div>
    );
  }

  const positions = (positionIds || [])
    .map((id, i) => ({
      id,
      data: positionsData?.[i]?.result as unknown as Position | undefined,
    }))
    .filter((p): p is { id: bigint; data: Position } => !!p.data);

  const active = positions.filter((p) => p.data.isActive);
  const closed = positions.filter((p) => !p.data.isActive);

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Active ({active.length})
          </h2>
          {active.map((p) => (
            <PositionCard
              key={p.id.toString()}
              positionId={p.id}
              position={p.data}
              onClose={handleClose}
              isClosing={closingId === p.id}
            />
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-400">
            Closed ({closed.length})
          </h2>
          {closed.map((p) => (
            <PositionCard
              key={p.id.toString()}
              positionId={p.id}
              position={p.data}
              onClose={handleClose}
              isClosing={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
