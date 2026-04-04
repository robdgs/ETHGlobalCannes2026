/**
 * scripts/deploySmartAccount.ts
 *
 * Deploy ProvenanceChainSmartAccount to Coston2 testnet.
 *
 * Usage:
 *   npx hardhat run scripts/deploySmartAccount.ts --network coston2
 *
 * After deployment, paste the contract address into .env.local:
 *   FLARE_SMART_ACCOUNT_ADDRESS=0x...
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n⬡  Deploying ProvenanceChainSmartAccount");
  console.log("    Deployer:", deployer.address);
  console.log("    Balance: ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLR\n");

  const Factory  = await ethers.getContractFactory("ProvenanceChainSmartAccount");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅  Contract deployed:", address);
  console.log("    Explorer: https://coston2.testnet.flarescan.com/address/" + address);

  // Write address back to .env.local
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf8");
    const re    = /^FLARE_SMART_ACCOUNT_ADDRESS=.*$/m;
    const line  = `FLARE_SMART_ACCOUNT_ADDRESS=${address}`;
    content     = re.test(content) ? content.replace(re, line) : content + `\n${line}`;
    fs.writeFileSync(envPath, content);
    console.log("    .env.local updated with FLARE_SMART_ACCOUNT_ADDRESS\n");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
