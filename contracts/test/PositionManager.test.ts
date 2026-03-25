import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PositionManager - Long Positions", function () {
  let positionManager: any;
  let mockRouter: any;
  let mockPool: any;
  let mockOracle: any;
  let provider: any;
  let weth: any;
  let usdc: any;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  const LEVERAGE_2X = 20000n;
  const LEVERAGE_3X = 30000n;
  const MARGIN_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC

  // Prices in Aave oracle format (8 decimals, USD)
  const WETH_PRICE = 2000_00000000n; // $2000
  const USDC_PRICE = 1_00000000n;     // $1

  async function deployAll() {
    [deployer, user] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    weth = await MockERC20.deploy("Wrapped ETH", "WETH", 18);
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy MockPool
    const MockPool = await ethers.getContractFactory("MockPool");
    mockPool = await MockPool.deploy();

    // Initialize reserves in MockPool
    await mockPool.initReserve(await weth.getAddress());
    await mockPool.initReserve(await usdc.getAddress());

    // Deploy MockOracle
    const MockOracle = await ethers.getContractFactory("MockOracle");
    mockOracle = await MockOracle.deploy();
    await mockOracle.setAssetPrice(await weth.getAddress(), WETH_PRICE);
    await mockOracle.setAssetPrice(await usdc.getAddress(), USDC_PRICE);

    // Deploy MockPoolAddressesProvider
    const MockProvider = await ethers.getContractFactory("MockPoolAddressesProvider");
    provider = await MockProvider.deploy();
    await provider.setPool(await mockPool.getAddress());
    await provider.setPriceOracle(await mockOracle.getAddress());

    // Deploy MockSwapRouter
    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    mockRouter = await MockSwapRouter.deploy();

    // Set swap rates: 1 WETH = 2000 USDC
    await mockRouter.setRate(
      await weth.getAddress(), await usdc.getAddress(),
      ethers.parseEther("2000"), 18, 6
    );
    await mockRouter.setRate(
      await usdc.getAddress(), await weth.getAddress(),
      ethers.parseEther("0.0005"), 6, 18
    );

    // Deploy PositionManager
    const PositionManager = await ethers.getContractFactory("PositionManager");
    positionManager = await PositionManager.deploy(
      await provider.getAddress(),
      await mockRouter.getAddress()
    );

    // Fund: mint tokens for liquidity
    const poolAddr = await mockPool.getAddress();
    const routerAddr = await mockRouter.getAddress();
    const pmAddr = await positionManager.getAddress();

    // Pool needs WETH for flash loans (plenty of liquidity)
    await weth.mint(poolAddr, ethers.parseEther("10000"));
    // Pool needs USDC for borrowing
    await usdc.mint(poolAddr, ethers.parseUnits("1000000", 6));

    // Router needs both tokens for swaps
    await weth.mint(routerAddr, ethers.parseEther("1000"));
    await usdc.mint(routerAddr, ethers.parseUnits("2000000", 6));

    // User gets USDC for margin
    await usdc.mint(user.address, ethers.parseUnits("50000", 6));

    // User approves PositionManager
    await usdc.connect(user).approve(pmAddr, ethers.MaxUint256);
    await weth.connect(user).approve(pmAddr, ethers.MaxUint256);
  }

  beforeEach(async function () {
    await deployAll();
  });

  describe("openLong", function () {
    it("should open a 2x leveraged long WETH/USDC position", async function () {
      await positionManager
        .connect(user)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      const pos = await positionManager.getPosition(0);
      expect(pos.owner).to.equal(user.address);
      expect(pos.positionType).to.equal(0n); // LONG
      expect(pos.isActive).to.be.true;
      expect(pos.leverageBps).to.equal(LEVERAGE_2X);
      expect(pos.marginAmount).to.equal(MARGIN_AMOUNT);

      // Collateral = flash loan WETH amount (should be ~1 WETH at $2000)
      expect(pos.collateralAmount).to.be.gt(0);
      // Debt = totalPosition - margin = 2000 - 1000 = 1000 USDC
      expect(pos.debtAmount).to.equal(ethers.parseUnits("1000", 6));

      const userPositions = await positionManager.getUserPositions(user.address);
      expect(userPositions.length).to.equal(1);
    });

    it("should open a 3x leveraged long position with higher debt", async function () {
      await positionManager
        .connect(user)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_3X, 0);

      const pos = await positionManager.getPosition(0);
      expect(pos.leverageBps).to.equal(LEVERAGE_3X);
      // Debt = 3000 - 1000 = 2000 USDC
      expect(pos.debtAmount).to.equal(ethers.parseUnits("2000", 6));
    });

    it("should emit PositionOpened event", async function () {
      await expect(
        positionManager
          .connect(user)
          .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0)
      ).to.emit(positionManager, "PositionOpened");
    });

    it("should revert with zero margin", async function () {
      await expect(
        positionManager
          .connect(user)
          .openLong(await weth.getAddress(), await usdc.getAddress(), 0, LEVERAGE_2X, 0)
      ).to.be.revertedWith("PM: zero margin");
    });

    it("should revert with invalid leverage (1x)", async function () {
      await expect(
        positionManager
          .connect(user)
          .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, 10000n, 0)
      ).to.be.revertedWith("PM: invalid leverage");
    });

    it("should revert with leverage too high (>5x)", async function () {
      await expect(
        positionManager
          .connect(user)
          .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, 60000n, 0)
      ).to.be.revertedWith("PM: invalid leverage");
    });

    it("should increment position count", async function () {
      expect(await positionManager.positionCount()).to.equal(0);
      await positionManager
        .connect(user)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      expect(await positionManager.positionCount()).to.equal(1);
    });

    it("should support multiple positions per user", async function () {
      await positionManager
        .connect(user)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(user)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_3X, 0);

      expect(await positionManager.positionCount()).to.equal(2);
      const userPositions = await positionManager.getUserPositions(user.address);
      expect(userPositions.length).to.equal(2);
    });
  });

  describe("closeLong", function () {
    beforeEach(async function () {
      await positionManager
        .connect(user)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
    });

    it("should close position and return funds to user", async function () {
      const usdcBefore = await usdc.balanceOf(user.address);

      await positionManager.connect(user).closeLong(0);

      const usdcAfter = await usdc.balanceOf(user.address);
      // User should get some USDC back (close to margin minus flash loan fees)
      expect(usdcAfter).to.be.gt(usdcBefore);

      const pos = await positionManager.getPosition(0);
      expect(pos.isActive).to.be.false;
    });

    it("should emit PositionClosed event", async function () {
      await expect(positionManager.connect(user).closeLong(0))
        .to.emit(positionManager, "PositionClosed");
    });

    it("should revert if not position owner", async function () {
      await expect(
        positionManager.connect(deployer).closeLong(0)
      ).to.be.revertedWith("PM: not owner");
    });

    it("should revert if already closed", async function () {
      await positionManager.connect(user).closeLong(0);
      await expect(
        positionManager.connect(user).closeLong(0)
      ).to.be.revertedWith("PM: not active");
    });
  });
});

describe("PositionManager - Short Positions", function () {
  let positionManager: any;
  let mockRouter: any;
  let mockPool: any;
  let mockOracle: any;
  let provider: any;
  let weth: any;
  let usdc: any;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  const LEVERAGE_2X = 20000n;
  const LEVERAGE_3X = 30000n;
  const MARGIN_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC

  const WETH_PRICE = 2000_00000000n;
  const USDC_PRICE = 1_00000000n;

  async function deployAll() {
    [deployer, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    weth = await MockERC20.deploy("Wrapped ETH", "WETH", 18);
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    const MockPool = await ethers.getContractFactory("MockPool");
    mockPool = await MockPool.deploy();
    await mockPool.initReserve(await weth.getAddress());
    await mockPool.initReserve(await usdc.getAddress());

    const MockOracle = await ethers.getContractFactory("MockOracle");
    mockOracle = await MockOracle.deploy();
    await mockOracle.setAssetPrice(await weth.getAddress(), WETH_PRICE);
    await mockOracle.setAssetPrice(await usdc.getAddress(), USDC_PRICE);

    const MockProvider = await ethers.getContractFactory("MockPoolAddressesProvider");
    provider = await MockProvider.deploy();
    await provider.setPool(await mockPool.getAddress());
    await provider.setPriceOracle(await mockOracle.getAddress());

    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    mockRouter = await MockSwapRouter.deploy();

    await mockRouter.setRate(
      await weth.getAddress(), await usdc.getAddress(),
      ethers.parseEther("2000"), 18, 6
    );
    await mockRouter.setRate(
      await usdc.getAddress(), await weth.getAddress(),
      ethers.parseEther("0.0005"), 6, 18
    );

    const PositionManager = await ethers.getContractFactory("PositionManager");
    positionManager = await PositionManager.deploy(
      await provider.getAddress(),
      await mockRouter.getAddress()
    );

    const poolAddr = await mockPool.getAddress();
    const routerAddr = await mockRouter.getAddress();
    const pmAddr = await positionManager.getAddress();

    // Pool needs WETH for borrowing (short borrows WETH)
    await weth.mint(poolAddr, ethers.parseEther("10000"));
    // Pool needs USDC for flash loans (not used for short, but keep for completeness)
    await usdc.mint(poolAddr, ethers.parseUnits("1000000", 6));

    // Router needs both tokens for swaps
    await weth.mint(routerAddr, ethers.parseEther("1000"));
    await usdc.mint(routerAddr, ethers.parseUnits("2000000", 6));

    // User gets USDC for margin
    await usdc.mint(user.address, ethers.parseUnits("50000", 6));

    // User approves PositionManager
    await usdc.connect(user).approve(pmAddr, ethers.MaxUint256);
    await weth.connect(user).approve(pmAddr, ethers.MaxUint256);
  }

  beforeEach(async function () {
    await deployAll();
  });

  describe("openShort", function () {
    it("should open a 2x leveraged short WETH/USDC position", async function () {
      await positionManager
        .connect(user)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      const pos = await positionManager.getPosition(0);
      expect(pos.owner).to.equal(user.address);
      expect(pos.positionType).to.equal(1n); // SHORT
      expect(pos.isActive).to.be.true;
      expect(pos.leverageBps).to.equal(LEVERAGE_2X);
      expect(pos.marginAmount).to.equal(MARGIN_AMOUNT);

      // Collateral = USDC deposited (swapped USDC + margin)
      expect(pos.collateralAmount).to.be.gt(0);
      // Debt = WETH borrowed (flash loan amount + premium)
      expect(pos.debtAmount).to.be.gt(0);

      const userPositions = await positionManager.getUserPositions(user.address);
      expect(userPositions.length).to.equal(1);
    });

    it("should open a 3x leveraged short position", async function () {
      await positionManager
        .connect(user)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_3X, 0);

      const pos = await positionManager.getPosition(0);
      expect(pos.leverageBps).to.equal(LEVERAGE_3X);
      expect(pos.isActive).to.be.true;
      // Higher leverage = more debt
      expect(pos.debtAmount).to.be.gt(0);
    });

    it("should emit PositionOpened event", async function () {
      await expect(
        positionManager
          .connect(user)
          .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0)
      ).to.emit(positionManager, "PositionOpened");
    });

    it("should revert with zero margin", async function () {
      await expect(
        positionManager
          .connect(user)
          .openShort(await usdc.getAddress(), await weth.getAddress(), 0, LEVERAGE_2X, 0)
      ).to.be.revertedWith("PM: zero margin");
    });

    it("should revert with invalid leverage", async function () {
      await expect(
        positionManager
          .connect(user)
          .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, 10000n, 0)
      ).to.be.revertedWith("PM: invalid leverage");
    });

    it("should increment position count", async function () {
      expect(await positionManager.positionCount()).to.equal(0);
      await positionManager
        .connect(user)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      expect(await positionManager.positionCount()).to.equal(1);
    });
  });

  describe("closeShort", function () {
    beforeEach(async function () {
      await positionManager
        .connect(user)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
    });

    it("should close position and return funds to user", async function () {
      const usdcBefore = await usdc.balanceOf(user.address);

      await positionManager.connect(user).closeShort(0);

      const usdcAfter = await usdc.balanceOf(user.address);
      expect(usdcAfter).to.be.gt(usdcBefore);

      const pos = await positionManager.getPosition(0);
      expect(pos.isActive).to.be.false;
    });

    it("should emit PositionClosed event", async function () {
      await expect(positionManager.connect(user).closeShort(0))
        .to.emit(positionManager, "PositionClosed");
    });

    it("should revert if not position owner", async function () {
      await expect(
        positionManager.connect(deployer).closeShort(0)
      ).to.be.revertedWith("PM: not owner");
    });

    it("should revert if already closed", async function () {
      await positionManager.connect(user).closeShort(0);
      await expect(
        positionManager.connect(user).closeShort(0)
      ).to.be.revertedWith("PM: not active");
    });
  });

  describe("mixed positions", function () {
    it("should handle both long and short positions for same user", async function () {
      // Open a long
      await positionManager
        .connect(user)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      // Open a short
      await positionManager
        .connect(user)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      expect(await positionManager.positionCount()).to.equal(2);
      const userPositions = await positionManager.getUserPositions(user.address);
      expect(userPositions.length).to.equal(2);

      const longPos = await positionManager.getPosition(0);
      const shortPos = await positionManager.getPosition(1);
      expect(longPos.positionType).to.equal(0n); // LONG
      expect(shortPos.positionType).to.equal(1n); // SHORT
    });
  });
});

describe("PositionManager - Multi-Position Isolation", function () {
  let positionManager: any;
  let mockRouter: any;
  let mockPool: any;
  let mockOracle: any;
  let provider: any;
  let weth: any;
  let usdc: any;
  let deployer: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;

  const LEVERAGE_2X = 20000n;
  const LEVERAGE_3X = 30000n;
  const MARGIN_AMOUNT = ethers.parseUnits("1000", 6);

  const WETH_PRICE = 2000_00000000n;
  const USDC_PRICE = 1_00000000n;

  async function deployAll() {
    [deployer, userA, userB] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    weth = await MockERC20.deploy("Wrapped ETH", "WETH", 18);
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    const MockPool = await ethers.getContractFactory("MockPool");
    mockPool = await MockPool.deploy();
    await mockPool.initReserve(await weth.getAddress());
    await mockPool.initReserve(await usdc.getAddress());

    const MockOracle = await ethers.getContractFactory("MockOracle");
    mockOracle = await MockOracle.deploy();
    await mockOracle.setAssetPrice(await weth.getAddress(), WETH_PRICE);
    await mockOracle.setAssetPrice(await usdc.getAddress(), USDC_PRICE);

    const MockProvider = await ethers.getContractFactory("MockPoolAddressesProvider");
    provider = await MockProvider.deploy();
    await provider.setPool(await mockPool.getAddress());
    await provider.setPriceOracle(await mockOracle.getAddress());

    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    mockRouter = await MockSwapRouter.deploy();

    await mockRouter.setRate(
      await weth.getAddress(), await usdc.getAddress(),
      ethers.parseEther("2000"), 18, 6
    );
    await mockRouter.setRate(
      await usdc.getAddress(), await weth.getAddress(),
      ethers.parseEther("0.0005"), 6, 18
    );

    const PositionManager = await ethers.getContractFactory("PositionManager");
    positionManager = await PositionManager.deploy(
      await provider.getAddress(),
      await mockRouter.getAddress()
    );

    const poolAddr = await mockPool.getAddress();
    const routerAddr = await mockRouter.getAddress();
    const pmAddr = await positionManager.getAddress();

    await weth.mint(poolAddr, ethers.parseEther("10000"));
    await usdc.mint(poolAddr, ethers.parseUnits("5000000", 6));

    await weth.mint(routerAddr, ethers.parseEther("5000"));
    await usdc.mint(routerAddr, ethers.parseUnits("10000000", 6));

    await usdc.mint(userA.address, ethers.parseUnits("50000", 6));
    await usdc.mint(userB.address, ethers.parseUnits("50000", 6));

    await usdc.connect(userA).approve(pmAddr, ethers.MaxUint256);
    await weth.connect(userA).approve(pmAddr, ethers.MaxUint256);
    await usdc.connect(userB).approve(pmAddr, ethers.MaxUint256);
    await weth.connect(userB).approve(pmAddr, ethers.MaxUint256);
  }

  beforeEach(async function () {
    await deployAll();
  });

  describe("concurrent long positions", function () {
    it("closing first long should not affect second long", async function () {
      await positionManager
        .connect(userA)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(userB)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_3X, 0);

      const posB_before = await positionManager.getPosition(1);
      expect(posB_before.isActive).to.be.true;

      await positionManager.connect(userA).closeLong(0);

      const posA = await positionManager.getPosition(0);
      expect(posA.isActive).to.be.false;

      const posB_after = await positionManager.getPosition(1);
      expect(posB_after.isActive).to.be.true;
      expect(posB_after.collateralAmount).to.equal(posB_before.collateralAmount);
      expect(posB_after.debtAmount).to.equal(posB_before.debtAmount);
    });

    it("both longs can be closed independently and return funds", async function () {
      const balA_initial = await usdc.balanceOf(userA.address);
      const balB_initial = await usdc.balanceOf(userB.address);

      await positionManager
        .connect(userA)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(userB)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      const balA_afterOpen = await usdc.balanceOf(userA.address);
      const balB_afterOpen = await usdc.balanceOf(userB.address);
      expect(balA_afterOpen).to.equal(balA_initial - MARGIN_AMOUNT);
      expect(balB_afterOpen).to.equal(balB_initial - MARGIN_AMOUNT);

      await positionManager.connect(userA).closeLong(0);
      const balA_afterClose = await usdc.balanceOf(userA.address);
      expect(balA_afterClose).to.be.gt(balA_afterOpen);

      await positionManager.connect(userB).closeLong(1);
      const balB_afterClose = await usdc.balanceOf(userB.address);
      expect(balB_afterClose).to.be.gt(balB_afterOpen);

      expect((await positionManager.getPosition(0)).isActive).to.be.false;
      expect((await positionManager.getPosition(1)).isActive).to.be.false;
    });
  });

  describe("concurrent short positions", function () {
    it("closing first short should not affect second short", async function () {
      await positionManager
        .connect(userA)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(userB)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      const posB_before = await positionManager.getPosition(1);

      await positionManager.connect(userA).closeShort(0);

      const posA = await positionManager.getPosition(0);
      expect(posA.isActive).to.be.false;

      const posB_after = await positionManager.getPosition(1);
      expect(posB_after.isActive).to.be.true;
      expect(posB_after.collateralAmount).to.equal(posB_before.collateralAmount);
      expect(posB_after.debtAmount).to.equal(posB_before.debtAmount);
    });

    it("both shorts can be closed independently and return funds", async function () {
      await positionManager
        .connect(userA)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(userB)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      const balA_afterOpen = await usdc.balanceOf(userA.address);
      const balB_afterOpen = await usdc.balanceOf(userB.address);

      await positionManager.connect(userA).closeShort(0);
      expect(await usdc.balanceOf(userA.address)).to.be.gt(balA_afterOpen);

      await positionManager.connect(userB).closeShort(1);
      expect(await usdc.balanceOf(userB.address)).to.be.gt(balB_afterOpen);
    });
  });

  describe("concurrent long + short positions", function () {
    it("closing long should not affect concurrent short", async function () {
      await positionManager
        .connect(userA)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(userB)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      const shortBefore = await positionManager.getPosition(1);

      await positionManager.connect(userA).closeLong(0);

      const shortAfter = await positionManager.getPosition(1);
      expect(shortAfter.isActive).to.be.true;
      expect(shortAfter.collateralAmount).to.equal(shortBefore.collateralAmount);
      expect(shortAfter.debtAmount).to.equal(shortBefore.debtAmount);

      await positionManager.connect(userB).closeShort(1);
      expect((await positionManager.getPosition(1)).isActive).to.be.false;
    });

    it("closing short should not affect concurrent long", async function () {
      await positionManager
        .connect(userA)
        .openShort(await usdc.getAddress(), await weth.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(userB)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      const longBefore = await positionManager.getPosition(1);

      await positionManager.connect(userA).closeShort(0);

      const longAfter = await positionManager.getPosition(1);
      expect(longAfter.isActive).to.be.true;
      expect(longAfter.collateralAmount).to.equal(longBefore.collateralAmount);
      expect(longAfter.debtAmount).to.equal(longBefore.debtAmount);

      await positionManager.connect(userB).closeLong(1);
      expect((await positionManager.getPosition(1)).isActive).to.be.false;
    });
  });

  describe("three concurrent positions", function () {
    it("should handle open-close-open-close-close sequence correctly", async function () {
      await positionManager
        .connect(userA)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);
      await positionManager
        .connect(userA)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_3X, 0);
      await positionManager
        .connect(userB)
        .openLong(await weth.getAddress(), await usdc.getAddress(), MARGIN_AMOUNT, LEVERAGE_2X, 0);

      expect(await positionManager.positionCount()).to.equal(3);

      // Close middle position first
      await positionManager.connect(userA).closeLong(1);
      expect((await positionManager.getPosition(1)).isActive).to.be.false;
      expect((await positionManager.getPosition(0)).isActive).to.be.true;
      expect((await positionManager.getPosition(2)).isActive).to.be.true;

      // Close first position
      await positionManager.connect(userA).closeLong(0);
      expect((await positionManager.getPosition(0)).isActive).to.be.false;
      expect((await positionManager.getPosition(2)).isActive).to.be.true;

      // Close last position
      const balB_before = await usdc.balanceOf(userB.address);
      await positionManager.connect(userB).closeLong(2);
      expect((await positionManager.getPosition(2)).isActive).to.be.false;
      expect(await usdc.balanceOf(userB.address)).to.be.gt(balB_before);
    });
  });
});
