import { type Address } from "viem";
import { sepolia, hardhat } from "wagmi/chains";

export interface NetworkAddresses {
  POSITION_MANAGER: Address;
  SWAP_ROUTER: Address;
  WETH: Address;
  USDC: Address;
}

export const SEPOLIA_ADDRESSES: NetworkAddresses = {
  POSITION_MANAGER: "0x1f15AA1DaB4933900A6C2Ea8F5D2d28fAAA5e5eD",
  SWAP_ROUTER: "0xFdaD24fE8b093E1f20842BbF9AE80A179d80c3A9",
  WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c",
  USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
};

// These addresses are deterministic when deploying to a fresh Hardhat node.
// If you restart the node, re-run deploy-local.ts and update if needed.
export const LOCAL_ADDRESSES: NetworkAddresses = {
  POSITION_MANAGER: "0x9A676e781A523b5d0C0e43731313A708CB607508",
  SWAP_ROUTER: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
  WETH: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  USDC: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
};

export function getAddresses(chainId: number | undefined): NetworkAddresses {
  if (chainId === hardhat.id) return LOCAL_ADDRESSES;
  return SEPOLIA_ADDRESSES; // default
}

export function getNetworkLabel(chainId: number | undefined): string {
  if (chainId === hardhat.id) return "Local";
  if (chainId === sepolia.id) return "Sepolia";
  return "Unknown";
}

export function isLocalNetwork(chainId: number | undefined): boolean {
  return chainId === hardhat.id;
}
