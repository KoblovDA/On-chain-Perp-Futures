import { ethers } from "hardhat";

const PM = "0x1f15AA1DaB4933900A6C2Ea8F5D2d28fAAA5e5eD";
const ROUTER = "0xFdaD24fE8b093E1f20842BbF9AE80A179d80c3A9";
const WETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

async function main() {
  const [signer] = await ethers.getSigners();

  // Check MockSwapRouter liquidity
  const weth = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], WETH);
  const usdc = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], USDC);

  const routerWeth = await weth.balanceOf(ROUTER);
  const routerUsdc = await usdc.balanceOf(ROUTER);
  console.log("Router WETH:", ethers.formatEther(routerWeth));
  console.log("Router USDC:", ethers.formatUnits(routerUsdc, 6));

  // Check position #0
  const pm = await ethers.getContractAt(
    [
      "function getPosition(uint256) view returns (tuple(address,uint8,address,address,uint256,uint256,uint256,uint256,uint256,uint256,bool))",
      "function closeLong(uint256) returns (uint256)",
    ],
    PM,
    signer
  );

  const pos = await pm.getPosition(0);
  console.log("\nPosition #0:");
  console.log("  Owner:", pos[0]);
  console.log("  Type:", pos[1] === 0n ? "LONG" : "SHORT");
  console.log("  Collateral:", ethers.formatEther(pos[4]), "WETH");
  console.log("  Debt:", ethers.formatUnits(pos[5], 6), "USDC");
  console.log("  Active:", pos[10]);

  if (!pos[10]) {
    console.log("Position already closed");
    return;
  }

  console.log("\nTrying closeLong(0)...");
  try {
    const tx = await pm.closeLong(0);
    const receipt = await tx.wait();
    console.log("Success! Tx:", receipt!.hash);
  } catch (err: any) {
    console.error("Revert reason:", err.reason || err.message);
    if (err.data) console.error("Error data:", err.data);
  }
}

main().catch(console.error);
