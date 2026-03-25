"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { type Address } from "viem";
import { POSITION_MANAGER_ABI, ERC20_ABI } from "@/lib/contracts";
import { useNetworkAddresses } from "./useNetworkAddresses";

// ===== Read hooks =====

export function usePositionCount() {
  const addrs = useNetworkAddresses();
  return useReadContract({
    address: addrs.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: "positionCount",
  });
}

export function usePosition(positionId: bigint) {
  const addrs = useNetworkAddresses();
  return useReadContract({
    address: addrs.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: "getPosition",
    args: [positionId],
  });
}

export function useUserPositions(user: Address | undefined) {
  const addrs = useNetworkAddresses();
  return useReadContract({
    address: addrs.POSITION_MANAGER,
    abi: POSITION_MANAGER_ABI,
    functionName: "getUserPositions",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });
}

export function useTokenBalance(token: Address, user: Address | undefined, options?: { refetchInterval?: number }) {
  return useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!user, refetchInterval: options?.refetchInterval },
  });
}

export function useAllowance(token: Address, owner: Address | undefined, spender: Address) {
  return useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    query: { enabled: !!owner },
  });
}

// ===== Write hooks =====

export function useApproveToken() {
  const addrs = useNetworkAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (token: Address, amount: bigint) => {
    writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [addrs.POSITION_MANAGER, amount],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

export function useOpenLong() {
  const addrs = useNetworkAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const openLong = (marginAmount: bigint, leverageBps: bigint) => {
    writeContract({
      address: addrs.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: "openLong",
      args: [addrs.WETH, addrs.USDC, marginAmount, leverageBps, 0n],
    });
  };

  return { openLong, hash, isPending, isConfirming, isSuccess, error };
}

export function useOpenShort() {
  const addrs = useNetworkAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const openShort = (marginAmount: bigint, leverageBps: bigint) => {
    writeContract({
      address: addrs.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: "openShort",
      args: [addrs.USDC, addrs.WETH, marginAmount, leverageBps, 0n],
    });
  };

  return { openShort, hash, isPending, isConfirming, isSuccess, error };
}

export function useCloseLong() {
  const addrs = useNetworkAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const closeLong = (positionId: bigint) => {
    writeContract({
      address: addrs.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: "closeLong",
      args: [positionId],
    });
  };

  return { closeLong, hash, isPending, isConfirming, isSuccess, error };
}

export function useCloseShort() {
  const addrs = useNetworkAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const closeShort = (positionId: bigint) => {
    writeContract({
      address: addrs.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: "closeShort",
      args: [positionId],
    });
  };

  return { closeShort, hash, isPending, isConfirming, isSuccess, error };
}
