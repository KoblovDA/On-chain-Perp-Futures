# Project Bible — Rules & Conventions

## Language
- All code, UI text, comments, variable names, commit messages: **English only**
- Communication with the user: **Russian**

## Architecture Rules
- Smart contracts in `contracts/` (Hardhat project)
- Frontend in `frontend/` (Next.js project)
- Only one trading pair: **WETH/USDC**
- Network: **Sepolia testnet only**
- DEX swaps via **MockSwapRouter** (Aave testnet tokens have no Uniswap liquidity)

## Smart Contract Rules
- Solidity ^0.8.20
- Use OpenZeppelin for SafeERC20, ReentrancyGuard
- Inherit `FlashLoanSimpleReceiverBase` from Aave V3
- Always validate `msg.sender == POOL` and `initiator == address(this)` in flash loan callback
- Handle decimal differences: WETH = 18 decimals, USDC = 6 decimals
- Leverage in basis points (40000 = 4x)
- Store position metadata on-chain (owner, collateral, debt, entry price, leverage, active flag)

## Frontend Rules
- Next.js 14 with App Router
- wagmi v2 + viem for Web3
- TailwindCSS + shadcn/ui for styling
- Beautiful, clean, professional UI
- Show health factor with color coding (green > 2.0, yellow 1.5-2.0, orange 1.1-1.5, red < 1.1)
- Always show transaction status (pending/success/failed)
- Mobile responsive

## Key Addresses (Aave V3 Sepolia)
- Pool: `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`
- PoolAddressesProvider: `0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A`
- WETH: `0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c`
- USDC: `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`

## Testing Rules
- Test every phase before moving to the next
- Use Hardhat forked Sepolia for contract tests
- Manual E2E testing on live Sepolia after deployment
- All tests must pass before proceeding

## Do NOT
- Re-read the PDF article (key ideas extracted to article-notes.md)
- Create unnecessary files
- Over-engineer — keep it simple
- Commit .env or API keys
