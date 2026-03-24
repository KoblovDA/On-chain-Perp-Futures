import { type Address } from "viem";

// ===== Deployed Contract Addresses (Sepolia) =====
export const POSITION_MANAGER_ADDRESS: Address =
  "0x1f15AA1DaB4933900A6C2Ea8F5D2d28fAAA5e5eD";

export const SWAP_ROUTER_ADDRESS: Address =
  "0xFdaD24fE8b093E1f20842BbF9AE80A179d80c3A9";

// ===== Aave V3 Sepolia Token Addresses =====
export const WETH_ADDRESS: Address =
  "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";

export const USDC_ADDRESS: Address =
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// ===== Token metadata =====
export const TOKENS = {
  WETH: { address: WETH_ADDRESS, symbol: "WETH", decimals: 18 },
  USDC: { address: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
} as const;

// ===== ERC20 ABI (minimal) =====
export const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ===== PositionManager ABI =====
export const POSITION_MANAGER_ABI = [
  {
    inputs: [
      { internalType: "contract IPoolAddressesProvider", name: "_addressesProvider", type: "address" },
      { internalType: "address", name: "_swapRouter", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "SafeERC20FailedOperation",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "positionType", type: "uint8" },
      { indexed: false, name: "pnl", type: "int256" },
      { indexed: false, name: "returnedAmount", type: "uint256" },
    ],
    name: "PositionClosed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "positionType", type: "uint8" },
      { indexed: false, name: "collateralAsset", type: "address" },
      { indexed: false, name: "debtAsset", type: "address" },
      { indexed: false, name: "collateralAmount", type: "uint256" },
      { indexed: false, name: "debtAmount", type: "uint256" },
      { indexed: false, name: "leverageBps", type: "uint256" },
      { indexed: false, name: "entryPrice", type: "uint256" },
    ],
    name: "PositionOpened",
    type: "event",
  },
  {
    inputs: [],
    name: "ADDRESSES_PROVIDER",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "POOL",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "closeLong",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "closeShort",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "premium", type: "uint256" },
      { name: "initiator", type: "address" },
      { name: "params", type: "bytes" },
    ],
    name: "executeOperation",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "getPosition",
    outputs: [
      {
        components: [
          { name: "owner", type: "address" },
          { name: "positionType", type: "uint8" },
          { name: "collateralAsset", type: "address" },
          { name: "debtAsset", type: "address" },
          { name: "collateralAmount", type: "uint256" },
          { name: "debtAmount", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "leverageBps", type: "uint256" },
          { name: "marginAmount", type: "uint256" },
          { name: "openTimestamp", type: "uint256" },
          { name: "isActive", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserPositions",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "collateralAsset", type: "address" },
      { name: "debtAsset", type: "address" },
      { name: "marginAmount", type: "uint256" },
      { name: "leverageBps", type: "uint256" },
      { name: "minCollateralOut", type: "uint256" },
    ],
    name: "openLong",
    outputs: [{ name: "positionId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "collateralAsset", type: "address" },
      { name: "debtAsset", type: "address" },
      { name: "marginAmount", type: "uint256" },
      { name: "leverageBps", type: "uint256" },
      { name: "minCollateralOut", type: "uint256" },
    ],
    name: "openShort",
    outputs: [{ name: "positionId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "positionCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "swapRouter",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
