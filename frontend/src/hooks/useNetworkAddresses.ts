"use client";

import { useAccount } from "wagmi";
import { getAddresses, type NetworkAddresses } from "@/lib/network-config";
import { SEPOLIA_ADDRESSES } from "@/lib/network-config";

export function useNetworkAddresses(): NetworkAddresses {
  const { chain } = useAccount();
  return getAddresses(chain?.id) ?? SEPOLIA_ADDRESSES;
}
