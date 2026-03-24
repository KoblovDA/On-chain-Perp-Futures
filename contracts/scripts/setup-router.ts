import { ethers } from "hardhat";

/**
 * Setup script: configure MockSwapRouter rates and fund it with tokens.
 *
 * Run after deployment (or when USDC address changes):
 *   npx hardhat run scripts/setup-router.ts --network sepolia
 *
 * Requirements: deployer must have WETH and USDC tokens.
 * Get them from Aave faucet: https://app.aave.com/faucet/
 */

const MOCK_SWAP_ROUTER = "0xFdaD24fE8b093E1f20842BbF9AE80A179d80c3A9";
const WETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// 1 WETH = 2000 USDC
const WETH_USDC_RATE = ethers.parseEther("2000");
const USDC_WETH_RATE = ethers.parseEther("0.0005");

// Amount to fund the router with
const WETH_FUND = ethers.parseEther("10");          // 10 WETH
const USDC_FUND = ethers.parseUnits("20000", 6);    // 20,000 USDC

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

const ROUTER_ABI = [
  "function setRate(address tokenIn, address tokenOut, uint256 rate, uint8 decimalsIn, uint8 decimalsOut)",
  "function getRate(address tokenIn, address tokenOut) view returns (uint256)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const weth = new ethers.Contract(WETH, ERC20_ABI, deployer);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, deployer);
  const router = new ethers.Contract(MOCK_SWAP_ROUTER, ROUTER_ABI, deployer);

  // Check balances
  const wethBal = await weth.balanceOf(deployer.address);
  const usdcBal = await usdc.balanceOf(deployer.address);
  console.log("\nDeployer balances:");
  console.log("  WETH:", ethers.formatEther(wethBal));
  console.log("  USDC:", ethers.formatUnits(usdcBal, 6));

  // --- Step 1: Set rates ---
  console.log("\n--- Setting swap rates ---");
  let tx = await router.setRate(WETH, USDC, WETH_USDC_RATE, 18, 6);
  await tx.wait();
  console.log("✓ WETH→USDC rate set: 2000");

  tx = await router.setRate(USDC, WETH, USDC_WETH_RATE, 6, 18);
  await tx.wait();
  console.log("✓ USDC→WETH rate set: 0.0005");

  // --- Step 2: Fund router ---
  console.log("\n--- Funding MockSwapRouter ---");

  if (wethBal >= WETH_FUND) {
    tx = await weth.transfer(MOCK_SWAP_ROUTER, WETH_FUND);
    await tx.wait();
    console.log("✓ Sent 10 WETH to router");
  } else {
    console.log(`⚠ Not enough WETH (have ${ethers.formatEther(wethBal)}, need 10). Get from Aave faucet.`);
  }

  if (usdcBal >= USDC_FUND) {
    tx = await usdc.transfer(MOCK_SWAP_ROUTER, USDC_FUND);
    await tx.wait();
    console.log("✓ Sent 20,000 USDC to router");
  } else {
    console.log(`⚠ Not enough USDC (have ${ethers.formatUnits(usdcBal, 6)}, need 20000). Get from Aave faucet.`);
  }

  // --- Final balances ---
  const routerWeth = await weth.balanceOf(MOCK_SWAP_ROUTER);
  const routerUsdc = await usdc.balanceOf(MOCK_SWAP_ROUTER);
  console.log("\nMockSwapRouter balances after setup:");
  console.log("  WETH:", ethers.formatEther(routerWeth));
  console.log("  USDC:", ethers.formatUnits(routerUsdc, 6));
  console.log("\n✅ Router is ready for swaps!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
