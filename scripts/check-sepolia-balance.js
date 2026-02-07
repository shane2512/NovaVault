// Check Sepolia USDC Balance
const { ethers } = require('ethers');
require('dotenv').config();

async function checkSepoliaBalance() {
  console.log('🔍 Checking Sepolia USDC Balance...\n');

  const walletAddress = '0x5f90f52ffdc875a8d93021c76d2e612a6459df63';
  const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // USDC on Sepolia

  try {
    // Try multiple Sepolia RPC endpoints
    const rpcUrls = [
      'https://eth-sepolia.api.onfinality.io/public',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://rpc.sentio.xyz/sepolia',
      'https://ethereum-sepolia-public.nodies.app',
      'https://ethereum-sepolia.rpc.subquery.network/public',
      'https://sepolia.drpc.org',
      'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    ];

    let provider;
    let connected = false;

    for (const rpc of rpcUrls) {
      try {
        console.log(`Trying RPC: ${rpc}...`);
        provider = new ethers.JsonRpcProvider(rpc);
        await provider.getBlockNumber();
        console.log(`✅ Connected to Sepolia\n`);
        connected = true;
        break;
      } catch (err) {
        console.log(`❌ Failed, trying next...\n`);
      }
    }

    if (!connected) {
      throw new Error('Could not connect to any Sepolia RPC');
    }

    // Get ETH balance
    const ethBalance = await provider.getBalance(walletAddress);
    console.log(`Wallet Address: ${walletAddress}`);
    console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH\n`);

    // Get USDC balance
    const usdcContract = new ethers.Contract(
      usdcAddress,
      [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
      ],
      provider
    );

    const balance = await usdcContract.balanceOf(walletAddress);
    const decimals = await usdcContract.decimals();
    const symbol = await usdcContract.symbol();

    console.log(`Token Contract: ${usdcAddress}`);
    console.log(`Token Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Raw Balance: ${balance.toString()}`);
    console.log(`\n🎯 USDC Balance: ${ethers.formatUnits(balance, decimals)} ${symbol}\n`);

    // Check if this is the correct USDC
    console.log(`📝 Verify your transaction:`);
    console.log(`   - Go to: https://sepolia.etherscan.io/address/${walletAddress}`);
    console.log(`   - Check token transfers for USDC`);
    console.log(`   - Verify USDC contract: ${usdcAddress}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSepoliaBalance();
