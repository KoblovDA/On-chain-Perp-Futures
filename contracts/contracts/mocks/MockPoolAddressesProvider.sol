// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockPoolAddressesProvider
/// @notice Mock for Aave's IPoolAddressesProvider
contract MockPoolAddressesProvider {
    address public pool;
    address public priceOracle;

    function setPool(address _pool) external {
        pool = _pool;
    }

    function setPriceOracle(address _oracle) external {
        priceOracle = _oracle;
    }

    function getPool() external view returns (address) {
        return pool;
    }

    function getPriceOracle() external view returns (address) {
        return priceOracle;
    }

    // Required by IPoolAddressesProvider interface
    function getMarketId() external pure returns (string memory) { return "mock"; }
    function getAddress(bytes32) external pure returns (address) { return address(0); }
    function setMarketId(string calldata) external {}
    function setAddress(bytes32, address) external {}
    function setAddressAsProxy(bytes32, address) external {}
    function getACLManager() external pure returns (address) { return address(0); }
    function setACLManager(address) external {}
    function getACLAdmin() external pure returns (address) { return address(0); }
    function setACLAdmin(address) external {}
    function getPoolConfigurator() external pure returns (address) { return address(0); }
    function setPoolConfiguratorImpl(address) external {}
    function setPoolImpl(address) external {}
    function getPriceOracleSentinel() external pure returns (address) { return address(0); }
    function setPriceOracleSentinel(address) external {}
    function getPoolDataProvider() external pure returns (address) { return address(0); }
    function setPoolDataProvider(address) external {}
}
