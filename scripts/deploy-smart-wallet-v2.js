/**
 * Deploy SmartWalletV2 to Arc Network
 * 
 * IMPORTANT: After deployment, update .env with:
 * - ARC_SMART_WALLET_V2=<deployed_address>
 * - NEXT_PUBLIC_ARC_SMART_WALLET_V2=<deployed_address>
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying SmartWalletV2 to Arc Network...\n");
  
  console.log("📋 Configuration:");
  console.log("   Network:", hre.network.name);
  console.log("   Chain ID:", (await hre.ethers.provider.getNetwork()).chainId);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("   Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("   Balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("");
  
  if (balance === 0n) {
    console.error("❌ ERROR: Deployer has no ETH for gas");
    console.log("📝 Get Arc testnet ETH from faucet:");
    console.log("   https://faucet.arc.network/");
    process.exit(1);
  }
  
  // Deploy SmartWalletV2
  console.log("📦 Deploying SmartWalletV2 contract...");
  const SmartWalletV2 = await hre.ethers.getContractFactory("SmartWalletV2");
  const wallet = await SmartWalletV2.deploy();
  
  await wallet.waitForDeployment();
  
  const walletAddress = await wallet.getAddress();
  console.log("✅ SmartWalletV2 deployed to:", walletAddress);
  
  // Get deployment transaction
  const deployTx = wallet.deploymentTransaction();
  console.log("   Transaction hash:", deployTx?.hash);
  console.log("   Owner:", await wallet.owner());
  console.log("");
  
  // Save to .env instructions
  console.log("📝 NEXT STEPS:");
  console.log("1. Add these lines to your .env file:");
  console.log("");
  console.log(`ARC_SMART_WALLET_V2=${walletAddress}`);
  console.log(`NEXT_PUBLIC_ARC_SMART_WALLET_V2=${walletAddress}`);
  console.log("");
  console.log("2. Fund the wallet with test USDC:");
  console.log(`   Wallet address: ${walletAddress}`);
  console.log("   Get USDC from: https://faucet.circle.com/");
  console.log("");
  console.log("3. Verify contract on Arc explorer:");
  console.log(`   npx hardhat verify --network arcTestnet ${walletAddress}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
