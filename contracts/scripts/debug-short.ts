import { ethers } from "hardhat";

const PM = "0x1f15AA1DaB4933900A6C2Ea8F5D2d28fAAA5e5eD";
const WETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

async function main() {
  const [signer] = await ethers.getSigners();

  const pm = await ethers.getContractAt(
    [
      "function openShort(address,address,uint256,uint256,uint256) returns (uint256)",
      "function positionCount() view returns (uint256)",
    ],
    PM,
    signer
  );

  const usdc = await ethers.getContractAt(
    ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    USDC,
    signer
  );

  const bal = await usdc.balanceOf(signer.address);
  console.log("USDC balance:", ethers.formatUnits(bal, 6));

  // Approve if needed
  const approveTx = await usdc.approve(PM, ethers.MaxUint256);
  await approveTx.wait();
  console.log("Approved PositionManager");

  // Try openShort with 2 USDC margin, 2x leverage
  const margin = ethers.parseUnits("2", 6);
  const leverage = 20000n; // 2x

  console.log("\nCalling openShort...");
  try {
    const tx = await pm.openShort(USDC, WETH, margin, leverage, 0);
    const receipt = await tx.wait();
    console.log("Success! Position ID:", await pm.positionCount() - 1n);
    console.log("Tx:", receipt.hash);
  } catch (err: any) {
    console.error("Revert reason:", err.reason || err.message);
    if (err.data) {
      console.error("Error data:", err.data);
    }
  }
}

main().catch(console.error);
