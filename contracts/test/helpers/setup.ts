import { ethers, network } from "hardhat";

// Aave V3 Sepolia addresses
export const AAVE_ADDRESSES = {
  POOL_ADDRESSES_PROVIDER: "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A",
  POOL: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
  ORACLE: "0x2da88497588bf89281816106C7259e31AF45a663",
  WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
  FAUCET: "0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D",
};

/// Mint USDC/DAI via Aave faucet (not for WETH — use getWETH instead)
export async function mintViaFaucet(
  tokenAddress: string,
  recipient: string,
  amount: bigint
) {
  const [signer] = await ethers.getSigners();
  const faucet = new ethers.Contract(
    AAVE_ADDRESSES.FAUCET,
    ["function mint(address,address,uint256) external returns (uint256)"],
    signer
  );
  const tx = await faucet.mint(tokenAddress, recipient, amount);
  await tx.wait();
}

/// Get WETH by wrapping native ETH (WETH on Aave Sepolia is real Wrapped ETH)
export async function getWETH(recipient: string, amount: bigint) {
  const [signer] = await ethers.getSigners();

  // Fund the recipient with ETH if needed
  if (recipient !== signer.address) {
    await signer.sendTransaction({ to: recipient, value: amount });
    // Impersonate recipient to call deposit
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [recipient],
    });
    const recipientSigner = await ethers.getSigner(recipient);
    const weth = new ethers.Contract(
      AAVE_ADDRESSES.WETH,
      ["function deposit() payable"],
      recipientSigner
    );
    const tx = await weth.deposit({ value: amount });
    await tx.wait();
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [recipient],
    });
  } else {
    const weth = new ethers.Contract(
      AAVE_ADDRESSES.WETH,
      ["function deposit() payable"],
      signer
    );
    const tx = await weth.deposit({ value: amount });
    await tx.wait();
  }
}

/// For contracts that can't call deposit(), directly transfer WETH from signer
export async function fundWithWETH(recipient: string, amount: bigint) {
  const [signer] = await ethers.getSigners();
  // Wrap ETH for signer first
  const weth = new ethers.Contract(
    AAVE_ADDRESSES.WETH,
    ["function deposit() payable", "function transfer(address,uint256) returns (bool)"],
    signer
  );
  await (await weth.deposit({ value: amount })).wait();
  await (await weth.transfer(recipient, amount)).wait();
}

// Helper to get ERC20 token contract
export async function getToken(address: string) {
  return await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address, uint256) returns (bool)",
      "function transfer(address, uint256) returns (bool)",
      "function allowance(address, address) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ],
    address
  );
}

// Deploy MockSwapRouter with rates set
export async function deployMockSwapRouter() {
  const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
  const router = await MockSwapRouter.deploy();
  await router.waitForDeployment();

  // Set WETH/USDC rate: 1 WETH = 2000 USDC
  await router.setRate(
    AAVE_ADDRESSES.WETH,
    AAVE_ADDRESSES.USDC,
    ethers.parseEther("2000"),
    18,
    6
  );

  // Set reverse rate: 1 USDC = 0.0005 WETH
  await router.setRate(
    AAVE_ADDRESSES.USDC,
    AAVE_ADDRESSES.WETH,
    ethers.parseEther("0.0005"),
    6,
    18
  );

  return router;
}

// Deploy PositionManager
export async function deployPositionManager(swapRouterAddress: string) {
  const PositionManager = await ethers.getContractFactory("PositionManager");
  const pm = await PositionManager.deploy(
    AAVE_ADDRESSES.POOL_ADDRESSES_PROVIDER,
    swapRouterAddress
  );
  await pm.waitForDeployment();
  return pm;
}
