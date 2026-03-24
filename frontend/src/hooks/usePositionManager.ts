"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { type Address } from "viem";
import {
  POSITION_MANAGER_ADDRESS,
  POSITION_MANAGER_ABI,
  ERC20_ABI,
  WETH_ADDRESS,
  USDC_ADDRESS,
} from "@/lib/contracts";

// ===== Read hooks =====

export function usePositionCount() {
  return useReadContract({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: "positionCount",
  });
}

export function usePosition(positionId: bigint) {
  return useReadContract({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: "getPosition",
    args: [positionId],
  });
}

export function useUserPositions(user: Address | undefined) {
  return useReadContract({
    address: POSITION_MANAGER_ADDRESS,
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
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (token: Address, amount: bigint) => {
    writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [POSITION_MANAGER_ADDRESS, amount],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

export function useOpenLong() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const openLong = (marginAmount: bigint, leverageBps: bigint) => {
    writeContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "openLong",
      args: [WETH_ADDRESS, USDC_ADDRESS, marginAmount, leverageBps, 0n],
    });
  };

  return { openLong, hash, isPending, isConfirming, isSuccess, error };
}

export function useOpenShort() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const openShort = (marginAmount: bigint, leverageBps: bigint) => {
    writeContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "openShort",
      args: [USDC_ADDRESS, WETH_ADDRESS, marginAmount, leverageBps, 0n],
    });
  };

  return { openShort, hash, isPending, isConfirming, isSuccess, error };
}

export function useCloseLong() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const closeLong = (positionId: bigint) => {
    writeContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "closeLong",
      args: [positionId],
    });
  };

  return { closeLong, hash, isPending, isConfirming, isSuccess, error };
}

export function useCloseShort() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const closeShort = (positionId: bigint) => {
    writeContract({
      address: POSITION_MANAGER_ADDRESS,
      abi: POSITION_MANAGER_ABI,
      functionName: "closeShort",
      args: [positionId],
    });
  };

  return { closeShort, hash, isPending, isConfirming, isSuccess, error };
}
