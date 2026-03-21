// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockSwapRouter
/// @notice A mock DEX router with configurable exchange rates for testnet use.
///         Aave testnet tokens don't have Uniswap liquidity, so we use this mock.
///         The contract must be pre-funded with tokens to execute swaps.
contract MockSwapRouter is ISwapRouter, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Exchange rate from tokenA to tokenB, stored as:
    ///         rate = how many units of tokenB you get per 1e18 units of tokenA
    ///         Example: WETH→USDC at $2000: rate = 2000e6 (USDC has 6 decimals)
    ///         But we normalize: rate is in 18 decimals regardless.
    ///         rate[WETH][USDC] = 2000 * 1e18 means 1 WETH = 2000 USDC
    mapping(address => mapping(address => uint256)) public rates;

    /// @notice Token decimals cache
    mapping(address => uint8) public tokenDecimals;

    event RateSet(address indexed tokenIn, address indexed tokenOut, uint256 rate);
    event Swapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor() Ownable(msg.sender) {}

    /// @notice Set the exchange rate from tokenIn to tokenOut
    /// @param tokenIn Input token address
    /// @param tokenOut Output token address
    /// @param rate Price of 1 tokenIn in tokenOut units, scaled to 18 decimals
    ///             Example: 1 WETH = 2000 USDC → rate = 2000e18
    /// @param decimalsIn Decimals of tokenIn (e.g., 18 for WETH)
    /// @param decimalsOut Decimals of tokenOut (e.g., 6 for USDC)
    function setRate(
        address tokenIn,
        address tokenOut,
        uint256 rate,
        uint8 decimalsIn,
        uint8 decimalsOut
    ) external onlyOwner {
        rates[tokenIn][tokenOut] = rate;
        tokenDecimals[tokenIn] = decimalsIn;
        tokenDecimals[tokenOut] = decimalsOut;
        emit RateSet(tokenIn, tokenOut, rate);
    }

    /// @notice Calculate output amount for a given input
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param amountIn Amount of input token (in tokenIn's native decimals)
    /// @return amountOut Amount of output token (in tokenOut's native decimals)
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        uint256 rate = rates[tokenIn][tokenOut];
        require(rate > 0, "MockSwapRouter: rate not set");

        uint8 decIn = tokenDecimals[tokenIn];
        uint8 decOut = tokenDecimals[tokenOut];

        // amountOut = amountIn * rate / 1e18, adjusted for decimal difference
        // rate is in 18 decimals: "how many tokenOut per 1 tokenIn"
        // amountIn is in decIn decimals
        // We want amountOut in decOut decimals
        amountOut = (amountIn * rate) / (10 ** 18);

        // Adjust for decimal difference between tokens
        if (decIn > decOut) {
            amountOut = amountOut / (10 ** (decIn - decOut));
        } else if (decOut > decIn) {
            amountOut = amountOut * (10 ** (decOut - decIn));
        }
    }

    /// @notice Calculate input amount needed for a given output
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param amountOut Desired amount of output token
    /// @return amountIn Required amount of input token
    function getAmountIn(
        address tokenIn,
        address tokenOut,
        uint256 amountOut
    ) public view returns (uint256 amountIn) {
        uint256 rate = rates[tokenIn][tokenOut];
        require(rate > 0, "MockSwapRouter: rate not set");

        uint8 decIn = tokenDecimals[tokenIn];
        uint8 decOut = tokenDecimals[tokenOut];

        // Reverse of getAmountOut
        uint256 adjustedAmountOut = amountOut;
        if (decIn > decOut) {
            adjustedAmountOut = adjustedAmountOut * (10 ** (decIn - decOut));
        } else if (decOut > decIn) {
            adjustedAmountOut = adjustedAmountOut / (10 ** (decOut - decIn));
        }

        amountIn = (adjustedAmountOut * (10 ** 18)) / rate;
        // Round up to ensure enough input
        if ((adjustedAmountOut * (10 ** 18)) % rate != 0) {
            amountIn += 1;
        }
    }

    /// @inheritdoc ISwapRouter
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient
    ) external override returns (uint256 amountOut) {
        amountOut = getAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut >= amountOutMinimum, "MockSwapRouter: insufficient output");
        require(
            IERC20(tokenOut).balanceOf(address(this)) >= amountOut,
            "MockSwapRouter: insufficient liquidity"
        );

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        emit Swapped(tokenIn, tokenOut, amountIn, amountOut);
    }

    /// @inheritdoc ISwapRouter
    function swapExactOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 amountInMaximum,
        address recipient
    ) external override returns (uint256 amountIn) {
        amountIn = getAmountIn(tokenIn, tokenOut, amountOut);
        require(amountIn <= amountInMaximum, "MockSwapRouter: excessive input");
        require(
            IERC20(tokenOut).balanceOf(address(this)) >= amountOut,
            "MockSwapRouter: insufficient liquidity"
        );

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        emit Swapped(tokenIn, tokenOut, amountIn, amountOut);
    }

    /// @notice Withdraw tokens from the router (owner only)
    function withdrawToken(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
