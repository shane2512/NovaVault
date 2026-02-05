/**
 * Test Cross-Chain USDC Transfer
 * 
 * Tests the complete CCTP flow:
 * 1. Get unified balance across all chains
 * 2. Transfer USDC from one chain to another
 * 3. Monitor transfer status
 */

import { sendUSDCToChain, getCrossChainBalance } from '../lib/services/crossChainService.js';

const WALLET_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS || '0x5f90f52ffdc875a8d93021c76d2e612a6459df63';

async function testUnifiedBalance() {
  console.log('🔍 Testing Unified Balance...\n');
  
  try {
    const balance = await getCrossChainBalance(WALLET_ADDRESS);
    
    console.log('✅ Total USDC:', balance.total);
    console.log('\n📊 Breakdown:');
    balance.breakdown.forEach(item => {
      console.log(`   ${item.chain}: ${item.balance} USDC`);
    });
    console.log('');
    
    return balance;
  } catch (error) {
    console.error('❌ Failed to get unified balance:', error.message);
    throw error;
  }
}

async function testCrossChainTransfer() {
  console.log('🌉 Testing Cross-Chain Transfer...\n');
  
  const sourceChain = 'ETH-SEPOLIA';
  const destinationChain = 'ARC-TESTNET';
  const amount = '1'; // 1 USDC
  
  console.log('📋 Transfer Details:');
  console.log(`   From: ${sourceChain}`);
  console.log(`   To: ${destinationChain}`);
  console.log(`   Amount: ${amount} USDC`);
  console.log(`   Recipient: ${WALLET_ADDRESS}`);
  console.log('');
  
  try {
    console.log('⏳ Initiating transfer...\n');
    
    const result = await sendUSDCToChain({
      sourceChain,
      destinationChain,
      amount,
      recipient: WALLET_ADDRESS
    });
    
    console.log('✅ Transfer completed!');
    console.log('');
    console.log('📝 Transaction Details:');
    console.log(`   Burn TX: ${result.burnTxHash}`);
    console.log(`   Mint TX: ${result.mintTxHash}`);
    console.log(`   Attestation: ${result.attestationId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Estimated Time: ${result.estimatedTime}s`);
    console.log('');
    
    return result;
  } catch (error) {
    console.error('❌ Transfer failed:', error.message);
    console.error('');
    console.error('💡 Common Issues:');
    console.error('   - Insufficient USDC balance on source chain');
    console.error('   - Insufficient gas (ETH) for transaction');
    console.error('   - CCTP contract addresses not configured');
    console.error('   - Private key not set in .env');
    console.error('');
    throw error;
  }
}

async function main() {
  console.log('🧪 Cross-Chain Service Test\n');
  console.log('═'.repeat(50));
  console.log('');
  
  // Test 1: Get unified balance
  await testUnifiedBalance();
  
  console.log('═'.repeat(50));
  console.log('');
  
  // Test 2: Cross-chain transfer (optional - requires funds)
  const shouldTestTransfer = process.argv.includes('--transfer');
  
  if (shouldTestTransfer) {
    await testCrossChainTransfer();
    
    console.log('═'.repeat(50));
    console.log('');
    
    // Wait and check balance again
    console.log('⏳ Waiting 30 seconds for transaction to settle...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    await testUnifiedBalance();
  } else {
    console.log('ℹ️  Skipping transfer test (use --transfer to enable)');
    console.log('   This requires USDC and gas on the source chain');
    console.log('');
  }
  
  console.log('═'.repeat(50));
  console.log('');
  console.log('✅ All tests completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('');
    console.error('❌ Test suite failed');
    process.exit(1);
  });
