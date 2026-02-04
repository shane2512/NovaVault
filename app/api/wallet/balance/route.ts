// API route to get wallet balance
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const blockchain = searchParams.get('blockchain');

  if (!address || !blockchain) {
    return NextResponse.json(
      { error: 'Missing address or blockchain parameter' },
      { status: 400 }
    );
  }

  try {
    // Map blockchain to RPC URL
    const rpcUrls: Record<string, string> = {
      'ETH-SEPOLIA': process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
      'MATIC-AMOY': 'https://rpc-amoy.polygon.technology',
      'ARC-TESTNET': process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
    };

    const rpcUrl = rpcUrls[blockchain] || rpcUrls['ETH-SEPOLIA'];
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
      batchMaxCount: 1,
    });

    // Get native balance (ETH, MATIC, etc.) with timeout
    const balancePromise = provider.getBalance(address);
    const balance = await Promise.race([
      balancePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]) as bigint;
    const formattedBalance = ethers.formatEther(balance);

    // Get USDC balance if on supported network
    let usdcBalance = '0';
    const usdcAddresses: Record<string, string> = {
      'ETH-SEPOLIA': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Sepolia
      'MATIC-AMOY': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // USDC on Amoy
      'ARC-TESTNET': '0x3600000000000000000000000000000000000000', // USDC on Arc Testnet
    };

    if (usdcAddresses[blockchain]) {
      const usdcContract = new ethers.Contract(
        usdcAddresses[blockchain],
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );
      
      try {
        const usdcBalPromise = usdcContract.balanceOf(address);
        const usdcBal = await Promise.race([
          usdcBalPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]) as bigint;
        usdcBalance = ethers.formatUnits(usdcBal, 6); // USDC has 6 decimals
      } catch (error) {
        console.error('Failed to fetch USDC balance:', error);
      }
    }

    return NextResponse.json({
      address,
      blockchain,
      nativeBalance: formattedBalance,
      balance: usdcBalance,
      symbol: blockchain.startsWith('ETH') ? 'ETH' : blockchain.startsWith('MATIC') ? 'MATIC' : 'ETH',
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
