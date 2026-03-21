// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PositionLib
/// @notice Math library for leveraged position calculations
/// @dev Leverage is expressed in basis points: 40000 = 4x, 20000 = 2x, etc.
library PositionLib {
    uint256 constant BPS = 10_000;

    /// @notice Calculate the total position value from margin and leverage
    /// @param marginAmount User's initial capital (margin)
    /// @param leverageBps Leverage in basis points (e.g., 40000 = 4x)
    /// @return totalPosition Total position value = margin * leverage
    function calcTotalPosition(
        uint256 marginAmount,
        uint256 leverageBps
    ) internal pure returns (uint256 totalPosition) {
        totalPosition = (marginAmount * leverageBps) / BPS;
    }

    /// @notice Calculate the borrow amount (debt) from total position value
    /// @dev borrowAmount = totalPosition * (L-1)/L = totalPosition - margin
    ///      This equals θ⁰ * totalPosition from the paper
    /// @param totalPosition Total position value
    /// @param marginAmount User's initial capital
    /// @return borrowAmount Amount to borrow from Aave
    function calcBorrowAmount(
        uint256 totalPosition,
        uint256 marginAmount
    ) internal pure returns (uint256 borrowAmount) {
        require(totalPosition > marginAmount, "PositionLib: invalid leverage");
        borrowAmount = totalPosition - marginAmount;
    }

    /// @notice Calculate the initial LTV (θ⁰) in basis points
    /// @dev θ⁰ = (L-1)/L = 1 - 1/L
    /// @param leverageBps Leverage in basis points
    /// @return ltvBps Initial LTV in basis points
    function calcInitialLTV(
        uint256 leverageBps
    ) internal pure returns (uint256 ltvBps) {
        require(leverageBps > BPS, "PositionLib: leverage must be > 1x");
        ltvBps = BPS - (BPS * BPS) / leverageBps;
    }

    /// @notice Calculate PnL for a position
    /// @dev PnL = currentCollateralValue - currentDebtValue - initialMargin
    ///      This is a simplified version of the paper's Eq. 2 for on-chain use
    /// @param currentCollateralValue Current value of deposited collateral
    /// @param currentDebtValue Current debt (includes accrued interest)
    /// @param initialMargin User's initial capital
    /// @return pnl Profit or loss (can be negative)
    function calcPnL(
        uint256 currentCollateralValue,
        uint256 currentDebtValue,
        uint256 initialMargin
    ) internal pure returns (int256 pnl) {
        pnl = int256(currentCollateralValue) - int256(currentDebtValue) - int256(initialMargin);
    }

    /// @notice Calculate the liquidation price for a long position
    /// @dev Position is liquidated when healthFactor < 1, i.e., when:
    ///      collateralValue * liquidationThreshold <= debtValue
    ///      So: liqPrice = debtValue / (collateralAmount * liqThreshold)
    /// @param debtValue Current debt in stablecoin
    /// @param collateralAmount Amount of risky asset deposited
    /// @param liquidationThresholdBps Aave's liquidation threshold in BPS (e.g., 8500 = 85%)
    /// @return liqPrice Price at which the position gets liquidated (18 decimals)
    function calcLiquidationPrice(
        uint256 debtValue,
        uint256 collateralAmount,
        uint256 liquidationThresholdBps
    ) internal pure returns (uint256 liqPrice) {
        require(collateralAmount > 0, "PositionLib: zero collateral");
        require(liquidationThresholdBps > 0, "PositionLib: zero threshold");
        // liqPrice = debtValue * BPS / (collateralAmount * liquidationThresholdBps)
        // Scale to 18 decimals
        liqPrice = (debtValue * BPS * 1e18) / (collateralAmount * liquidationThresholdBps);
    }
}
