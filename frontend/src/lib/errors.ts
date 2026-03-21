/** Parse a contract/wallet error into a user-friendly message */
export function parseError(error: unknown): string {
  const msg = (error as Error)?.message || String(error);

  // User rejected in wallet
  if (msg.includes("User rejected") || msg.includes("user rejected")) {
    return "Transaction rejected by user";
  }

  // Common contract reverts
  if (msg.includes("PM: zero margin")) return "Margin amount cannot be zero";
  if (msg.includes("PM: invalid leverage")) return "Leverage must be between 1.5x and 5x";
  if (msg.includes("PM: not owner")) return "You are not the owner of this position";
  if (msg.includes("PM: not active")) return "This position is already closed";
  if (msg.includes("PM: not long")) return "This is not a long position";
  if (msg.includes("PM: not short")) return "This is not a short position";
  if (msg.includes("insufficient allowance")) return "Please approve USDC first";
  if (msg.includes("transfer amount exceeds balance")) return "Insufficient token balance";
  if (msg.includes("insufficient funds")) return "Not enough ETH for gas fees";

  // Truncate long messages
  if (msg.length > 100) return msg.slice(0, 100) + "...";
  return msg;
}
