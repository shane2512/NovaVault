const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying SimpleSwap contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy SimpleSwap
  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwap.deploy();
  await simpleSwap.waitForDeployment();

  const address = await simpleSwap.getAddress();
  console.log("✅ SimpleSwap deployed to:", address);
  
  // Add initial liquidity (0.1 ETH for testing)
  console.log("\n💰 Adding initial ETH liquidity...");
  const addLiquidityTx = await simpleSwap.addLiquidityETH({ 
    value: ethers.parseEther("0.1") 
  });
  await addLiquidityTx.wait();
  console.log("✅ Added 0.1 ETH liquidity");
  
  console.log("\n📋 Contract Details:");
  console.log("═══════════════════════════════════════");
  console.log("Address:", address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("\n⚠️  Save this address to your .env file as SWAP_CONTRACT_ADDRESS");
  
  // Get current prices
  console.log("\n💲 Current Prices:");
  const ethPrice = await simpleSwap.tokenPrices(ethers.ZeroAddress);
  const usdcPrice = await simpleSwap.tokenPrices("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
  console.log("ETH:", (Number(ethPrice) / 1_000000).toFixed(2), "USD");
  console.log("USDC:", (Number(usdcPrice) / 1_000000).toFixed(2), "USD");
  
  const fee = await simpleSwap.swapFeeBps();
  console.log("\n📊 Swap Fee:", (Number(fee) / 100).toFixed(2), "%");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
