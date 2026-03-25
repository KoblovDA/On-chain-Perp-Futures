// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {PositionLib} from "./libraries/PositionLib.sol";

/// @notice Minimal interface for Aave Oracle
interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

/// @notice Minimal interface for ERC20 metadata
interface IERC20Metadata {
    function decimals() external view returns (uint8);
}

/// @title PositionManager
/// @notice Opens/closes leveraged long/short positions using Aave V3 flash loans
/// @dev Based on "Leveraged Trading via Lending Platforms" (Szpruch et al., 2024)
///
/// LONG flow (flash loan collateral asset — WETH):
///   Open:  flash WETH → deposit WETH → borrow USDC → swap USDC→WETH → repay flash
///   Close: flash WETH → swap WETH→USDC → repay USDC debt → withdraw WETH → repay flash
///
/// SHORT flow (flash loan collateral asset — USDC, or use WETH):
///   Open:  flash WETH → swap WETH→USDC → deposit USDC → borrow WETH → repay flash
///   Close: flash WETH → repay WETH debt → withdraw USDC → swap USDC→WETH → repay flash
contract PositionManager is FlashLoanSimpleReceiverBase, IPositionManager {
    using SafeERC20 for IERC20;

    enum ActionType { OPEN_LONG, CLOSE_LONG, OPEN_SHORT, CLOSE_SHORT }

    struct FlashParams {
        ActionType action;
        address user;
        address collateralAsset;
        address debtAsset;
        uint256 marginAmount;
        uint256 leverageBps;
        uint256 minAmountOut;
        uint256 positionId;
    }

    // --- State ---
    ISwapRouter public immutable swapRouter;
    uint256 public override positionCount;

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) internal _userPositionIds;
    mapping(address => uint256) internal _totalBorrowed;

    uint256 private constant VARIABLE_RATE_MODE = 2;
    uint16 private constant REFERRAL_CODE = 0;

    constructor(
        IPoolAddressesProvider _addressesProvider,
        address _swapRouter
    ) FlashLoanSimpleReceiverBase(_addressesProvider) {
        require(_swapRouter != address(0), "PM: zero swap router");
        swapRouter = ISwapRouter(_swapRouter);
    }

    // ============================================================
    //                       OPEN LONG
    // ============================================================
    /// @dev User provides margin in USDC. We flash-loan WETH (high liquidity).
    ///      1. Flash loan WETH
    ///      2. Deposit WETH as collateral
    ///      3. Borrow USDC from Aave
    ///      4. Swap (borrowed USDC + user margin) → WETH to repay flash loan

    function openLong(
        address collateralAsset,
        address debtAsset,
        uint256 marginAmount,
        uint256 leverageBps,
        uint256 minCollateralOut
    ) external override returns (uint256 positionId) {
        require(marginAmount > 0, "PM: zero margin");
        require(leverageBps > 10000 && leverageBps <= 50000, "PM: invalid leverage");

        IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), marginAmount);

        // Calculate how much WETH to flash loan using oracle
        uint256 totalPositionInDebt = PositionLib.calcTotalPosition(marginAmount, leverageBps);
        uint256 flashLoanAmount = _convertUsingOracle(debtAsset, collateralAsset, totalPositionInDebt);
        // Reduce flash loan to account for premium (~5 bps).
        // We repay flashLoanAmount*(1+premiumRate) in WETH, funded by swapping totalUsdc.
        // Without reduction, totalUsdc exactly equals flashLoanAmount worth — no room for premium.
        flashLoanAmount = (flashLoanAmount * 10000) / 10009;

        positionId = positionCount++;

        bytes memory params = abi.encode(FlashParams({
            action: ActionType.OPEN_LONG,
            user: msg.sender,
            collateralAsset: collateralAsset,
            debtAsset: debtAsset,
            marginAmount: marginAmount,
            leverageBps: leverageBps,
            minAmountOut: minCollateralOut,
            positionId: positionId
        }));

        // Flash loan the COLLATERAL asset (WETH) — has more liquidity
        POOL.flashLoanSimple(address(this), collateralAsset, flashLoanAmount, params, REFERRAL_CODE);
    }

    // ============================================================
    //                       CLOSE LONG
    // ============================================================
    /// @dev Flash loan WETH, swap part to USDC, repay debt, withdraw collateral, repay flash loan

    function closeLong(uint256 positionId) external override {
        Position storage pos = positions[positionId];
        require(pos.isActive, "PM: not active");
        require(pos.owner == msg.sender, "PM: not owner");
        require(pos.positionType == PositionType.LONG, "PM: not long");

        // Flash loan enough WETH to cover: this position's debt (converted to WETH) + buffer
        uint256 positionDebt = _getPositionDebt(pos.debtAsset, pos.debtAmount);
        uint256 wethNeeded = _convertUsingOracle(pos.debtAsset, pos.collateralAsset, positionDebt);
        // Add 1% buffer for swap slippage and flash loan premium
        wethNeeded = (wethNeeded * 101) / 100;

        bytes memory params = abi.encode(FlashParams({
            action: ActionType.CLOSE_LONG,
            user: msg.sender,
            collateralAsset: pos.collateralAsset,
            debtAsset: pos.debtAsset,
            marginAmount: pos.marginAmount,
            leverageBps: pos.leverageBps,
            minAmountOut: 0,
            positionId: positionId
        }));

        POOL.flashLoanSimple(address(this), pos.collateralAsset, wethNeeded, params, REFERRAL_CODE);
    }

    // ============================================================
    //                       OPEN SHORT
    // ============================================================
    /// @dev User provides margin in USDC. Flash loan WETH.
    ///      1. Flash loan WETH
    ///      2. Swap WETH → USDC
    ///      3. Deposit USDC as collateral
    ///      4. Borrow WETH from Aave
    ///      5. Repay flash loan with borrowed WETH

    function openShort(
        address collateralAsset, // USDC
        address debtAsset,       // WETH
        uint256 marginAmount,
        uint256 leverageBps,
        uint256 minCollateralOut
    ) external override returns (uint256 positionId) {
        require(marginAmount > 0, "PM: zero margin");
        require(leverageBps > 10000 && leverageBps <= 50000, "PM: invalid leverage");

        IERC20(collateralAsset).safeTransferFrom(msg.sender, address(this), marginAmount);

        // Flash loan only the BORROW amount worth of WETH (not total position).
        // After swapping to USDC + adding margin → deposit as collateral → borrow WETH to repay flash.
        uint256 totalPositionInCollateral = PositionLib.calcTotalPosition(marginAmount, leverageBps);
        uint256 borrowInCollateral = PositionLib.calcBorrowAmount(totalPositionInCollateral, marginAmount);
        uint256 flashLoanAmount = _convertUsingOracle(collateralAsset, debtAsset, borrowInCollateral);
        // Reduce for flash loan premium
        flashLoanAmount = (flashLoanAmount * 10000) / 10009;

        positionId = positionCount++;

        bytes memory params = abi.encode(FlashParams({
            action: ActionType.OPEN_SHORT,
            user: msg.sender,
            collateralAsset: collateralAsset,
            debtAsset: debtAsset,
            marginAmount: marginAmount,
            leverageBps: leverageBps,
            minAmountOut: minCollateralOut,
            positionId: positionId
        }));

        // Flash loan WETH (debtAsset for short)
        POOL.flashLoanSimple(address(this), debtAsset, flashLoanAmount, params, REFERRAL_CODE);
    }

    // ============================================================
    //                       CLOSE SHORT
    // ============================================================
    /// @dev Flash loan WETH, repay WETH debt, withdraw USDC, swap USDC→WETH, repay flash

    function closeShort(uint256 positionId) external override {
        Position storage pos = positions[positionId];
        require(pos.isActive, "PM: not active");
        require(pos.owner == msg.sender, "PM: not owner");
        require(pos.positionType == PositionType.SHORT, "PM: not short");

        uint256 positionDebt = _getPositionDebt(pos.debtAsset, pos.debtAmount);
        // Add 1% buffer
        uint256 flashAmount = (positionDebt * 101) / 100;

        bytes memory params = abi.encode(FlashParams({
            action: ActionType.CLOSE_SHORT,
            user: msg.sender,
            collateralAsset: pos.collateralAsset,
            debtAsset: pos.debtAsset,
            marginAmount: pos.marginAmount,
            leverageBps: pos.leverageBps,
            minAmountOut: 0,
            positionId: positionId
        }));

        POOL.flashLoanSimple(address(this), pos.debtAsset, flashAmount, params, REFERRAL_CODE);
    }

    // ============================================================
    //                    FLASH LOAN CALLBACK
    // ============================================================

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "PM: caller must be Pool");
        require(initiator == address(this), "PM: invalid initiator");

        FlashParams memory fp = abi.decode(params, (FlashParams));

        if (fp.action == ActionType.OPEN_LONG) {
            _executeOpenLong(amount, premium, fp);
        } else if (fp.action == ActionType.CLOSE_LONG) {
            _executeCloseLong(amount, premium, fp);
        } else if (fp.action == ActionType.OPEN_SHORT) {
            _executeOpenShort(amount, premium, fp);
        } else if (fp.action == ActionType.CLOSE_SHORT) {
            _executeCloseShort(amount, premium, fp);
        }

        // Approve Pool to pull back flash loan + premium
        IERC20(asset).approve(address(POOL), amount + premium);
        return true;
    }

    // ============================================================
    //                    INTERNAL: OPEN LONG
    // ============================================================
    /// Flash loaned WETH. Deposit → borrow USDC → swap USDC+margin→WETH → repay flash
    function _executeOpenLong(uint256 wethAmount, uint256 premium, FlashParams memory fp) internal {
        // Step 1: Deposit all WETH as collateral in Aave
        IERC20(fp.collateralAsset).approve(address(POOL), wethAmount);
        POOL.supply(fp.collateralAsset, wethAmount, address(this), REFERRAL_CODE);

        // Step 2: Borrow USDC from Aave
        // borrowAmount = totalPosition - margin (in USDC)
        uint256 totalPositionInDebt = PositionLib.calcTotalPosition(fp.marginAmount, fp.leverageBps);
        uint256 borrowAmount = PositionLib.calcBorrowAmount(totalPositionInDebt, fp.marginAmount);
        POOL.borrow(fp.debtAsset, borrowAmount, VARIABLE_RATE_MODE, REFERRAL_CODE, address(this));

        // Step 3: Swap ALL (borrowedUSDC + userMargin) → WETH to repay flash loan
        uint256 totalUsdc = borrowAmount + fp.marginAmount;
        uint256 wethNeeded = wethAmount + premium;

        IERC20(fp.debtAsset).approve(address(swapRouter), totalUsdc);
        swapRouter.swapExactInput(
            fp.debtAsset,       // pay with USDC
            fp.collateralAsset, // receive WETH
            totalUsdc,          // spend ALL USDC
            wethNeeded,         // minimum: must cover flash repayment
            address(this)
        );

        // Entry price from swap: totalUSDC / WETH deposited
        uint256 entryPrice = (totalPositionInDebt * 1e18) / wethAmount;

        _storePosition(fp, PositionType.LONG, wethAmount, borrowAmount, entryPrice);
    }

    // ============================================================
    //                    INTERNAL: CLOSE LONG
    // ============================================================
    /// Flash loaned WETH. Swap WETH→USDC → repay debt → withdraw WETH → repay flash
    function _executeCloseLong(uint256 wethFlashed, uint256 premium, FlashParams memory fp) internal {
        Position storage pos = positions[fp.positionId];

        // Step 1: Get this position's proportional share of USDC debt
        uint256 currentDebt = _getPositionDebt(fp.debtAsset, pos.debtAmount);

        // Step 2: Swap enough WETH → USDC to cover the debt
        IERC20(fp.collateralAsset).approve(address(swapRouter), wethFlashed);
        uint256 wethSpent = swapRouter.swapExactOutput(
            fp.collateralAsset, // pay with WETH
            fp.debtAsset,       // receive USDC
            currentDebt,        // need exactly this much USDC
            wethFlashed,        // max WETH to spend
            address(this)
        );

        // Step 3: Repay USDC debt to Aave
        IERC20(fp.debtAsset).approve(address(POOL), currentDebt);
        POOL.repay(fp.debtAsset, currentDebt, VARIABLE_RATE_MODE, address(this));

        // Step 4: Withdraw this position's WETH collateral from Aave
        uint256 withdrawnWeth = POOL.withdraw(fp.collateralAsset, pos.collateralAmount, address(this));

        _totalBorrowed[fp.debtAsset] -= pos.debtAmount;

        // Step 5: Repay flash loan (wethFlashed + premium) from withdrawn WETH + remaining flashed WETH
        // Total WETH we have: withdrawnWeth + (wethFlashed - wethSpent)
        uint256 totalWeth = withdrawnWeth + (wethFlashed - wethSpent);
        uint256 flashRepay = wethFlashed + premium;

        // Step 6: Send remainder to user (convert to USDC for consistency)
        uint256 remainderWeth = totalWeth - flashRepay;
        uint256 remainderUsdc = 0;
        if (remainderWeth > 0) {
            // Swap remaining WETH → USDC and send to user
            IERC20(fp.collateralAsset).approve(address(swapRouter), remainderWeth);
            remainderUsdc = swapRouter.swapExactInput(
                fp.collateralAsset, fp.debtAsset, remainderWeth, 0, fp.user
            );
        }

        int256 pnl = int256(remainderUsdc) - int256(fp.marginAmount);
        positions[fp.positionId].isActive = false;

        emit PositionClosed(fp.positionId, fp.user, PositionType.LONG, pnl, remainderUsdc);
    }

    // ============================================================
    //                    INTERNAL: OPEN SHORT
    // ============================================================
    /// Flash loaned WETH. Swap WETH→USDC → deposit USDC → borrow WETH → repay flash
    function _executeOpenShort(uint256 wethFlashed, uint256 premium, FlashParams memory fp) internal {
        // Step 1: Swap all flash-loaned WETH → USDC
        IERC20(fp.debtAsset).approve(address(swapRouter), wethFlashed);
        uint256 usdcReceived = swapRouter.swapExactInput(
            fp.debtAsset,         // WETH
            fp.collateralAsset,   // USDC
            wethFlashed,
            0,
            address(this)
        );

        // Step 2: Deposit USDC (from swap + margin) as collateral
        uint256 totalCollateral = usdcReceived + fp.marginAmount;
        IERC20(fp.collateralAsset).approve(address(POOL), totalCollateral);
        POOL.supply(fp.collateralAsset, totalCollateral, address(this), REFERRAL_CODE);

        // Step 3: Borrow WETH from Aave to repay flash loan
        uint256 wethToBorrow = wethFlashed + premium;
        POOL.borrow(fp.debtAsset, wethToBorrow, VARIABLE_RATE_MODE, REFERRAL_CODE, address(this));

        // Entry price
        uint256 entryPrice = (usdcReceived * 1e18) / wethFlashed;

        _storePosition(fp, PositionType.SHORT, totalCollateral, wethToBorrow, entryPrice);
    }

    // ============================================================
    //                    INTERNAL: CLOSE SHORT
    // ============================================================
    /// Flash loaned WETH. Repay WETH debt → withdraw USDC → swap USDC→WETH → repay flash
    function _executeCloseShort(uint256 wethFlashed, uint256 premium, FlashParams memory fp) internal {
        Position storage pos = positions[fp.positionId];

        // Step 1: Repay this position's WETH debt
        uint256 currentDebt = _getPositionDebt(fp.debtAsset, pos.debtAmount);
        IERC20(fp.debtAsset).approve(address(POOL), currentDebt);
        POOL.repay(fp.debtAsset, currentDebt, VARIABLE_RATE_MODE, address(this));

        // Step 2: Withdraw this position's USDC collateral
        uint256 withdrawnUsdc = POOL.withdraw(fp.collateralAsset, pos.collateralAmount, address(this));

        _totalBorrowed[fp.debtAsset] -= pos.debtAmount;

        // Step 3: Swap enough USDC → WETH to repay flash loan
        uint256 flashRepay = wethFlashed + premium;
        uint256 wethAlready = wethFlashed - currentDebt;
        uint256 wethStillNeeded = flashRepay - wethAlready;

        IERC20(fp.collateralAsset).approve(address(swapRouter), withdrawnUsdc);
        uint256 usdcSpent = swapRouter.swapExactOutput(
            fp.collateralAsset, fp.debtAsset, wethStillNeeded, withdrawnUsdc, address(this)
        );

        // Step 4: Send remaining USDC to user
        uint256 remainingUsdc = withdrawnUsdc - usdcSpent;
        if (remainingUsdc > 0) {
            IERC20(fp.collateralAsset).safeTransfer(fp.user, remainingUsdc);
        }

        int256 pnl = int256(remainingUsdc) - int256(fp.marginAmount);
        positions[fp.positionId].isActive = false;

        emit PositionClosed(fp.positionId, fp.user, PositionType.SHORT, pnl, remainingUsdc);
    }

    // ============================================================
    //                    INTERNAL HELPERS
    // ============================================================

    function _storePosition(
        FlashParams memory fp,
        PositionType posType,
        uint256 collateralAmount,
        uint256 debtAmount,
        uint256 entryPrice
    ) internal {
        positions[fp.positionId] = Position({
            owner: fp.user,
            positionType: posType,
            collateralAsset: fp.collateralAsset,
            debtAsset: fp.debtAsset,
            collateralAmount: collateralAmount,
            debtAmount: debtAmount,
            entryPrice: entryPrice,
            leverageBps: fp.leverageBps,
            marginAmount: fp.marginAmount,
            openTimestamp: block.timestamp,
            isActive: true
        });
        _userPositionIds[fp.user].push(fp.positionId);
        _totalBorrowed[fp.debtAsset] += debtAmount;

        emit PositionOpened(
            fp.positionId, fp.user, posType,
            fp.collateralAsset, fp.debtAsset,
            collateralAmount, debtAmount,
            fp.leverageBps, entryPrice
        );
    }

    function _convertUsingOracle(
        address fromAsset,
        address toAsset,
        uint256 fromAmount
    ) internal view returns (uint256 toAmount) {
        address oracle = ADDRESSES_PROVIDER.getPriceOracle();
        uint256 fromPrice = IAaveOracle(oracle).getAssetPrice(fromAsset);
        uint256 toPrice = IAaveOracle(oracle).getAssetPrice(toAsset);

        uint8 fromDec = IERC20Metadata(fromAsset).decimals();
        uint8 toDec = IERC20Metadata(toAsset).decimals();

        toAmount = (fromAmount * fromPrice * (10 ** toDec)) / (toPrice * (10 ** fromDec));
    }

    function _getVariableDebt(address asset) internal view returns (uint256) {
        DataTypes.ReserveData memory data = POOL.getReserveData(asset);
        return IERC20(data.variableDebtTokenAddress).balanceOf(address(this));
    }

    /// @dev Calculate a single position's proportional share of accrued debt
    function _getPositionDebt(address debtAsset, uint256 initialDebt) internal view returns (uint256) {
        uint256 totalInitial = _totalBorrowed[debtAsset];
        if (totalInitial == 0) return initialDebt;
        uint256 totalCurrent = _getVariableDebt(debtAsset);
        return (initialDebt * totalCurrent) / totalInitial;
    }

    // ============================================================
    //                    VIEW FUNCTIONS
    // ============================================================

    function getPosition(uint256 positionId) external view override returns (Position memory) {
        return positions[positionId];
    }

    function getUserPositions(address user) external view override returns (uint256[] memory) {
        return _userPositionIds[user];
    }
}
