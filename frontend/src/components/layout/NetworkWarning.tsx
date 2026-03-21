"use client";

import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";

export function NetworkWarning() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  if (!isConnected || chainId === sepolia.id) return null;

  return (
    <div className="bg-amber-600/10 border border-amber-600/30 text-amber-400 text-sm text-center py-2 px-4">
      Wrong network detected. Please switch to{" "}
      <span className="font-semibold">Sepolia Testnet</span> in your wallet.
    </div>
  );
}
