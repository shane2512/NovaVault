/**
 * Test USDC Balance Checker
 * 
 * Checks your USDC balance on all testnets before attempting transfers
 * 
 * USAGE:
 * node scripts/check-usdc-balance.js
 */

const { ethers } = require('ethers');
require('dotenv').config();

const NETWORKS = {
  'Ethereum Sepolia': {
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    explorer: 'https://sepolia.etherscan.io'
  },
  'Polygon Amoy': {
    rpc: 'https://rpc-amoy.polygon.technology',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    explorer: 'https://amoy.polygonscan.com'
  },
  'Arc Testnet': {
    rpc: 'https://rpc.testnet.arc.network',
    usdc: '0x3600000000000000000000000000000000000000',
    explorer: 'https://testnet.arcscan.net'
  },
  'Unichain Sepolia': {
    rpc: 'https://sepolia.unichain.org',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    explorer: 'https://sepolia.uniscan.xyz'
  }
};

async function checkBalance(network, config, address) {
  try {
    const provider = new ethers.JsonRpcProvider(config.rpc);
    
    // Get native balance
    const nativeBalance = await provider.getBalance(address);
    
    // Get USDC balance
    const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
    const usdc = new ethers.Contract(config.usdc, usdcAbi, provider);
    const usdcBalance = await usdc.balanceOf(address);
    
    return {
      network,
      native: ethers.formatEther(nativeBalance),
      usdc: ethers.formatUnits(usdcBalance, 6),
      explorer: config.explorer
    };
  } catch (error) {
    return {
      network,
      native: 'Error',
      usdc: 'Error',
      error: error.message,
      explorer: config.explorer
    };
  }
}

async function main() {
  console.log('💰 USDC Balance Checker\n');
  
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }
  
  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;
  
  console.log(`📋 Checking balances for: ${address}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let totalUSDC = 0;
  let hasAnyUSDC = false;
  
  for (const [network, config] of Object.entries(NETWORKS)) {
    console.log(`🔍 ${network}:`);
    const result = await checkBalance(network, config, address);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else {
      const usdcAmount = parseFloat(result.usdc);
      totalUSDC += usdcAmount;
      
      if (usdcAmount > 0) {
        hasAnyUSDC = true;
        console.log(`   ✅ Native: ${result.native}`);
        console.log(`   💵 USDC: ${result.usdc}`);
      } else {
        console.log(`   ⚠️  Native: ${result.native}`);
        console.log(`   ⚠️  USDC: ${result.usdc} (Need to get testnet USDC)`);
      }
      console.log(`   🔗 Explorer: ${result.explorer}/address/${address}`);
    }
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 Summary:`);
  console.log(`   Total USDC across all chains: ${totalUSDC.toFixed(6)}`);
  
  if (!hasAnyUSDC) {
    console.log('\n⚠️  No USDC found on any chain!');
    console.log('\n📝 Get testnet USDC:');
    console.log('   1. Visit: https://faucet.circle.com/');
    console.log('   2. Select network (Sepolia, Polygon Amoy, or Arc)');
    console.log('   3. Enter your address: ' + address);
    console.log('   4. Request USDC');
    console.log('   5. Wait ~1 minute for funds to arrive');
    console.log('   6. Run this script again to verify\n');
  } else {
    console.log('\n✅ You have USDC! Ready to test cross-chain transfers.\n');
  }
  
  console.log('💡 Tip: You need USDC on the SOURCE chain to bridge.');
  console.log('   For example, to bridge Arc → Unichain, you need USDC on Arc.\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
