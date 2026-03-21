// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockOracle
/// @notice Mock Aave price oracle with configurable prices
contract MockOracle {
    // asset => price in USD with 8 decimals (Aave standard)
    mapping(address => uint256) public prices;

    function setAssetPrice(address asset, uint256 price) external {
        prices[asset] = price;
    }

    function getAssetPrice(address asset) external view returns (uint256) {
        require(prices[asset] > 0, "MockOracle: price not set");
        return prices[asset];
    }
}
