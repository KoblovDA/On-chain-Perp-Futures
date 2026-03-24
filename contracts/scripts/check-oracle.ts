import { ethers } from "hardhat";

async function main() {
  const provider = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A";
  const addressesProvider = await ethers.getContractAt(
    ["function getPriceOracle() view returns (address)"],
    provider
  );
  const oracleAddr = await addressesProvider.getPriceOracle();
  console.log("Oracle address:", oracleAddr);

  const oracle = await ethers.getContractAt(
    ["function getAssetPrice(address) view returns (uint256)"],
    oracleAddr
  );

  const WETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
  const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

  const wethPrice = await oracle.getAssetPrice(WETH);
  const usdcPrice = await oracle.getAssetPrice(USDC);

  console.log("WETH price:", ethers.formatUnits(wethPrice, 8), "USD");
  console.log("USDC price:", ethers.formatUnits(usdcPrice, 8), "USD");
  console.log("WETH/USDC rate:", Number(wethPrice) / Number(usdcPrice));

  // Check USDC reserve config (can it be used as collateral?)
  const pool = await ethers.getContractAt(
    [
      "function getReserveData(address) view returns (tuple(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128))",
      "function getConfiguration(address) view returns (tuple(uint256))",
    ],
    "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"
  );

  const usdcReserve = await pool.getReserveData(USDC);
  console.log("\nUSDC aToken:", usdcReserve[8]);
  console.log("USDC stableDebtToken:", usdcReserve[9]);
  console.log("USDC variableDebtToken:", usdcReserve[10]);
  console.log("USDC aToken is zero:", usdcReserve[8] === "0x0000000000000000000000000000000000000000");

  const wethReserve = await pool.getReserveData(WETH);
  console.log("\nWETH aToken:", wethReserve[8]);

  // Check USDC liquidity
  const usdcToken = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], USDC);
  const usdcInAToken = await usdcToken.balanceOf(usdcReserve[8]);
  console.log("USDC liquidity in Aave:", ethers.formatUnits(usdcInAToken, 6));
}

main().catch(console.error);
