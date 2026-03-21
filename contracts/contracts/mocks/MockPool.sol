// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DataTypes} from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import {MockERC20} from "./MockERC20.sol";

/// @title MockPool
/// @notice Simplified mock of Aave V3 Pool for testing PositionManager
contract MockPool {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => uint256)) public supplied;
    mapping(address => mapping(address => uint256)) public borrowed;

    mapping(address => address) public aTokens;
    mapping(address => address) public variableDebtTokens;

    uint256 public constant FLASH_LOAN_PREMIUM = 5; // 0.05%

    /// @dev Create mock aToken and debtToken for an asset
    function initReserve(address asset) external {
        uint8 dec = MockERC20(asset).decimals();
        MockERC20 aToken = new MockERC20("aToken", "aTKN", dec);
        MockERC20 debtToken = new MockERC20("debtToken", "dTKN", dec);
        aTokens[asset] = address(aToken);
        variableDebtTokens[asset] = address(debtToken);
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        supplied[onBehalfOf][asset] += amount;
    }

    function borrow(address asset, uint256 amount, uint256, uint16, address onBehalfOf) external {
        require(IERC20(asset).balanceOf(address(this)) >= amount, "MockPool: no liquidity");
        borrowed[onBehalfOf][asset] += amount;
        // Mint debt tokens so _getVariableDebt works
        MockERC20(variableDebtTokens[asset]).mint(onBehalfOf, amount);
        IERC20(asset).safeTransfer(msg.sender, amount);
    }

    function repay(address asset, uint256 amount, uint256, address onBehalfOf) external returns (uint256) {
        uint256 debt = borrowed[onBehalfOf][asset];
        uint256 repayAmount = amount > debt ? debt : amount;

        IERC20(asset).safeTransferFrom(msg.sender, address(this), repayAmount);
        borrowed[onBehalfOf][asset] -= repayAmount;
        // Burn debt tokens so _getVariableDebt reflects repayment
        MockERC20(variableDebtTokens[asset]).burn(onBehalfOf, repayAmount);
        return repayAmount;
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        uint256 userSupply = supplied[msg.sender][asset];
        uint256 withdrawAmount = amount == type(uint256).max ? userSupply : amount;
        require(withdrawAmount <= userSupply, "MockPool: insufficient supply");

        supplied[msg.sender][asset] -= withdrawAmount;
        IERC20(asset).safeTransfer(to, withdrawAmount);
        return withdrawAmount;
    }

    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16
    ) external {
        uint256 premium = (amount * FLASH_LOAN_PREMIUM) / 10000;

        IERC20(asset).safeTransfer(receiverAddress, amount);

        // initiator = msg.sender (the contract that called flashLoanSimple)
        IFlashLoanReceiver(receiverAddress).executeOperation(
            asset, amount, premium, msg.sender, params
        );

        IERC20(asset).safeTransferFrom(receiverAddress, address(this), amount + premium);
    }

    function getReserveData(address asset) external view returns (DataTypes.ReserveData memory data) {
        data.aTokenAddress = aTokens[asset];
        data.variableDebtTokenAddress = variableDebtTokens[asset];
        return data;
    }
}

interface IFlashLoanReceiver {
    function executeOperation(
        address asset, uint256 amount, uint256 premium,
        address initiator, bytes calldata params
    ) external returns (bool);
}
