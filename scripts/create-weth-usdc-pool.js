/**
 * Create WETH/USDC Pool on Unichain Sepolia
 * Simple script to create the most important pool for swaps
 */

const { ethers } = require('ethers');
require('dotenv').config();

const UNICHAIN_RPC = 'https://sepolia.unichain.org';
const POOL_MANAGER = '0x00b036b58a818b1bc34d502d3fe730db729e62ac';
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

async function main() {
  console.log('🏊 Creating WETH/USDC Pool on Unichain\n');
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found');
    process.exit(1);
  }
  
  const provider = new ethers.JsonRpcProvider(UNICHAIN_RPC);
  const signer = new ethers.Wallet(privateKey, provider);
  
  console.log(`Wallet: ${signer.address}`);
  
  // Check ETH balance
  try {
    const balance = await provider.getBalance(signer.address);
    console.log(`ETH Balance: ${ethers.formatEther(balance)}\n`);
    
    if (balance < ethers.parseEther('0.005')) {
      console.log('⚠️  Low ETH! Get from: https://sepolia.unichain.org/faucet\n');
    }
  } catch (error) {
    console.log('Could not check balance, continuing anyway...\n');
  }
  
  // Create pool
  const [currency0, currency1] = USDC.toLowerCase() < WETH.toLowerCase() 
    ? [USDC, WETH] 
    : [WETH, USDC];
  
  const isInverted = WETH.toLowerCase() !== currency0.toLowerCase();
  const price = isInverted ? 3200 : (1 / 3200); // 1 ETH = 3200 USDC
  
  const sqrtPrice = Math.sqrt(price);
  const Q96 = 2n ** 96n;
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));
  
  const poolKey = {
    currency0,
    currency1,
    fee: 3000, // 0.3%
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000'
  };
  
  console.log('Pool Configuration:');
  console.log(`  Token0: ${poolKey.currency0}`);
  console.log(`  Token1: ${poolKey.currency1}`);
  console.log(`  Price: ${price.toFixed(8)}`);
  console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}\n`);
  
  const poolManagerAbi = [
    'function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96, bytes hookData) external returns (int24 tick)'
  ];
  
  const poolManager = new ethers.Contract(POOL_MANAGER, poolManagerAbi, signer);
  
  try {
    console.log('Initializing pool...');
    const tx = await poolManager.initialize(poolKey, sqrtPriceX96.toString(), '0x');
    console.log(`Transaction sent: ${tx.hash}`);
    
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    
    console.log(`\n✅ Pool created successfully!`);
    console.log(`   Tx: ${receipt.hash}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`\n🎉 You can now swap WETH <-> USDC on Unichain!`);
    
  } catch (error) {
    if (error.message.includes('PoolAlreadyInitialized') || error.data?.includes('0x13c00596')) {
      console.log('ℹ️  Pool already exists! You can swap now.');
    } else {
      console.error('❌ Failed:', error.message);
      if (error.data) console.error('   Error data:', error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
