import { ethers } from "hardhat";

/**
 * Deploy script for Sepolia testnet.
 *
 * Deploys:
 * 1. MockSwapRouter — mock DEX with configurable rates
 * 2. PositionManager — core contract using Aave V3 PoolAddressesProvider
 *
 * After deployment, sets WETH/USDC swap rates on MockSwapRouter.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network sepolia
 */

// Aave V3 Sepolia addresses
const AAVE_POOL_ADDRESSES_PROVIDER = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A";
const WETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

// Initial swap rate: must match Aave oracle price
const WETH_USDC_RATE = ethers.parseEther("4000");
const USDC_WETH_RATE = ethers.parseEther("0.00025");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Get Sepolia ETH from a faucet first.");
  }

  // 1. Deploy MockSwapRouter
  console.log("\n--- Deploying MockSwapRouter ---");
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const swapRouter = await MockSwapRouter.deploy();
  await swapRouter.waitForDeployment();
  const swapRouterAddr = await swapRouter.getAddress();
  console.log("MockSwapRouter deployed at:", swapRouterAddr);

  // Set swap rates
  console.log("Setting WETH→USDC rate: 2000");
  let tx = await swapRouter.setRate(WETH, USDC, WETH_USDC_RATE, 18, 6);
  await tx.wait();

  console.log("Setting USDC→WETH rate: 0.0005");
  tx = await swapRouter.setRate(USDC, WETH, USDC_WETH_RATE, 6, 18);
  await tx.wait();

  // 2. Deploy PositionManager
  console.log("\n--- Deploying PositionManager ---");
  const PositionManager = await ethers.getContractFactory("PositionManager");
  const positionManager = await PositionManager.deploy(
    AAVE_POOL_ADDRESSES_PROVIDER,
    swapRouterAddr
  );
  await positionManager.waitForDeployment();
  const positionManagerAddr = await positionManager.getAddress();
  console.log("PositionManager deployed at:", positionManagerAddr);

  // Summary
  console.log("\n========== DEPLOYMENT SUMMARY ==========");
  console.log("Network:          Sepolia");
  console.log("MockSwapRouter:  ", swapRouterAddr);
  console.log("PositionManager: ", positionManagerAddr);
  console.log("Aave Provider:   ", AAVE_POOL_ADDRESSES_PROVIDER);
  console.log("WETH:            ", WETH);
  console.log("USDC:            ", USDC);
  console.log("=========================================");
  console.log("\nNext steps:");
  console.log("1. Verify contracts:  npx hardhat verify --network sepolia", swapRouterAddr);
  console.log("2. Verify PM:         npx hardhat verify --network sepolia", positionManagerAddr, AAVE_POOL_ADDRESSES_PROVIDER, swapRouterAddr);
  console.log("3. Fund MockSwapRouter with WETH and USDC for swaps");
  console.log("4. Mint Aave testnet tokens at https://app.aave.com/faucet/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
