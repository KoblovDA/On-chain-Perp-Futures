import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();

  const faucet = await ethers.getContractAt(
    ["function mint(address,address,uint256) external returns (uint256)"],
    "0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D"
  );

  const tokens = [
    { name: "WETH", addr: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c" },
    { name: "USDC", addr: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
    { name: "DAI",  addr: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357" },
    { name: "WBTC", addr: "0x29f2D40B0605204364af54EC677bD022dA425d03" },
  ];

  for (const t of tokens) {
    try {
      const tx = await faucet.mint(t.addr, signer.address, ethers.parseUnits("100", 18));
      await tx.wait();
      console.log(`${t.name}: mint succeeded`);
    } catch(e: any) {
      console.log(`${t.name}: mint FAILED - ${e.reason || e.message?.substring(0, 100)}`);
    }
  }

  // Check if WETH is special — try wrapping native ETH
  try {
    const weth = await ethers.getContractAt(
      ["function deposit() payable", "function balanceOf(address) view returns (uint256)", "function name() view returns (string)"],
      "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c"
    );
    const name = await weth.name();
    console.log("WETH name:", name);

    // Try depositing ETH to get WETH
    const tx = await weth.deposit({ value: ethers.parseEther("1") });
    await tx.wait();
    const bal = await weth.balanceOf(signer.address);
    console.log("WETH balance after deposit:", ethers.formatEther(bal));
  } catch(e: any) {
    console.log("WETH deposit error:", e.reason || e.message?.substring(0, 100));
  }
}

main().catch(console.error);
