import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();

  const pool = await ethers.getContractAt(
    [
      "function getReserveData(address) view returns (tuple(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128))",
    ],
    "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"
  );

  const usdc = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"
  );

  const weth = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c"
  );

  // Check aToken balances (USDC reserve in Pool)
  const reserveData = await pool.getReserveData("0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8");
  console.log("USDC reserve data:", reserveData);

  const aTokenAddr = reserveData[8]; // aToken address
  console.log("USDC aToken address:", aTokenAddr);

  // Check actual USDC balance in the aToken contract (that's the liquidity)
  const aTokenUsdcBalance = await usdc.balanceOf(aTokenAddr);
  console.log("USDC in aToken (liquidity):", ethers.formatUnits(aTokenUsdcBalance, 6));

  // Also check WETH liquidity
  const wethReserve = await pool.getReserveData("0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c");
  const wethAToken = wethReserve[8];
  const aTokenWethBalance = await weth.balanceOf(wethAToken);
  console.log("WETH in aToken (liquidity):", ethers.formatEther(aTokenWethBalance));
}

main().catch(console.error);
