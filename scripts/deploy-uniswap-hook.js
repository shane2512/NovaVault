/**
 * Deploy UniswapV4Hook to Unichain
 * 
 * IMPORTANT: After deployment, update .env with:
 * - UNICHAIN_HOOK_ADDRESS=<deployed_address>
 * - NEXT_PUBLIC_UNICHAIN_HOOK_ADDRESS=<deployed_address>
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying UniswapV4Hook to Unichain...\n");
  
  // Get PoolManager address from .env (Unichain Sepolia official address)
  const poolManagerAddress = process.env.UNICHAIN_POOL_MANAGER || "0x00b036b58a818b1bc34d502d3fe730db729e62ac";
  
  console.log("✅ Using PoolManager from .env:", poolManagerAddress);
  
  console.log("📋 Configuration:");
  console.log("   PoolManager:", poolManagerAddress);
  console.log("   Network:", hre.network.name);
  console.log("   Chain ID:", (await hre.ethers.provider.getNetwork()).chainId);
  console.log("");
  
  // Deploy Hook
  console.log("📦 Deploying UniswapV4Hook contract...");
  const UniswapV4Hook = await hre.ethers.getContractFactory("UniswapV4Hook");
  const hook = await UniswapV4Hook.deploy(poolManagerAddress);
  
  await hook.waitForDeployment();
  
  const hookAddress = await hook.getAddress();
  console.log("✅ UniswapV4Hook deployed to:", hookAddress);
  
  // Get deployment transaction
  const deployTx = hook.deploymentTransaction();
  console.log("   Transaction hash:", deployTx?.hash);
  console.log("");
  
  // Save to .env instructions
  console.log("📝 NEXT STEPS:");
  console.log("1. Add these lines to your .env file:");
  console.log("");
  console.log(`UNICHAIN_HOOK_ADDRESS=${hookAddress}`);
  console.log(`NEXT_PUBLIC_UNICHAIN_HOOK_ADDRESS=${hookAddress}`);
  console.log("");
  console.log("2. Authorize your wallet address:");
  console.log(`   Run: node scripts/authorize-wallet.js ${hookAddress}`);
  console.log("");
  console.log("3. Verify contract on Unichain explorer:");
  console.log(`   npx hardhat verify --network unichain ${hookAddress} ${poolManagerAddress}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
