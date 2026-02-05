const { ethers } = require('hardhat');

const SWAP_CONTRACT = '0xf398e521dda27C1Ff8102A00D856b127037eA130';

// Sepolia testnet token addresses
const TOKENS = {
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  DAI: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357'
};

async function addTokenLiquidity() {
  console.log('💰 Adding Token Liquidity to SimpleSwap\n');
  console.log('Contract:', SWAP_CONTRACT);
  
  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log('ETH Balance:', ethers.formatEther(balance), 'ETH\n');
  
  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function mint(address to, uint256 amount) returns (bool)'
  ];
  
  const swapAbi = [
    'function addLiquidity(address token, uint256 amount) external'
  ];
  
  const swapContract = new ethers.Contract(SWAP_CONTRACT, swapAbi, signer);
  
  console.log('📊 Checking token balances:\n');
  
  for (const [symbol, address] of Object.entries(TOKENS)) {
    const token = new ethers.Contract(address, erc20Abi, signer);
    
    try {
      const decimals = await token.decimals();
      const myBalance = await token.balanceOf(signer.address);
      const contractBalance = await token.balanceOf(SWAP_CONTRACT);
      
      console.log(`${symbol}:`);
      console.log(`  Your balance: ${ethers.formatUnits(myBalance, decimals)}`);
      console.log(`  Contract balance: ${ethers.formatUnits(contractBalance, decimals)}`);
      
      // Try to mint tokens if possible (some testnet tokens have public mint)
      if (myBalance === 0n) {
        try {
          console.log(`  ⚠️  Attempting to mint ${symbol}...`);
          const mintAmount = ethers.parseUnits('10000', decimals); // Mint 10,000 tokens
          const mintTx = await token.mint(signer.address, mintAmount);
          await mintTx.wait();
          console.log(`  ✅ Minted 10,000 ${symbol}`);
        } catch (error) {
          console.log(`  ❌ Cannot mint ${symbol} (not mintable or requires permission)`);
        }
      }
      
      // Transfer tokens to contract if we have some
      const updatedBalance = await token.balanceOf(signer.address);
      if (updatedBalance > 0n) {
        // Transfer 90% of balance to contract, keep 10% for gas/testing
        const transferAmount = (updatedBalance * 90n) / 100n;
        
        console.log(`  📤 Transferring ${ethers.formatUnits(transferAmount, decimals)} ${symbol} to contract...`);
        const transferTx = await token.transfer(SWAP_CONTRACT, transferAmount);
        await transferTx.wait();
        console.log(`  ✅ Transfer complete`);
      }
      
      console.log();
      
    } catch (error) {
      console.log(`  ❌ Error checking ${symbol}:`, error.message);
      console.log();
    }
  }
  
  console.log('\n📋 Final Contract Balances:');
  for (const [symbol, address] of Object.entries(TOKENS)) {
    const token = new ethers.Contract(address, erc20Abi, signer);
    try {
      const decimals = await token.decimals();
      const contractBalance = await token.balanceOf(SWAP_CONTRACT);
      console.log(`  ${symbol}: ${ethers.formatUnits(contractBalance, decimals)}`);
    } catch (error) {
      console.log(`  ${symbol}: Error -`, error.message);
    }
  }
  
  console.log('\n💡 If balances are still 0, you need to:');
  console.log('   1. Get testnet tokens from faucets:');
  console.log('      - USDC Sepolia: https://faucet.circle.com/');
  console.log('      - Or use Uniswap Sepolia faucet');
  console.log('   2. Run this script again to transfer to contract');
}

addTokenLiquidity()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
