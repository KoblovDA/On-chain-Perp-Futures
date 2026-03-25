import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, hardhat } from "wagmi/chains";
import { http } from "wagmi";

export const config = getDefaultConfig({
  appName: "Leveraged Trading",
  projectId: "demo-project-id",
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
