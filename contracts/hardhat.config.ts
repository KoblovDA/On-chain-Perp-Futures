import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: DEPLOYER_PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000001"
        ? [DEPLOYER_PRIVATE_KEY]
        : [],
      chainId: 11155111,
    },
    hardhat: {
      // Forking disabled for unit tests (use --network sepolia-fork for integration)
      // forking: {
      //   url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      //   enabled: !!ALCHEMY_API_KEY,
      // },
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;
