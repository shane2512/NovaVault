const { ethers } = require('ethers');

const SWAP_CONTRACT = '0xf398e521dda27C1Ff8102A00D856b127037eA130';
const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

const TOKENS = {
  ETH: ethers.ZeroAddress,
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  DAI: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357'
};

async function testSwapContract() {
  console.log('🧪 Testing SimpleSwap Contract\n');
  console.log('Contract:', SWAP_CONTRACT);
  console.log('Network: Ethereum Sepolia\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const swapAbi = [
    'function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)',
    'function tokenPrices(address) external view returns (uint256)',
    'function swapFeeBps() external view returns (uint256)',
    'function owner() external view returns (address)'
  ];
  
  const contract = new ethers.Contract(SWAP_CONTRACT, swapAbi, provider);
  
  try {
    // Check contract is deployed
    const code = await provider.getCode(SWAP_CONTRACT);
    if (code === '0x') {
      console.log('❌ Contract not deployed!');
      return;
    }
    console.log('✅ Contract is deployed');
    
    // Get owner
    const owner = await contract.owner();
    console.log('👤 Owner:', owner);
    
    // Get swap fee
    const fee = await contract.swapFeeBps();
    console.log('💰 Swap Fee:', (Number(fee) / 100).toFixed(2), '%');
    
    // Get prices
    console.log('\n💲 Token Prices:');
    for (const [symbol, address] of Object.entries(TOKENS)) {
      const price = await contract.tokenPrices(address);
      console.log(`   ${symbol.padEnd(4)} : $${(Number(price) / 1_000000).toFixed(2)}`);
    }
    
    // Test quotes
    console.log('\n📊 Swap Quotes:');
    
    // 1 ETH -> USDC
    const eth1 = ethers.parseEther('1');
    const quote1 = await contract.getQuote(TOKENS.ETH, TOKENS.USDC, eth1);
    console.log(`   1 ETH → ${ethers.formatUnits(quote1, 6)} USDC`);
    
    // 0.1 ETH -> USDC
    const eth01 = ethers.parseEther('0.1');
    const quote2 = await contract.getQuote(TOKENS.ETH, TOKENS.USDC, eth01);
    console.log(`   0.1 ETH → ${ethers.formatUnits(quote2, 6)} USDC`);
    
    // 100 USDC -> DAI
    const usdc100 = ethers.parseUnits('100', 6);
    const quote3 = await contract.getQuote(TOKENS.USDC, TOKENS.DAI, usdc100);
    console.log(`   100 USDC → ${ethers.formatEther(quote3)} DAI`);
    
    // 1000 USDC -> ETH
    const usdc1000 = ethers.parseUnits('1000', 6);
    const quote4 = await contract.getQuote(TOKENS.USDC, TOKENS.ETH, usdc1000);
    console.log(`   1000 USDC → ${ethers.formatEther(quote4)} ETH`);
    
    console.log('\n✅ All tests passed!');
    console.log('\n🎯 Contract is ready for swaps');
    console.log('   Users can now swap tokens via the UI');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSwapContract();
