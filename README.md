# On-Chain Leveraged Trading via Aave V3 Flash Loans

A decentralized application for opening and closing leveraged long/short positions on crypto assets using **Aave V3 Flash Loans** on Ethereum Sepolia testnet.

Based on the paper: **"Leveraged Trading via Lending Platforms"** by Szpruch, Xu, Sabaté-Vidales, and Aouane (2024).

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
  - [Core Idea](#core-idea)
  - [Leveraged Long — Step by Step](#leveraged-long--step-by-step)
  - [Leveraged Short — Step by Step](#leveraged-short--step-by-step)
  - [Numerical Example](#numerical-example)
- [Architecture](#architecture)
  - [Smart Contracts](#smart-contracts)
  - [Frontend](#frontend)
- [Deployed Contracts (Sepolia)](#deployed-contracts-sepolia)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Key Concepts from the Paper](#key-concepts-from-the-paper)

---

## Overview

Traditional leveraged trading requires centralized exchanges or perpetual futures platforms. This project demonstrates an **on-chain alternative**: using DeFi lending protocols (Aave V3) and flash loans to construct leveraged positions entirely on-chain.

The user only provides **margin** (a fraction of the total position value). The rest is handled atomically within a single transaction using a flash loan — no counterparty risk, no funding rates, fully self-custodial.

**Supported pair:** WETH/USDC
**Network:** Ethereum Sepolia Testnet
**Leverage range:** 1.5x — 4x

---

## How It Works

### Core Idea

Lending protocols like Aave allow users to **deposit collateral** and **borrow** against it. By combining this with flash loans, we can enter a fully leveraged position in a single transaction:

```
                    ┌──────────────────────────────────────┐
User provides       │         Single Transaction           │
margin (USDC)  ───► │  Flash Loan → Deposit → Borrow →    │ ───► Leveraged Position
                    │  Swap → Repay Flash Loan             │      in Aave
                    └──────────────────────────────────────┘
```

**Leverage formula:** `L = 1 / (1 - θ₀)`, where `θ₀` is the initial Loan-to-Value (LTV).

| LTV (θ₀) | Leverage |
|-----------|----------|
| 0.50      | 2x       |
| 0.667     | 3x       |
| 0.75      | 4x       |

### Leveraged Long — Step by Step

A long position profits when WETH price goes **up** relative to USDC.

**Opening a Long (flash loan in WETH):**

```
User has: margin M in USDC
Goal: deposit WETH collateral, borrow USDC debt

1. Flash loan X WETH from Aave Pool
   └─ X ≈ (M × leverage) / WETH_price, reduced by ~0.05% for flash premium

2. Deposit all X WETH as collateral in Aave
   └─ Now the contract has WETH collateral earning supply interest

3. Borrow B USDC from Aave against the collateral
   └─ B = totalPosition - margin = M × (leverage - 1)

4. Swap all available USDC (B + M) → WETH
   └─ This gives enough WETH to repay the flash loan + premium

5. Repay flash loan: X + premium WETH back to Aave Pool

Result: Position stored on-chain with:
  - Collateral: X WETH in Aave
  - Debt: B USDC owed to Aave
  - The user's margin is "locked" as the difference
```

**Closing a Long:**

```
1. Flash loan WETH from Aave Pool (enough to cover debt conversion + buffer)

2. Swap part of WETH → USDC (enough to repay the USDC debt)

3. Repay USDC debt to Aave

4. Withdraw all WETH collateral from Aave

5. Repay flash loan from withdrawn WETH

6. Swap remaining WETH → USDC and send to user

PnL = returned USDC - original margin
```

### Leveraged Short — Step by Step

A short position profits when WETH price goes **down** relative to USDC.

**Opening a Short (flash loan in WETH):**

```
User has: margin M in USDC
Goal: deposit USDC collateral, borrow WETH debt

1. Flash loan X WETH from Aave Pool
   └─ X ≈ borrowAmount / WETH_price (not totalPosition)

2. Swap all X WETH → USDC via DEX
   └─ Receives ~X × WETH_price USDC

3. Deposit (swapped USDC + user margin M) as collateral in Aave

4. Borrow (X + premium) WETH from Aave against USDC collateral

5. Repay flash loan with borrowed WETH

Result: Position stored on-chain with:
  - Collateral: USDC in Aave
  - Debt: WETH owed to Aave
  - If WETH price drops, debt value decreases → profit on close
```

**Closing a Short:**

```
1. Flash loan WETH (slightly more than current debt)

2. Repay WETH debt to Aave

3. Withdraw all USDC collateral from Aave

4. Swap enough USDC → WETH to repay flash loan

5. Send remaining USDC to user

PnL = returned USDC - original margin
```

### Numerical Example

**Opening a 2x Long with 1000 USDC margin (WETH = $2000):**

| Step | Action | Amount |
|------|--------|--------|
| 1 | Flash loan WETH | ~0.999 WETH (reduced for 0.05% premium) |
| 2 | Deposit WETH in Aave | 0.999 WETH as collateral |
| 3 | Borrow USDC from Aave | 1000 USDC (= 2000 - 1000) |
| 4 | Swap 2000 USDC → WETH | ~1.0 WETH (covers flash + premium) |
| 5 | Repay flash loan | 0.999 + 0.0005 = ~1.0 WETH |

**Position result:**
- Collateral: ~0.999 WETH (~$1998) deposited in Aave
- Debt: 1000 USDC borrowed from Aave
- Net exposure: ~$998 in WETH (≈ 2x the margin)

**If WETH goes to $2200 (+10%) and user closes:**
- Collateral worth: 0.999 × $2200 = $2198
- Debt: 1000 USDC (unchanged)
- Net: $2198 - $1000 = $1198 returned to user
- **PnL: +$198 on $1000 margin = +19.8% return** (≈ 2x the 10% price move)

**If WETH drops to $1800 (-10%):**
- Collateral worth: 0.999 × $1800 = $1798
- Debt: 1000 USDC
- Net: $1798 - $1000 = $798 returned
- **PnL: -$202 on $1000 margin = -20.2% loss** (≈ 2x the 10% drop)

---

## Architecture

### Smart Contracts

```
contracts/contracts/
├── PositionManager.sol              # Core contract — opens/closes leveraged positions
├── MockSwapRouter.sol               # Mock DEX with configurable exchange rates
├── interfaces/
│   ├── IPositionManager.sol         # Position struct, events, function signatures
│   └── ISwapRouter.sol              # DEX swap interface
├── libraries/
│   └── PositionLib.sol              # Math: leverage, PnL, liquidation calculations
└── mocks/
    ├── MockERC20.sol                # Test ERC20 with public mint/burn
    ├── MockPool.sol                 # Simplified Aave Pool for unit testing
    ├── MockOracle.sol               # Configurable price oracle
    └── MockPoolAddressesProvider.sol # Mock for Aave's address registry
```

#### PositionManager.sol

The core contract. Inherits Aave's `FlashLoanSimpleReceiverBase`.

**Key functions:**
- `openLong(collateralAsset, debtAsset, marginAmount, leverageBps, minCollateralOut)` — Opens a leveraged long position. Transfers margin from user, initiates flash loan, handles the full deposit→borrow→swap→repay flow in `executeOperation` callback.
- `openShort(...)` — Opens a leveraged short position with reversed asset roles.
- `closeLong(positionId)` — Closes a long: flash loan → swap → repay debt → withdraw collateral → return funds to user.
- `closeShort(positionId)` — Closes a short similarly.
- `executeOperation(asset, amount, premium, initiator, params)` — Flash loan callback from Aave Pool. Routes to internal handlers based on `ActionType`.
- `getPosition(positionId)` — View: returns full position details.
- `getUserPositions(user)` — View: returns all position IDs for a user.

**Design decisions:**
- All flash loans use **WETH** (highest liquidity in Aave Pool on Sepolia).
- Flash loan amount is **reduced by ~9 bps** to account for the 5 bps premium (ensures enough tokens to repay).
- Uses `swapExactInput` for long opens (swap ALL USDC → WETH, accept whatever comes back).
- Leverage stored in **basis points** (20000 = 2x, 40000 = 4x) for integer precision.
- Positions stored in a mapping with incrementing IDs.

#### MockSwapRouter.sol

Since Aave testnet tokens don't have Uniswap liquidity on Sepolia, we use a mock DEX with admin-configurable exchange rates.

- `setRate(tokenIn, tokenOut, rate, decimalsIn, decimalsOut)` — Set exchange rate (18-decimal precision).
- `swapExactInput(...)` — Swap exact input amount, receive calculated output.
- `swapExactOutput(...)` — Swap to receive exact output, pay calculated input.
- Must be **pre-funded** with both tokens to execute swaps.

#### PositionLib.sol

Pure math library:
- `calcTotalPosition(margin, leverageBps)` = margin × leverage / 10000
- `calcBorrowAmount(totalPosition, margin)` = totalPosition - margin
- `calcInitialLTV(leverageBps)` = 1 - 10000/leverage (in basis points)

### Frontend

```
frontend/src/
├── app/
│   ├── layout.tsx              # Root layout with Web3Provider, Header, Toaster
│   ├── page.tsx                # Redirects to /trade
│   ├── trade/page.tsx          # Trading interface
│   └── positions/page.tsx      # Position management
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Navigation + RainbowKit wallet connect
│   │   └── NetworkWarning.tsx  # Banner when connected to wrong chain
│   ├── trade/
│   │   └── TradePanel.tsx      # Long/short toggle, margin input, leverage slider
│   ├── positions/
│   │   ├── PositionList.tsx    # Fetches and displays user positions
│   │   └── PositionCard.tsx    # Individual position with close button
│   └── ui/                    # Reusable UI components (Button, Card)
├── hooks/
│   └── usePositionManager.ts   # wagmi hooks for all contract interactions
├── lib/
│   ├── contracts.ts            # ABIs and deployed addresses
│   ├── errors.ts               # User-friendly error message parser
│   ├── utils.ts                # Tailwind class merge utility
│   └── wagmi.ts                # wagmi + RainbowKit config (Sepolia)
└── providers/
    └── Web3Provider.tsx        # WagmiProvider + QueryClient + RainbowKit
```

**Trading flow in the UI:**
1. Connect MetaMask via RainbowKit
2. Select Long or Short
3. Enter margin amount in USDC
4. Adjust leverage (1.5x — 4x)
5. Review position preview (total size, borrow amount, direction)
6. Approve USDC spending (one-time)
7. Confirm transaction → position opens on-chain
8. View position on /positions page
9. Close position → funds returned to wallet

---

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| **PositionManager** | [`0x1f15AA1DaB4933900A6C2Ea8F5D2d28fAAA5e5eD`](https://sepolia.etherscan.io/address/0x1f15AA1DaB4933900A6C2Ea8F5D2d28fAAA5e5eD#code) |
| **MockSwapRouter** | [`0xFdaD24fE8b093E1f20842BbF9AE80A179d80c3A9`](https://sepolia.etherscan.io/address/0xFdaD24fE8b093E1f20842BbF9AE80A179d80c3A9#code) |

**Aave V3 Sepolia addresses used:**

| Contract | Address |
|----------|---------|
| PoolAddressesProvider | `0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A` |
| Pool | `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951` |
| WETH | `0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c` |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

All contracts are **verified on Etherscan** — source code is publicly readable.

---

## Project Structure

```
.
├── contracts/                    # Hardhat project
│   ├── contracts/
│   │   ├── PositionManager.sol   # Core: leveraged positions via flash loans
│   │   ├── MockSwapRouter.sol    # Mock DEX for testnet
│   │   ├── interfaces/           # IPositionManager, ISwapRouter
│   │   ├── libraries/            # PositionLib (math)
│   │   └── mocks/                # MockPool, MockOracle, MockERC20 (testing)
│   ├── scripts/
│   │   └── deploy.ts            # Deployment script for Sepolia
│   ├── test/
│   │   ├── MockSwapRouter.test.ts
│   │   └── PositionManager.test.ts  # 35 tests (long + short + edge cases)
│   ├── hardhat.config.ts
│   └── package.json
├── frontend/                    # Next.js 14 application
│   ├── src/
│   │   ├── app/                 # Pages (trade, positions)
│   │   ├── components/          # UI components
│   │   ├── hooks/               # wagmi contract hooks
│   │   ├── lib/                 # ABIs, config, utilities
│   │   └── providers/           # Web3Provider
│   └── package.json
├── README.md                    # This file
├── bible.md                     # Project conventions and rules
└── article-notes.md             # Key formulas from the paper
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **MetaMask** browser extension, configured for Sepolia
- **Sepolia ETH** for gas (~0.05 ETH). Get from [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- **Aave testnet USDC** — mint at [Aave Faucet](https://app.aave.com/faucet/) (switch to Sepolia in the app)

### 1. Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test          # 35 tests should pass
```

To deploy your own instance:
```bash
# Set up .env with your keys
cp .env.example .env
# Edit .env: ALCHEMY_API_KEY, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY

npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat verify --network sepolia <MockSwapRouter_address>
npx hardhat verify --network sepolia <PositionManager_address> <PoolAddressesProvider> <SwapRouter>
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/trade`.

### 3. End-to-End Test

1. Connect MetaMask (Sepolia network)
2. Mint testnet USDC from Aave Faucet
3. Fund MockSwapRouter with WETH and USDC (needed for swaps)
4. Go to `/trade` → select Long → enter margin → approve USDC → open position
5. Go to `/positions` → see your open position → close it

---

## Testing

The project has **35 automated tests** covering all contract functionality:

```
MockSwapRouter (12 tests)
  ✔ Rate setting and access control
  ✔ Amount calculations (both directions, different decimals)
  ✔ swapExactInput / swapExactOutput
  ✔ Slippage protection, liquidity checks

PositionManager — Long Positions (12 tests)
  ✔ Open 2x and 3x leveraged long positions
  ✔ Close position and verify fund return
  ✔ Event emission (PositionOpened, PositionClosed)
  ✔ Validation: zero margin, invalid leverage, unauthorized close
  ✔ Multiple positions per user

PositionManager — Short Positions (11 tests)
  ✔ Open 2x and 3x leveraged short positions
  ✔ Close position and verify fund return
  ✔ Mixed long + short positions for same user
  ✔ Same validation edge cases as long
```

Tests use a **fully mocked environment** (MockPool, MockOracle, MockSwapRouter) — no dependency on forked network state.

---

## Key Concepts from the Paper

| Concept | Formula | Description |
|---------|---------|-------------|
| **Leverage** | `L = 1/(1-θ₀)` | θ₀ = initial LTV. Higher LTV = higher leverage |
| **Margin** | `M = P₀ × (1-θ₀)` | User's upfront capital. Only a fraction of position value |
| **PnL (Long)** | `PnL ≈ L × (Pₜ - P₀)` | Amplified by leverage factor for short time horizons |
| **Liquidation** | `HF < 1` | Health Factor = (collateral × liq_threshold) / debt |
| **Implied Funding Fee** | `IFF = r_borrow - r_supply` | Cost of maintaining position, lower than perp funding |

**Key insight:** Loan-based leveraged positions have **lower and less volatile implied funding fees** compared to perpetual futures, making them a cost-effective alternative for leveraged exposure.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.20, Hardhat 2, OpenZeppelin, Aave V3 |
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Web3 Integration | wagmi v2, viem, RainbowKit |
| Testing | Chai, Hardhat Network, Ethers.js v6 |
| Network | Ethereum Sepolia Testnet |

---

## License

MIT
