// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISwapRouter
/// @notice Interface for DEX swap operations (abstraction over Uniswap or Mock)
interface ISwapRouter {
    /// @notice Swap exact amount of tokenIn for tokenOut
    /// @param tokenIn Address of input token
    /// @param tokenOut Address of output token
    /// @param amountIn Exact amount of tokenIn to swap
    /// @param amountOutMinimum Minimum acceptable output (slippage protection)
    /// @param recipient Address to receive output tokens
    /// @return amountOut Actual amount of tokenOut received
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient
    ) external returns (uint256 amountOut);

    /// @notice Swap tokenIn for exact amount of tokenOut
    /// @param tokenIn Address of input token
    /// @param tokenOut Address of output token
    /// @param amountOut Exact amount of tokenOut desired
    /// @param amountInMaximum Maximum acceptable input (slippage protection)
    /// @param recipient Address to receive output tokens
    /// @return amountIn Actual amount of tokenIn spent
    function swapExactOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 amountInMaximum,
        address recipient
    ) external returns (uint256 amountIn);
}
