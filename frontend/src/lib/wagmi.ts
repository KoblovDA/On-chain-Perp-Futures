import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Leveraged Trading",
  projectId: "demo-project-id", // WalletConnect project ID (optional for MetaMask)
  chains: [sepolia],
  ssr: true,
});
