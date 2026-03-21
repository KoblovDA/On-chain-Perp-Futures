// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPositionManager
/// @notice Interface for the leveraged position manager using Aave V3 flash loans
interface IPositionManager {
    enum PositionType {
        LONG,
        SHORT
    }

    struct Position {
        address owner;
        PositionType positionType;
        address collateralAsset; // WETH for long, USDC for short
        address debtAsset; // USDC for long, WETH for short
        uint256 collateralAmount; // Amount deposited as collateral in Aave
        uint256 debtAmount; // Amount borrowed from Aave at opening
        uint256 entryPrice; // Price of risky asset at position open (18 decimals)
        uint256 leverageBps; // Leverage in basis points (e.g., 40000 = 4x)
        uint256 marginAmount; // User's initial capital
        uint256 openTimestamp; // Block timestamp when position was opened
        bool isActive; // Whether position is still open
    }

    event PositionOpened(
        uint256 indexed positionId,
        address indexed owner,
        PositionType positionType,
        address collateralAsset,
        address debtAsset,
        uint256 collateralAmount,
        uint256 debtAmount,
        uint256 leverageBps,
        uint256 entryPrice
    );

    event PositionClosed(
        uint256 indexed positionId,
        address indexed owner,
        PositionType positionType,
        int256 pnl,
        uint256 returnedAmount
    );

    /// @notice Open a leveraged long position
    /// @param collateralAsset The risky asset to go long on (e.g., WETH)
    /// @param debtAsset The stablecoin to borrow (e.g., USDC)
    /// @param marginAmount User's initial capital in debtAsset (e.g., USDC amount)
    /// @param leverageBps Desired leverage in basis points (e.g., 20000 = 2x, 40000 = 4x)
    /// @param minCollateralOut Minimum collateral received from swap (slippage protection)
    /// @return positionId The ID of the newly created position
    function openLong(
        address collateralAsset,
        address debtAsset,
        uint256 marginAmount,
        uint256 leverageBps,
        uint256 minCollateralOut
    ) external returns (uint256 positionId);

    /// @notice Open a leveraged short position
    /// @param collateralAsset The stablecoin used as collateral (e.g., USDC)
    /// @param debtAsset The risky asset to short (e.g., WETH)
    /// @param marginAmount User's initial capital in collateralAsset (e.g., USDC amount)
    /// @param leverageBps Desired leverage in basis points
    /// @param minCollateralOut Minimum collateral received from swap (slippage protection)
    /// @return positionId The ID of the newly created position
    function openShort(
        address collateralAsset,
        address debtAsset,
        uint256 marginAmount,
        uint256 leverageBps,
        uint256 minCollateralOut
    ) external returns (uint256 positionId);

    /// @notice Close a long position
    /// @param positionId The ID of the position to close
    function closeLong(uint256 positionId) external;

    /// @notice Close a short position
    /// @param positionId The ID of the position to close
    function closeShort(uint256 positionId) external;

    /// @notice Get position details
    function getPosition(uint256 positionId) external view returns (Position memory);

    /// @notice Get all position IDs for a user
    function getUserPositions(address user) external view returns (uint256[] memory);

    /// @notice Get the number of total positions
    function positionCount() external view returns (uint256);
}
