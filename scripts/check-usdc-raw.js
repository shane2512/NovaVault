const { ethers } = require('ethers');

async function checkBalance() {
  const address = '0x5f90f52ffdc875a8d93021c76d2e612a6459df63';
  const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const rpcUrl = 'https://rpc2.sepolia.org';

  console.log('Checking USDC balance...');
  console.log('Wallet:', address);
  console.log('USDC Contract:', usdcAddress);
  console.log('RPC:', rpcUrl);
  console.log('---');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const usdcContract = new ethers.Contract(
    usdcAddress,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );

  try {
    const balance = await usdcContract.balanceOf(address);
    console.log('Raw balance (base units):', balance.toString());
    console.log('Formatted (with 6 decimals):', ethers.formatUnits(balance, 6), 'USDC');
    console.log('---');
    console.log('Expected display value:', balance.toString(), 'USDC (raw base units)');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkBalance();
