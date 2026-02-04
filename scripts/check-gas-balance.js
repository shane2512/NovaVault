const { ethers } = require('ethers');

async function checkBalances() {
  const address = '0x5f90f52ffdc875a8d93021c76d2e612a6459df63';
  const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const rpcUrl = 'https://ethereum-sepolia-rpc.publicnode.com';

  console.log('Checking balances for:', address);
  console.log('---');

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    // Check Sepolia ETH balance
    const ethBalance = await provider.getBalance(address);
    console.log('Sepolia ETH Balance:', ethers.formatEther(ethBalance), 'ETH');
    
    if (parseFloat(ethers.formatEther(ethBalance)) === 0) {
      console.log('❌ NO GAS! You need Sepolia ETH to pay for transaction fees.');
      console.log('Get Sepolia ETH from:');
      console.log('  - https://sepoliafaucet.com/');
      console.log('  - https://www.alchemy.com/faucets/ethereum-sepolia');
    } else {
      console.log('✅ Gas available');
    }
    console.log('---');

    // Check USDC balance
    const usdcContract = new ethers.Contract(
      usdcAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    
    const usdcBalance = await usdcContract.balanceOf(address);
    console.log('USDC Balance:', ethers.formatUnits(usdcBalance, 6), 'USDC');
    
    if (parseFloat(ethers.formatUnits(usdcBalance, 6)) > 0) {
      console.log('✅ USDC available');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBalances();
