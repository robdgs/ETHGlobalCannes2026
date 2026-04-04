import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    coston2: {
      url: process.env.FLARE_RPC_URL ?? "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts: process.env.FLARE_OPERATOR_PRIVATE_KEY
        ? [process.env.FLARE_OPERATOR_PRIVATE_KEY]
        : [],
    },
    flare: {
      url: "https://flare-api.flare.network/ext/C/rpc",
      chainId: 14,
      accounts: process.env.FLARE_OPERATOR_PRIVATE_KEY
        ? [process.env.FLARE_OPERATOR_PRIVATE_KEY]
        : [],
    },
  },
  etherscan: {
    apiKey: { coston2: "no-key-needed", flare: "no-key-needed" },
    customChains: [
      {
        network: "coston2",
        chainId: 114,
        urls: {
          apiURL:     "https://coston2.testnet.flarescan.com/api",
          browserURL: "https://coston2.testnet.flarescan.com",
        },
      },
    ],
  },
};

export default config;
