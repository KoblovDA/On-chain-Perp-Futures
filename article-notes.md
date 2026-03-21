# Article Notes: "Leveraged Trading via Lending Platforms"
## Szpruch, Xu, Sabaté-Vidales, Aouane (2024)

## Core Idea
Decentralized lending protocols (Aave, Compound, Morpho) allow users to enter leveraged long/short positions. The paper compares these "loan positions" with perpetual futures contracts.

## Leveraged Long Position (Section 2.1)
- Risky asset: ETH, stablecoin: DAI (or USDC)
- **Opening with flash loan:**
  1. Begin with P₀(1-θ⁰) of stablecoin (user's margin)
  2. Flash swap/loan to obtain 1 ETH worth P₀ stablecoin
  3. Deposit 1 ETH as collateral in Aave
  4. Borrow θ⁰·P₀ stablecoin against collateral
  5. Combine borrowed + margin to repay flash loan
- **Closing (Remark 1 — flashswap close out):**
  1. Flash loan θ⁰·P₀·e^(r_borrow·t) stablecoin to repay debt
  2. Redeem ETH collateral (valued at P_t·e^(r_supply·t))
  3. Complete flash swap with redeemed ETH

## Key Formulas
- **Leverage:** L = 1/(1-θ⁰) where θ⁰ is initial LTV (Eq. 3)
  - θ⁰ = 0.50 → 2x leverage
  - θ⁰ = 0.667 → 3x leverage
  - θ⁰ = 0.75 → 4x leverage
- **PnL of long position (Eq. 2):**
  PnL_t = (P_t·e^(r_supply·t) - θ⁰·P₀·e^(r_borrow·t))·1_{t<τ} - P₀(1-θ⁰)
- **Liquidation (τ^B):** occurs when θ·P_t·e^(r_supply·t) ≤ θ⁰·P₀·e^(r_borrow·t)
  where θ ∈ (θ⁰, 1) is the liquidation threshold
- **Implied Funding Fee (Eq. 4):**
  IFF_t = P_t(1 - e^(r_supply·t)) - θ⁰·P₀(1 - e^(r_borrow·t))
- **Maintenance margin** implied by lending platform: (1-θ)·P_t·e^(r_supply·t)

## Short Position
- Deposit stablecoin, borrow risky asset
- NOT the negative payoff of long (asymmetry noted in paper)

## Perpetual Futures Comparison (Section 3)
- Perp price: F_t = P_t(1 + r/κ) under no-arbitrage
- Funding fee for perps: κ·∫e^(r(t-s))·(F_s - P_s)ds
- Loan positions have **lower and less volatile** implied funding fees than perp funding fees
- Loan positions get liquidated earlier than perps (lending protocols use tighter thresholds)

## Simulation Parameters (Section 4)
- ETH price: geometric Brownian motion, P₀ = 2000
- Initial LTV θ⁰ = 0.75 (4x leverage)
- Liquidation threshold θ = 0.85
- Aave interest rate model: piecewise linear based on utilization

## Key Takeaways for Implementation
1. Flash loans eliminate the need for full capital upfront
2. Only margin P₀(1-θ⁰) is needed from the user
3. Position is self-contained: collateral in Aave + debt in Aave
4. Health factor = (collateral × liquidation_threshold) / debt
5. Interest accrues on both collateral (supply rate) and debt (borrow rate)
6. PnL ≈ P_t - P₀ for short time horizons (interest rates negligible)
