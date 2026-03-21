import { expect } from "chai";
import { ethers } from "hardhat";
import { MockSwapRouter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockSwapRouter", function () {
  let router: MockSwapRouter;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let tokenA: any; // Mock ERC20 (18 decimals, like WETH)
  let tokenB: any; // Mock ERC20 (6 decimals, like USDC)

  const RATE_A_TO_B = ethers.parseEther("2000"); // 1 tokenA = 2000 tokenB
  const DECIMALS_A = 18;
  const DECIMALS_B = 6;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Wrapped ETH", "WETH", 18);
    tokenB = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy MockSwapRouter
    const MockSwapRouterFactory = await ethers.getContractFactory("MockSwapRouter");
    router = await MockSwapRouterFactory.deploy();

    // Set exchange rate: 1 WETH = 2000 USDC
    await router.setRate(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      RATE_A_TO_B,
      DECIMALS_A,
      DECIMALS_B
    );

    // Set reverse rate: 1 USDC = 0.0005 WETH
    const RATE_B_TO_A = ethers.parseEther("0.0005");
    await router.setRate(
      await tokenB.getAddress(),
      await tokenA.getAddress(),
      RATE_B_TO_A,
      DECIMALS_B,
      DECIMALS_A
    );

    // Mint tokens
    const mintAmount_A = ethers.parseEther("100");  // 100 WETH
    const mintAmount_B = ethers.parseUnits("500000", 6); // 500,000 USDC

    await tokenA.mint(user.address, mintAmount_A);
    await tokenB.mint(user.address, mintAmount_B);

    // Fund the router with liquidity
    await tokenA.mint(await router.getAddress(), ethers.parseEther("1000"));
    await tokenB.mint(await router.getAddress(), ethers.parseUnits("2000000", 6));
  });

  describe("Rate Setting", function () {
    it("should store the rate correctly", async function () {
      const rate = await router.rates(
        await tokenA.getAddress(),
        await tokenB.getAddress()
      );
      expect(rate).to.equal(RATE_A_TO_B);
    });

    it("should only allow owner to set rates", async function () {
      await expect(
        router.connect(user).setRate(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          RATE_A_TO_B,
          DECIMALS_A,
          DECIMALS_B
        )
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });
  });

  describe("getAmountOut", function () {
    it("should calculate correct output for WETH → USDC", async function () {
      // 1 WETH at rate 2000 = 2000 USDC
      const amountIn = ethers.parseEther("1"); // 1 WETH
      const amountOut = await router.getAmountOut(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountIn
      );
      // Expected: 2000 USDC = 2000 * 1e6
      expect(amountOut).to.equal(ethers.parseUnits("2000", 6));
    });

    it("should calculate correct output for 0.5 WETH → USDC", async function () {
      const amountIn = ethers.parseEther("0.5");
      const amountOut = await router.getAmountOut(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountIn
      );
      expect(amountOut).to.equal(ethers.parseUnits("1000", 6));
    });

    it("should calculate correct output for USDC → WETH", async function () {
      const amountIn = ethers.parseUnits("2000", 6); // 2000 USDC
      const amountOut = await router.getAmountOut(
        await tokenB.getAddress(),
        await tokenA.getAddress(),
        amountIn
      );
      // Expected: 1 WETH = 1e18
      expect(amountOut).to.equal(ethers.parseEther("1"));
    });

    it("should revert if rate not set", async function () {
      const randomAddr = ethers.Wallet.createRandom().address;
      await expect(
        router.getAmountOut(randomAddr, await tokenB.getAddress(), 1000)
      ).to.be.revertedWith("MockSwapRouter: rate not set");
    });
  });

  describe("swapExactInput", function () {
    it("should swap WETH → USDC correctly", async function () {
      const amountIn = ethers.parseEther("1");
      const routerAddr = await router.getAddress();

      // Approve router to spend user's WETH
      await tokenA.connect(user).approve(routerAddr, amountIn);

      const usdcBefore = await tokenB.balanceOf(user.address);

      await router.connect(user).swapExactInput(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountIn,
        ethers.parseUnits("1900", 6), // min 1900 USDC (slippage protection)
        user.address
      );

      const usdcAfter = await tokenB.balanceOf(user.address);
      expect(usdcAfter - usdcBefore).to.equal(ethers.parseUnits("2000", 6));
    });

    it("should swap USDC → WETH correctly", async function () {
      const amountIn = ethers.parseUnits("4000", 6); // 4000 USDC
      const routerAddr = await router.getAddress();

      await tokenB.connect(user).approve(routerAddr, amountIn);

      const wethBefore = await tokenA.balanceOf(user.address);

      await router.connect(user).swapExactInput(
        await tokenB.getAddress(),
        await tokenA.getAddress(),
        amountIn,
        ethers.parseEther("1.9"), // min 1.9 WETH
        user.address
      );

      const wethAfter = await tokenA.balanceOf(user.address);
      expect(wethAfter - wethBefore).to.equal(ethers.parseEther("2"));
    });

    it("should revert if output below minimum", async function () {
      const amountIn = ethers.parseEther("1");
      const routerAddr = await router.getAddress();
      await tokenA.connect(user).approve(routerAddr, amountIn);

      await expect(
        router.connect(user).swapExactInput(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountIn,
          ethers.parseUnits("2100", 6), // asking for more than rate allows
          user.address
        )
      ).to.be.revertedWith("MockSwapRouter: insufficient output");
    });
  });

  describe("swapExactOutput", function () {
    it("should swap WETH for exact USDC amount", async function () {
      const amountOut = ethers.parseUnits("1000", 6); // want exactly 1000 USDC
      const routerAddr = await router.getAddress();

      // Approve more than needed
      await tokenA.connect(user).approve(routerAddr, ethers.parseEther("1"));

      const wethBefore = await tokenA.balanceOf(user.address);

      await router.connect(user).swapExactOutput(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountOut,
        ethers.parseEther("1"), // max 1 WETH input
        user.address
      );

      const wethAfter = await tokenA.balanceOf(user.address);
      const wethSpent = wethBefore - wethAfter;
      // Should spend 0.5 WETH for 1000 USDC at rate 2000
      expect(wethSpent).to.equal(ethers.parseEther("0.5"));
    });

    it("should revert if input exceeds maximum", async function () {
      const amountOut = ethers.parseUnits("10000", 6); // 10000 USDC
      const routerAddr = await router.getAddress();
      await tokenA.connect(user).approve(routerAddr, ethers.parseEther("100"));

      await expect(
        router.connect(user).swapExactOutput(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountOut,
          ethers.parseEther("1"), // max 1 WETH (need 5 WETH)
          user.address
        )
      ).to.be.revertedWith("MockSwapRouter: excessive input");
    });
  });

  describe("Owner functions", function () {
    it("should allow owner to withdraw tokens", async function () {
      const amount = ethers.parseUnits("100", 6);
      const routerBefore = await tokenB.balanceOf(await router.getAddress());

      await router.withdrawToken(
        await tokenB.getAddress(),
        amount,
        owner.address
      );

      const routerAfter = await tokenB.balanceOf(await router.getAddress());
      expect(routerBefore - routerAfter).to.equal(amount);
    });
  });
});
