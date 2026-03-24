import { ethers } from "hardhat";

/**
 * Setup script: configure MockSwapRouter rates from Aave oracle and fund it.
 *
 * Usage:
 *   npx hardhat run scripts/setup-router.ts --network sepolia
 *   PRICE_SHIFT=10 npx hardhat run scripts/setup-router.ts --network sepolia   # +10% price shift
 *   PRICE_SHIFT=-15 npx hardhat run scripts/setup-router.ts --network sepolia  # -15% price shift
 *
 * PRICE_SHIFT simulates price movement for testing PnL.
 * Open a position, then re-run with PRICE_SHIFT to change the rate, then close.
 */

const MOCK_SWAP_ROUTER = "0xFdaD24fE8b093E1f20842BbF9AE80A179d80c3A9";
const ORACLE = "0x2da88497588bf89281816106C7259e31AF45a663";
const WETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

const WETH_FUND = ethers.parseEther("0.01");    // 0.01 WETH
const USDC_FUND = ethers.parseUnits("50", 6);   // 50 USDC

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const ROUTER_ABI = [
  "function setRate(address tokenIn, address tokenOut, uint256 rate, uint8 decimalsIn, uint8 decimalsOut)",
];

const ORACLE_ABI = [
  "function getAssetPrice(address) view returns (uint256)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const oracle = new ethers.Contract(ORACLE, ORACLE_ABI, deployer);
  const router = new ethers.Contract(MOCK_SWAP_ROUTER, ROUTER_ABI, deployer);
  const weth = new ethers.Contract(WETH, ERC20_ABI, deployer);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, deployer);

  // --- Step 1: Read oracle prices ---
  const wethPriceRaw = await oracle.getAssetPrice(WETH);  // 8 decimals
  const usdcPriceRaw = await oracle.getAssetPrice(USDC);  // 8 decimals

  const wethPrice = Number(ethers.formatUnits(wethPriceRaw, 8));
  const usdcPrice = Number(ethers.formatUnits(usdcPriceRaw, 8));
  const oracleRate = wethPrice / usdcPrice; // WETH in USDC

  console.log(`\nOracle prices:`);
  console.log(`  WETH: $${wethPrice}`);
  console.log(`  USDC: $${usdcPrice}`);
  console.log(`  Rate: 1 WETH = ${oracleRate} USDC`);

  // --- Step 2: Apply price shift if specified ---
  const priceShiftPercent = Number(process.env.PRICE_SHIFT || "0");
  const shiftMultiplier = 1 + priceShiftPercent / 100;
  const effectiveRate = oracleRate * shiftMultiplier;

  if (priceShiftPercent !== 0) {
    console.log(`\n⚡ Price shift: ${priceShiftPercent > 0 ? "+" : ""}${priceShiftPercent}%`);
    console.log(`  Effective rate: 1 WETH = ${effectiveRate.toFixed(4)} USDC`);
  }

  // --- Step 3: Set rates on MockSwapRouter ---
  console.log("\n--- Setting swap rates ---");

  const wethToUsdc = ethers.parseEther(effectiveRate.toFixed(8));
  const usdcToWeth = ethers.parseEther((1 / effectiveRate).toFixed(8));

  let tx = await router.setRate(WETH, USDC, wethToUsdc, 18, 6);
  await tx.wait();
  console.log(`✓ WETH→USDC rate: ${effectiveRate.toFixed(4)}`);

  tx = await router.setRate(USDC, WETH, usdcToWeth, 6, 18);
  await tx.wait();
  console.log(`✓ USDC→WETH rate: ${(1 / effectiveRate).toFixed(8)}`);

  // --- Step 4: Fund router (skip if just shifting price) ---
  if (priceShiftPercent === 0) {
    console.log("\n--- Funding MockSwapRouter ---");

    const wethBal = await weth.balanceOf(deployer.address);
    const usdcBal = await usdc.balanceOf(deployer.address);
    console.log(`Deployer: ${ethers.formatEther(wethBal)} WETH, ${ethers.formatUnits(usdcBal, 6)} USDC`);

    if (wethBal >= WETH_FUND) {
      tx = await weth.transfer(MOCK_SWAP_ROUTER, WETH_FUND);
      await tx.wait();
      console.log(`✓ Sent ${ethers.formatEther(WETH_FUND)} WETH to router`);
    } else {
      console.log(`⚠ Not enough WETH (have ${ethers.formatEther(wethBal)}, need ${ethers.formatEther(WETH_FUND)}). Get from Aave faucet.`);
    }

    if (usdcBal >= USDC_FUND) {
      tx = await usdc.transfer(MOCK_SWAP_ROUTER, USDC_FUND);
      await tx.wait();
      console.log(`✓ Sent ${ethers.formatUnits(USDC_FUND, 6)} USDC to router`);
    } else {
      console.log(`⚠ Not enough USDC (have ${ethers.formatUnits(usdcBal, 6)}, need ${ethers.formatUnits(USDC_FUND, 6)}). Get from Aave faucet.`);
    }
  } else {
    console.log("\n(Skipping funding — price shift mode)");
  }

  // --- Final balances ---
  const routerWeth = await weth.balanceOf(MOCK_SWAP_ROUTER);
  const routerUsdc = await usdc.balanceOf(MOCK_SWAP_ROUTER);
  console.log("\nMockSwapRouter balances:");
  console.log(`  WETH: ${ethers.formatEther(routerWeth)}`);
  console.log(`  USDC: ${ethers.formatUnits(routerUsdc, 6)}`);
  console.log("\n✅ Router ready!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
