import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying SmartWallet to Arc Testnet...");
  console.log("═══════════════════════════════════════════");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatUnits(balance, 6), "USDC");
  console.log("");

  // Deploy SmartWallet
  console.log("📦 Deploying SmartWallet contract...");
  const SmartWallet = await ethers.getContractFactory("SmartWallet");
  const wallet = await SmartWallet.deploy();
  
  await wallet.waitForDeployment();
  const walletAddress = await wallet.getAddress();

  console.log("✅ SmartWallet deployed!");
  console.log("═══════════════════════════════════════════");
  console.log("📝 Contract Address:", walletAddress);
  console.log("👤 Owner:", await wallet.owner());
  console.log("💵 Initial Balance:", await wallet.getBalance(), "wei");
  console.log("");
  console.log("🔗 View on Arcscan:");
  console.log(`   https://testnet.arcscan.app/address/${walletAddress}`);
  console.log("");
  console.log("💡 Next Steps:");
  console.log("   1. Get testnet USDC: https://faucet.circle.com/");
  console.log("   2. Send USDC to your wallet:", walletAddress);
  console.log("   3. Test operations via frontend or scripts");
  console.log("═══════════════════════════════════════════");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "Arc Testnet",
    chainId: 5042002,
    contractAddress: walletAddress,
    owner: await wallet.owner(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    transactionHash: wallet.deploymentTransaction()?.hash,
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("💾 Deployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
