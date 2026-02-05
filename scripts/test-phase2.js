/**
 * Test Phase 2 Implementation
 * 
 * Tests all Phase 2 features:
 * - CCTP cross-chain USDC transfers
 * - Uniswap V4 swap quotes
 * - Full cross-chain swap flow
 * 
 * USAGE:
 * node scripts/test-phase2.js [--cctp-only] [--quote-only] [--full-swap]
 */

const { ethers } = require('ethers');
require('dotenv').config();

// Import service functions
const { sendUSDCToChain, getCrossChainBalance, SUPPORTED_CHAINS } = require('../lib/services/crossChainService.ts');
const { getSwapQuote, swapViaUnichain } = require('../lib/services/unichainSwapService.ts');

const TEST_CONFIG = {
  testAmount: '0.1', // 0.1 USDC for testing
  sourceChain: 'ARC-TESTNET',
  destinationChain: 'UNICHAIN-SEPOLIA',
  tokenIn: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Unichain
  tokenOut: '0x4200000000000000000000000000000000000006', // WETH on Unichain
};

async function testCCTPBridge() {
  console.log('\n🧪 Test 1: CCTP Cross-Chain Bridge\n');
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found');
  }
  
  const wallet = new ethers.Wallet(privateKey);
  const recipient = wallet.address;
  
  console.log(`📋 Test Parameters:`);
  console.log(`   Source: ${TEST_CONFIG.sourceChain}`);
  console.log(`   Destination: ${TEST_CONFIG.destinationChain}`);
  console.log(`   Amount: ${TEST_CONFIG.testAmount} USDC`);
  console.log(`   Recipient: ${recipient}\n`);
  
  try {
    console.log('Starting CCTP transfer...');
    const result = await sendUSDCToChain({
      sourceChain: TEST_CONFIG.sourceChain,
      destinationChain: TEST_CONFIG.destinationChain,
      amount: TEST_CONFIG.testAmount,
      recipient
    });
    
    console.log('\n✅ CCTP Transfer Complete!');
    console.log(`   Burn TX: ${result.burnTxHash}`);
    console.log(`   Mint TX: ${result.mintTxHash}`);
    console.log(`   Attestation: ${result.attestationId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Time: ${result.estimatedTime}s\n`);
    
    return true;
  } catch (error) {
    console.error('\n❌ CCTP Transfer Failed:', error.message);
    return false;
  }
}

async function testSwapQuote() {
  console.log('\n🧪 Test 2: Uniswap V4 Swap Quote\n');
  
  console.log(`📋 Quote Parameters:`);
  console.log(`   Token In: ${TEST_CONFIG.tokenIn}`);
  console.log(`   Token Out: ${TEST_CONFIG.tokenOut}`);
  console.log(`   Amount: ${TEST_CONFIG.testAmount}\n`);
  
  try {
    console.log('Fetching swap quote...');
    const quote = await getSwapQuote(
      TEST_CONFIG.tokenIn,
      TEST_CONFIG.tokenOut,
      TEST_CONFIG.testAmount
    );
    
    console.log('\n✅ Quote Received!');
    console.log(`   Amount Out: ${quote.amountOut}`);
    console.log(`   Price Impact: ${quote.priceImpact}%`);
    console.log(`   Route: ${quote.route.join(' -> ')}\n`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Quote Failed:', error.message);
    if (error.message.includes('pool')) {
      console.log('   ℹ️  This is expected if the pool doesn\'t exist yet.');
      console.log('   Run: node scripts/setup-uniswap-pool.js for guidance.\n');
    }
    return false;
  }
}

async function testFullSwap() {
  console.log('\n🧪 Test 3: Full Cross-Chain Swap Flow\n');
  
  console.log(`📋 Swap Parameters:`);
  console.log(`   Flow: Arc -> Unichain -> Swap -> Arc`);
  console.log(`   Token In: USDC`);
  console.log(`   Token Out: WETH`);
  console.log(`   Amount: ${TEST_CONFIG.testAmount}`);
  console.log(`   Slippage: 0.5%\n`);
  
  console.log('⚠️  WARNING: This will execute real transactions!');
  console.log('   Make sure you have:');
  console.log('   - USDC on Arc Testnet');
  console.log('   - ETH on Unichain for gas');
  console.log('   - An initialized pool on Unichain\n');
  
  try {
    console.log('Starting cross-chain swap...');
    const result = await swapViaUnichain({
      tokenIn: TEST_CONFIG.tokenIn,
      tokenOut: TEST_CONFIG.tokenOut,
      amountIn: TEST_CONFIG.testAmount,
      slippage: 0.5
    });
    
    console.log('\n✅ Cross-Chain Swap Complete!');
    console.log(`   Swap ID: ${result.swapId}`);
    console.log(`   Bridge TX: ${result.bridgeTxHash}`);
    console.log(`   Swap TX: ${result.swapTxHash}`);
    console.log(`   Return TX: ${result.returnTxHash}`);
    console.log(`   Amount Out: ${result.amountOut}`);
    console.log(`   Total Gas: ${result.totalGas}`);
    console.log(`   Status: ${result.status}\n`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Swap Failed:', error.message);
    return false;
  }
}

async function testBalanceAggregation() {
  console.log('\n🧪 Test 4: Cross-Chain Balance Aggregation\n');
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found');
  }
  
  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;
  
  console.log(`Fetching balances for: ${address}\n`);
  
  try {
    const balance = await getCrossChainBalance(address);
    
    console.log('✅ Balances Retrieved!');
    console.log(`   Total USDC: ${balance.total}\n`);
    
    console.log('   Breakdown:');
    for (const item of balance.breakdown) {
      console.log(`   ${item.chain}: ${item.balance} USDC`);
    }
    console.log('');
    
    return true;
  } catch (error) {
    console.error('\n❌ Balance Fetch Failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Phase 2 Implementation Test Suite\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const args = process.argv.slice(2);
  const testMode = args[0] || '--all';
  
  const results = {
    cctp: false,
    quote: false,
    fullSwap: false,
    balance: false
  };
  
  // Run tests based on mode
  if (testMode === '--cctp-only' || testMode === '--all') {
    results.balance = await testBalanceAggregation();
    results.cctp = await testCCTPBridge();
  }
  
  if (testMode === '--quote-only' || testMode === '--all') {
    results.quote = await testSwapQuote();
  }
  
  if (testMode === '--full-swap') {
    results.fullSwap = await testFullSwap();
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════\n');
  console.log('📊 Test Results Summary:\n');
  
  if (testMode === '--all' || testMode === '--cctp-only') {
    console.log(`   Balance Aggregation: ${results.balance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   CCTP Bridge: ${results.cctp ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  if (testMode === '--all' || testMode === '--quote-only') {
    console.log(`   Swap Quote: ${results.quote ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  if (testMode === '--full-swap') {
    console.log(`   Full Swap: ${results.fullSwap ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  console.log('\n');
  
  // Recommendations
  if (!results.cctp && (testMode === '--all' || testMode === '--cctp-only')) {
    console.log('💡 CCTP Tips:');
    console.log('   - Ensure you have USDC on source chain');
    console.log('   - Check PRIVATE_KEY in .env');
    console.log('   - Verify RPC endpoints are accessible\n');
  }
  
  if (!results.quote && (testMode === '--all' || testMode === '--quote-only')) {
    console.log('💡 Quote Tips:');
    console.log('   - Pool may not exist on Unichain yet');
    console.log('   - Run: node scripts/setup-uniswap-pool.js');
    console.log('   - Try different token pairs\n');
  }
  
  console.log('📚 Usage:');
  console.log('   node scripts/test-phase2.js              # Run safe tests');
  console.log('   node scripts/test-phase2.js --cctp-only  # Test CCTP only');
  console.log('   node scripts/test-phase2.js --quote-only # Test quotes only');
  console.log('   node scripts/test-phase2.js --full-swap  # Full swap (uses gas!)\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  });
