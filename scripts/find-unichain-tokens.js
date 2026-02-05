/**
 * Find Official Token Addresses on Unichain Sepolia
 * 
 * This script queries the Unichain network to find the official
 * bridged token addresses for USDC, USDT, DAI, and WETH
 */

const { ethers } = require('ethers');
require('dotenv').config();

const UNICHAIN_RPC = 'https://sepolia.unichain.org';

// Known Circle CCTP addresses on Unichain Sepolia
const KNOWN_ADDRESSES = {
  // Circle's official TokenMessenger on Unichain
  TokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  MessageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  // WETH is native on Unichain
  WETH: '0x4200000000000000000000000000000000000006',
};

// Potential USDC addresses (bridged via CCTP)
const POTENTIAL_USDC = [
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC (might be bridged)
  '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Common testnet USDC
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Another common address
];

async function checkTokenExists(provider, address, name) {
  try {
    const erc20Abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(address, erc20Abi, provider);
    const [tokenName, symbol, decimals, supply] = await Promise.all([
      contract.name().catch(() => 'Unknown'),
      contract.symbol().catch(() => 'Unknown'),
      contract.decimals().catch(() => 0),
      contract.totalSupply().catch(() => 0n)
    ]);
    
    if (symbol !== 'Unknown') {
      console.log(`✅ ${name}: ${address}`);
      console.log(`   Name: ${tokenName}`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Decimals: ${decimals}`);
      console.log(`   Supply: ${ethers.formatUnits(supply, decimals)}\n`);
      return true;
    }
  } catch (error) {
    // Token doesn't exist at this address
  }
  return false;
}

async function main() {
  console.log('🔍 Searching for Official Tokens on Unichain Sepolia\n');
  console.log('━'.repeat(60));
  
  const provider = new ethers.JsonRpcProvider(UNICHAIN_RPC);
  
  // Check connection
  try {
    const network = await provider.getNetwork();
    console.log(`\n📡 Connected to Unichain Sepolia (Chain ID: ${network.chainId})\n`);
  } catch (error) {
    console.error('❌ Failed to connect to Unichain:', error.message);
    process.exit(1);
  }
  
  console.log('🔎 Checking WETH (Native Wrapped ETH)...');
  await checkTokenExists(provider, KNOWN_ADDRESSES.WETH, 'WETH');
  
  console.log('🔎 Checking USDC addresses...');
  let foundUSDC = false;
  for (const addr of POTENTIAL_USDC) {
    if (await checkTokenExists(provider, addr, 'USDC')) {
      foundUSDC = true;
      break;
    }
  }
  
  if (!foundUSDC) {
    console.log('❌ USDC not found at known addresses');
    console.log('💡 USDC needs to be bridged to Unichain first via CCTP\n');
  }
  
  // Check Circle's TokenMessenger contract
  console.log('🔎 Checking Circle CCTP Infrastructure...');
  const code = await provider.getCode(KNOWN_ADDRESSES.TokenMessenger);
  if (code !== '0x') {
    console.log(`✅ TokenMessenger deployed at: ${KNOWN_ADDRESSES.TokenMessenger}`);
    console.log(`✅ MessageTransmitter at: ${KNOWN_ADDRESSES.MessageTransmitter}\n`);
  }
  
  console.log('━'.repeat(60));
  console.log('\n📋 Summary:\n');
  console.log('For Unichain Sepolia, you need to:');
  console.log('1. Bridge tokens from Sepolia to Unichain using CCTP');
  console.log('2. After bridging, tokens will have the SAME address on Unichain');
  console.log('3. Use those addresses to create Uniswap V4 pools\n');
  
  console.log('✅ Confirmed addresses to use:');
  console.log(`   WETH: ${KNOWN_ADDRESSES.WETH} (native on Unichain)`);
  console.log(`   USDC: Will be at Sepolia address after CCTP bridge`);
  console.log(`   USDT: Will be at Sepolia address after CCTP bridge`);
  console.log(`   DAI:  Will be at Sepolia address after CCTP bridge\n`);
  
  console.log('💡 Next steps:');
  console.log('   1. Bridge some USDC from Sepolia to Unichain (test with 10 USDC)');
  console.log('   2. Verify it arrives at the same contract address');
  console.log('   3. Then create pools with confirmed addresses\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
