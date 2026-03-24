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
}

main().catch(console.error);
