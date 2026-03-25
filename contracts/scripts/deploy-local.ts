import { ethers } from "hardhat";

/**
 * Deploy all contracts to local Hardhat node (fully mocked, no Aave dependency).
 * Fetches real ETH price from CoinGecko API.
 *
 * Usage:
 *   1. Start node:  npx hardhat node
 *   2. Deploy:      npx hardhat run scripts/deploy-local.ts --network localhost
 *
 * After deploy, copy the printed addresses into frontend/src/lib/network-config.ts (LOCAL_ADDRESSES).
 */

const USDC_PRICE = 1; // stablecoin, always $1

async function fetchEthPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const data = await res.json();
    const price = data.ethereum.usd;
    console.log(`Fetched real ETH price: $${price}`);
    return Math.round(price);
  } catch {
    console.log("Failed to fetch price, using fallback $2500");
    return 2500;
  }
}

async function main() {
  const WETH_PRICE = await fetchEthPrice();
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // --- 1. Deploy mock tokens ---
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const weth = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
  await weth.waitForDeployment();
  console.log("WETH:", await weth.getAddress());

  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  console.log("USDC:", await usdc.getAddress());

  // --- 2. Deploy MockOracle ---
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("Oracle:", await oracle.getAddress());

  // Set prices (8 decimals like Chainlink)
  await oracle.setAssetPrice(await weth.getAddress(), BigInt(WETH_PRICE) * 10n ** 8n);
  await oracle.setAssetPrice(await usdc.getAddress(), BigInt(USDC_PRICE) * 10n ** 8n);
  console.log(`  WETH price: $${WETH_PRICE}`);
  console.log(`  USDC price: $${USDC_PRICE}`);

  // --- 3. Deploy MockPool ---
  const MockPool = await ethers.getContractFactory("MockPool");
  const pool = await MockPool.deploy();
  await pool.waitForDeployment();
  console.log("Pool:", await pool.getAddress());

  // Init reserves (creates aTokens and debtTokens)
  await pool.initReserve(await weth.getAddress());
  await pool.initReserve(await usdc.getAddress());
  console.log("  Reserves initialized for WETH and USDC");

  // --- 4. Deploy MockPoolAddressesProvider ---
  const MockProvider = await ethers.getContractFactory("MockPoolAddressesProvider");
  const provider = await MockProvider.deploy();
  await provider.waitForDeployment();
  await provider.setPool(await pool.getAddress());
  await provider.setPriceOracle(await oracle.getAddress());
  console.log("AddressesProvider:", await provider.getAddress());

  // --- 5. Deploy MockSwapRouter ---
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const router = await MockSwapRouter.deploy();
  await router.waitForDeployment();
  console.log("SwapRouter:", await router.getAddress());

  // Set rates matching oracle
  const wethAddr = await weth.getAddress();
  const usdcAddr = await usdc.getAddress();

  await router.setRate(wethAddr, usdcAddr, ethers.parseEther(WETH_PRICE.toString()), 18, 6);
  await router.setRate(usdcAddr, wethAddr, ethers.parseEther((1 / WETH_PRICE).toFixed(8)), 6, 18);
  console.log(`  Rates: 1 WETH = ${WETH_PRICE} USDC`);

  // --- 6. Deploy PositionManager ---
  const PositionManager = await ethers.getContractFactory("PositionManager");
  const pm = await PositionManager.deploy(await provider.getAddress(), await router.getAddress());
  await pm.waitForDeployment();
  console.log("PositionManager:", await pm.getAddress());

  // --- 7. Fund everything ---
  // Mint WETH and USDC to deployer
  const wethAmount = ethers.parseEther("100");
  const usdcAmount = ethers.parseUnits("100000", 6);

  await weth.mint(deployer.address, wethAmount);
  await usdc.mint(deployer.address, usdcAmount);
  console.log(`\nMinted to deployer: 100 WETH, 100,000 USDC`);

  // Fund MockSwapRouter with liquidity
  await weth.transfer(await router.getAddress(), ethers.parseEther("50"));
  await usdc.transfer(await router.getAddress(), ethers.parseUnits("50000", 6));
  console.log("Funded router: 50 WETH, 50,000 USDC");

  // Fund MockPool with liquidity (for flash loans and borrows)
  await weth.mint(await pool.getAddress(), ethers.parseEther("1000"));
  await usdc.mint(await pool.getAddress(), ethers.parseUnits("1000000", 6));
  console.log("Funded pool: 1,000 WETH, 1,000,000 USDC");

  // --- Summary ---
  console.log("\n========================================");
  console.log("LOCAL DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`WETH:              ${wethAddr}`);
  console.log(`USDC:              ${usdcAddr}`);
  console.log(`PositionManager:   ${await pm.getAddress()}`);
  console.log(`SwapRouter:        ${await router.getAddress()}`);
  console.log(`Pool:              ${await pool.getAddress()}`);
  console.log(`Oracle:            ${await oracle.getAddress()}`);
  console.log(`Provider:          ${await provider.getAddress()}`);
  console.log("========================================");
  console.log("\nDeployer has 50 WETH + 50,000 USDC to trade with.");
  console.log("Shorts work here — no Aave supply/borrow caps!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
