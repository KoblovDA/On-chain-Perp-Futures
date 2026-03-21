# On-Chain Leveraged Trading via Aave Flash Loans

A decentralized application for opening and closing leveraged long/short positions on crypto assets using Aave V3 Flash Loans on Ethereum Sepolia testnet.

Based on the paper: **"Leveraged Trading via Lending Platforms"** by Szpruch, Xu, Sabaté-Vidales, and Aouane (2024).

## How It Works

Decentralized lending protocols (e.g., Aave) enable users to build leveraged trading positions through a "deposit → borrow → swap" loop. Flash loans make entering and exiting positions capital-efficient — only a fraction of the capital (the margin) is needed upfront.

### Leveraged Long
1. User provides margin in USDC
2. Flash loan USDC from Aave (full position value)
3. Swap USDC → WETH
4. Deposit WETH as collateral in Aave
5. Borrow USDC against collateral
6. Repay flash loan with borrowed USDC + user margin

**Result:** User controls a leveraged long ETH position. If ETH price goes up, profit is amplified. Leverage = 1/(1 - LTV).

### Leveraged Short
1. User provides margin in USDC
2. Flash loan WETH from Aave
3. Swap WETH → USDC
4. Deposit USDC as collateral in Aave
5. Borrow WETH against collateral
6. Repay flash loan with borrowed WETH

**Result:** User profits when ETH price goes down.

## Tech Stack

- **Smart Contracts:** Solidity 0.8.20, Hardhat, OpenZeppelin
- **Frontend:** Next.js 14, TypeScript, TailwindCSS, shadcn/ui
- **Web3:** wagmi v2, viem, MetaMask
- **Network:** Ethereum Sepolia Testnet
- **Protocols:** Aave V3 (lending/flash loans)

## Project Structure

```
├── contracts/          # Hardhat project (smart contracts)
│   ├── contracts/      # Solidity source files
│   ├── scripts/        # Deployment scripts
│   └── test/           # Contract tests
├── frontend/           # Next.js web application
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- MetaMask browser extension (configured for Sepolia)
- Sepolia ETH (from a faucet)
- Aave testnet tokens (from https://app.aave.com/faucet/)

### Smart Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network sepolia
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Supported Trading Pairs

- WETH/USDC

## Key Concepts (from the paper)

- **LTV (Loan-to-Value):** θ⁰ — ratio of borrowed value to collateral value
- **Leverage:** L = 1/(1 - θ⁰). With θ⁰ = 0.75, leverage is 4x
- **Liquidation:** Occurs when health factor drops below 1 (collateral value insufficient to cover debt)
- **Implied Funding Fee:** The cost of maintaining a leveraged position through a lending protocol, analogous to funding fees in perpetual futures

## License

MIT
