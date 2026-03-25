"use client";

import { useAccount } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";

const SUPPORTED_CHAINS: number[] = [sepolia.id, hardhat.id];

export function NetworkWarning() {
  const { isConnected, chain } = useAccount();

  if (!isConnected || (chain && SUPPORTED_CHAINS.includes(chain.id))) return null;

  return (
    <div className="bg-amber-600/10 border border-amber-600/30 text-amber-400 text-sm text-center py-2 px-4">
      Wrong network detected. Please switch to{" "}
      <span className="font-semibold">Sepolia Testnet</span> or{" "}
      <span className="font-semibold">Hardhat Local</span> in your wallet.
    </div>
  );
}
