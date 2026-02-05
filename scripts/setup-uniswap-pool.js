/**
 * Setup Uniswap V4 Pools on Unichain
 * 
 * Creates all necessary pools for NovaVault swaps:
 * - USDC/USDT, USDC/DAI, USDT/DAI (stablecoin pairs)
 * - WETH/USDC, WETH/USDT, WETH/DAI (ETH pairs)
 * 
 * PREREQUISITES:
 * 1. Unichain Sepolia ETH for gas (get from faucet)
 * 2. Test tokens on Unichain (bridged via CCTP)
 * 3. UniswapV4Hook deployed (optional, can use zero address)
 * 
 * USAGE:
 * node scripts/setup-uniswap-pool.js
 */

const { ethers } = require('ethers');
require('dotenv').config();

const UNICHAIN_CONFIG = {
  chainId: 1301,
  rpcUrl: 'https://sepolia.unichain.org',
  poolManager: '0x00b036b58a818b1bc34d502d3fe730db729e62ac',
  positionManager: '0xf969aee60879c54baaed9f3ed26147db216fd664',
  // No hook = easier pool creation (hook must have specific permissions)
  hookAddress: '0x0000000000000000000000000000000000000000',
};

// Token addresses on Unichain Sepolia (after CCTP bridge)
const TOKENS = {
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  DAI: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
  WETH: '0x4200000000000000000000000000000000000006', // Native WETH on Unichain
};

// Pool pairs to create
const POOL_PAIRS = [
  { name: 'USDC/USDT', token0: 'USDC', token1: 'USDT', price: 1.0, liquidity: '1000' },
  { name: 'USDC/DAI', token0: 'USDC', token1: 'DAI', price: 1.0, liquidity: '1000' },
  { name: 'USDT/DAI', token0: 'USDT', token1: 'DAI', price: 1.0, liquidity: '1000' },
  { name: 'WETH/USDC', token0: 'WETH', token1: 'USDC', price: 3200, liquidity: '0.5' }, // 1 ETH = 3200 USDC
  { name: 'WETH/USDT', token0: 'WETH', token1: 'USDT', price: 3200, liquidity: '0.5' },
  { name: 'WETH/DAI', token0: 'WETH', token1: 'DAI', price: 3200, liquidity: '0.5' },
];

/**
 * Calculate sqrtPriceX96 from price
 * For Uniswap V4 pool initialization
 */
function encodePriceSqrt(price) {
  // sqrtPriceX96 = sqrt(price) * 2^96
  const sqrtPrice = Math.sqrt(price);
  const Q96 = 2n ** 96n;
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Create a pool key with proper ordering
 */
function createPoolKey(token0Addr, token1Addr, fee = 3000, tickSpacing = 60, hooks = '0x0000000000000000000000000000000000000000') {
  // Ensure proper token ordering (lower address first)
  const [currency0, currency1] = token0Addr.toLowerCase() < token1Addr.toLowerCase() 
    ? [token0Addr, token1Addr] 
    : [token1Addr, token0Addr];
  
  return {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks
  };
}

/**
 * Initialize a single pool
 */
async function initializePool(signer, poolConfig) {
  const { name, token0, token1, price, liquidity } = poolConfig;
  
  console.log(`\n🔵 Setting up ${name} pool...`);
  
  const token0Addr = TOKENS[token0];
  const token1Addr = TOKENS[token1];
  
  if (!token0Addr || !token1Addr) {
    console.log(`❌ Token addresses not found for ${name}`);
    return false;
  }
  
  try {
    // 1. Create pool key with proper ordering
    const poolKey = createPoolKey(token0Addr, token1Addr, 3000, 60, UNICHAIN_CONFIG.hookAddress);
    console.log(`   Token0: ${poolKey.currency0}`);
    console.log(`   Token1: ${poolKey.currency1}`);
    console.log(`   Fee: 0.3%`);
    
    // 2. Calculate initial price
    const needsInversion = token0Addr.toLowerCase() !== poolKey.currency0.toLowerCase();
    const actualPrice = needsInversion ? 1 / price : price;
    const sqrtPriceX96 = encodePriceSqrt(actualPrice);
    console.log(`   Price: ${actualPrice.toFixed(4)} (sqrtPriceX96: ${sqrtPriceX96.toString()})`);
    
    // 3. Initialize pool via PoolManager
    const poolManagerAbi = [
      'function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96, bytes hookData) external returns (int24 tick)'
    ];
    
    const poolManager = new ethers.Contract(
      UNICHAIN_CONFIG.poolManager,
      poolManagerAbi,
      signer
    );
    
    console.log(`   Initializing pool...`);
    const tx = await poolManager.initialize(
      poolKey,
      sqrtPriceX96.toString(),
      '0x' // empty hookData
    );
    
    const receipt = await tx.wait();
    console.log(`   ✅ Pool initialized! Tx: ${receipt.hash}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
    // 4. Check token balances for liquidity
    const erc20Abi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];
    
    const token0Contract = new ethers.Contract(poolKey.currency0, erc20Abi, signer);
    const token1Contract = new ethers.Contract(poolKey.currency1, erc20Abi, signer);
    
    const [balance0, balance1, decimals0, decimals1] = await Promise.all([
      token0Contract.balanceOf(await signer.getAddress()),
      token1Contract.balanceOf(await signer.getAddress()),
      token0Contract.decimals(),
      token1Contract.decimals()
    ]);
    
    console.log(`   📊 Your balances:`);
    console.log(`      Token0: ${ethers.formatUnits(balance0, decimals0)}`);
    console.log(`      Token1: ${ethers.formatUnits(balance1, decimals1)}`);
    
    if (balance0 === 0n || balance1 === 0n) {
      console.log(`   ⚠️  No tokens for liquidity. Pool created but empty.`);
      console.log(`   💡 Bridge tokens to Unichain first, then add liquidity manually.`);
    }
    
    return true;
    
  } catch (error) {
    if (error.message.includes('PoolAlreadyInitialized') || error.data?.includes('0x13c00596')) {
      console.log(`   ℹ️  Pool already exists - skipping`);
      return true;
    }
    console.log(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🏊 Uniswap V4 Multi-Pool Setup for NovaVault\n');
  
  const provider = new ethers.JsonRpcProvider(UNICHAIN_CONFIG.rpcUrl);
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }
  
  const signer = new ethers.Wallet(privateKey, provider);
  const address = await signer.getAddress();
  
  console.log(`📋 Configuration:`);
  console.log(`   Network: Unichain Sepolia`);
  console.log(`   Signer: ${address}`);
  console.log(`   PoolManager: ${UNICHAIN_CONFIG.poolManager}`);
  console.log(`   Hook: ${UNICHAIN_CONFIG.hookAddress}`);
  
  // Check balance
  const balance = await provider.getBalance(address);
  console.log(`   💰 ETH Balance: ${ethers.formatEther(balance)}`);
  
  if (balance < ethers.parseEther('0.01')) {
    console.log('\n⚠️  WARNING: Low ETH balance!');
    console.log('   Get testnet ETH from: https://sepolia.unichain.org/faucet');
    console.log('   Minimum recommended: 0.02 ETH\n');
    
    const proceed = process.env.SKIP_BALANCE_CHECK === 'true';
    if (!proceed) {
      console.log('Set SKIP_BALANCE_CHECK=true to continue anyway.\n');
      process.exit(1);
    }
  }
  
  console.log(`\n🎯 Creating ${POOL_PAIRS.length} pools...\n`);
  console.log('━'.repeat(60));
  
  let successCount = 0;
  let failCount = 0;
  
  for (const poolConfig of POOL_PAIRS) {
    const success = await initializePool(signer, poolConfig);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay between pools
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n━'.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successCount}/${POOL_PAIRS.length}`);
  console.log(`   ❌ Failed: ${failCount}/${POOL_PAIRS.length}`);
  
  if (successCount > 0) {
    console.log(`\n🎉 Pools created successfully!`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Bridge tokens to Unichain via your app`);
    console.log(`   2. Add liquidity through Position Manager (optional)`);
    console.log(`   3. Test swaps in NovaVault app`);
  }
  
  console.log(`\n📖 View pools on Unichain Explorer:`);
  console.log(`   https://sepolia.uniscan.xyz/address/${UNICHAIN_CONFIG.poolManager}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
