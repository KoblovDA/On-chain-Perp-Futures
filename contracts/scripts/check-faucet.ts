import { ethers, network } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();

  // The faucet is not permissioned - anyone can call mint(token, to, amount)
  // But faucet's mint function signature might differ. Let's try calling it.
  const faucetAddr = "0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D";
  const usdcAddr = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

  // Try faucet with (address token, address to, uint256 amount) signature
  const faucet = await ethers.getContractAt(
    ["function mint(address,address,uint256) external returns (uint256)"],
    faucetAddr
  );

  try {
    const tx = await faucet.mint(usdcAddr, signer.address, ethers.parseUnits("1000", 6));
    await tx.wait();
    console.log("Faucet mint succeeded!");

    const usdc = await ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      usdcAddr
    );
    const bal = await usdc.balanceOf(signer.address);
    console.log("USDC balance:", ethers.formatUnits(bal, 6));
  } catch(e: any) {
    console.log("Faucet mint error:", e.reason || e.message?.substring(0, 300));
  }

  // Alternative: try to find token owner and impersonate
  const usdc = await ethers.getContractAt(
    ["function owner() view returns (address)", "function balanceOf(address) view returns (uint256)"],
    usdcAddr
  );

  try {
    const owner = await usdc.owner();
    console.log("USDC owner:", owner);

    // Impersonate owner and mint
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });

    // Fund the impersonated account with ETH for gas
    await signer.sendTransaction({ to: owner, value: ethers.parseEther("1") });

    const ownerSigner = await ethers.getSigner(owner);
    const usdcAsOwner = await ethers.getContractAt(
      ["function mint(address,uint256) external returns (bool)"],
      usdcAddr,
      ownerSigner
    );

    const tx = await usdcAsOwner.mint(signer.address, ethers.parseUnits("1000", 6));
    await tx.wait();
    console.log("Owner mint succeeded!");

    const bal = await usdc.balanceOf(signer.address);
    console.log("USDC balance after owner mint:", ethers.formatUnits(bal, 6));
  } catch(e: any) {
    console.log("Owner approach error:", e.reason || e.message?.substring(0, 300));
  }
}

main().catch(console.error);
