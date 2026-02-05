/**
 * Bootstrap Unichain with Tokens and Pools
 * 
 * This script:
 * 1. Guides you to bridge USDC to Unichain via your app
 * 2. Verifies tokens arrived on Unichain
 * 3. Creates all necessary Uniswap V4 pools
 * 
 * PREREQUISITES:
 * - USDC on Sepolia (in your PRIVATE_KEY wallet)
 * - ETH on Sepolia (for bridge gas)
 * - ETH on Unichain (for pool creation gas)
 * 
 * USAGE:
 * node scripts/bootstrap-unichain.js [--skip-bridge]
 */

const { ethers } = require('ethers');
require('dotenv').config();

const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/demo';
const UNICHAIN_RPC = 'https://sepolia.unichain.org';

const UNICHAIN_CONFIG = {
  chainId: 1301,
  poolManager: '0x00b036b58a818b1bc34d502d3fe730db729e62ac',
  hookAddress: '0x0000000000000000000000000000000000000000', // No hook for simplicity
};

const TOKENS = {
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  WETH: '0x4200000000000000000000000000000000000006',
};

const SKIP_BRIDGE = process.argv.includes('--skip-bridge');

/**
 * Check if token exists on Unichain
 */
async function checkTokenOnUnichain(provider, address) {
  try {
    const erc20Abi = [
      'function balanceOf(address) view returns (uint256)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)'
    ];
    
    const contract = new ethers.Contract(address, erc20Abi, provider);
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = new ethers.Wallet(privateKey);
    
    const [balance, symbol, decimals] = await Promise.all([
      contract.balanceOf(wallet.address),
      contract.symbol(),
      contract.decimals()
    ]);
    
    return {
      exists: true,
      symbol,
      decimals: Number(decimals),
      balance: ethers.formatUnits(balance, decimals)
    };
  } catch (error) {
    return { exists: false };
  }
}

/**
 * Create a pool on Unichain
 */
async function createPool(signer, token0, token1, price, name) {
  console.log(`\n🔵 Creating ${name} pool...`);
  
  try {
    // Ensure proper token ordering
    const [currency0, currency1] = token0.toLowerCase() < token1.toLowerCase() 
      ? [token0, token1] 
      : [token1, token0];
    
    const needsInversion = token0.toLowerCase() !== currency0.toLowerCase();
    const actualPrice = needsInversion ? 1 / price : price;
    
    // Calculate sqrtPriceX96
    const sqrtPrice = Math.sqrt(actualPrice);
    const Q96 = 2n ** 96n;
    const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));
    
    const poolKey = {
      currency0,
      currency1,
      fee: 3000, // 0.3%
      tickSpacing: 60,
      hooks: UNICHAIN_CONFIG.hookAddress
    };
    
    const poolManagerAbi = [
      'function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96, bytes hookData) external returns (int24 tick)'
    ];
    
    const poolManager = new ethers.Contract(
      UNICHAIN_CONFIG.poolManager,
      poolManagerAbi,
      signer
    );
    
    console.log(`   Price: ${actualPrice.toFixed(4)}`);
    const tx = await poolManager.initialize(poolKey, sqrtPriceX96.toString(), '0x');
    const receipt = await tx.wait();
    
    console.log(`   ✅ Pool created! Tx: ${receipt.hash}`);
    return true;
    
  } catch (error) {
    if (error.message.includes('PoolAlreadyInitialized') || error.data?.includes('0x13c00596')) {
      console.log(`   ℹ️  Pool already exists`);
      return true;
    }
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Unichain Bootstrap Script\n');
  console.log('━'.repeat(60));
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }
  
  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const unichainProvider = new ethers.JsonRpcProvider(UNICHAIN_RPC);
  const wallet = new ethers.Wallet(privateKey);
  const unichainSigner = wallet.connect(unichainProvider);
  
  console.log(`\n📋 Wallet: ${wallet.address}`);
  
  // Check balances
  const [sepoliaETH, unichainETH] = await Promise.all([
    sepoliaProvider.getBalance(wallet.address),
    unichainProvider.getBalance(wallet.address)
  ]);
  
  console.log(`\n💰 Balances:`);
  console.log(`   Sepolia ETH: ${ethers.formatEther(sepoliaETH)}`);
  console.log(`   Unichain ETH: ${ethers.formatEther(unichainETH)}`);
  
  if (unichainETH < ethers.parseEther('0.01')) {
    console.log(`\n⚠️  Low Unichain ETH! Get from faucet:`);
    console.log(`   https://sepolia.unichain.org/faucet`);
  }
  
  // Step 1: Check if USDC is already on Unichain
  console.log(`\n━`.repeat(30));
  console.log(`\nStep 1: Checking for USDC on Unichain...`);
  
  const usdcOnUnichain = await checkTokenOnUnichain(unichainProvider, TOKENS.USDC);
  
  if (!usdcOnUnichain.exists || parseFloat(usdcOnUnichain.balance) < 5) {
    if (SKIP_BRIDGE) {
      console.log(`❌ USDC not found on Unichain and --skip-bridge was used`);
      console.log(`   Bridge USDC manually, then run again with --skip-bridge`);
      process.exit(1);
    }
    
    console.log(`❌ Need to bridge USDC to Unichain first`);
    console.log(`\n📋 Follow these steps:`);
    console.log(`   1. Open your NovaVault app`);
    console.log(`   2. Go to Bridge page`);
    console.log(`   3. Bridge 10 USDC from Sepolia to Unichain`);
    console.log(`   4. Wait for confirmation (30-60 seconds)`);
    console.log(`   5. Run this script again with: node scripts/bootstrap-unichain.js --skip-bridge`);
    console.log(`\n💡 Or use Circle's Bridge UI: https://testnet.circle.com/bridge\n`);
    process.exit(0);
  } else {
    console.log(`✅ USDC already on Unichain! Balance: ${usdcOnUnichain.balance}`);
  }
  
  // Step 2: Create pools
  console.log(`\n━`.repeat(30));
  console.log(`\nStep 2: Creating Uniswap V4 pools...`);
  
  const pools = [
    { token0: TOKENS.WETH, token1: TOKENS.USDC, price: 3200, name: 'WETH/USDC' },
  ];
  
  let created = 0;
  for (const pool of pools) {
    const success = await createPool(
      unichainSigner,
      pool.token0,
      pool.token1,
      pool.price,
      pool.name
    );
    if (success) created++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n━`.repeat(30));
  console.log(`\n🎉 Bootstrap complete!`);
  console.log(`   Pools created: ${created}/${pools.length}`);
  console.log(`\n💡 You can now swap WETH <-> USDC on Unichain!`);
  console.log(`   Test it in your NovaVault app.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
