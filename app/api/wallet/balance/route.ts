// API route to get wallet balance
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const blockchain = searchParams.get('blockchain');

  console.log(`\n💰 Balance request: ${blockchain} - ${address}`);

  if (!address || !blockchain) {
    return NextResponse.json(
      { error: 'Missing address or blockchain parameter' },
      { status: 400 }
    );
  }

  try {
    // Map blockchain to RPC URL with fallbacks and network configs
    const networkConfigs: Record<string, { rpcs: string[], chainId: number }> = {
      'ETH-SEPOLIA': {
        rpcs: [
          'https://eth-sepolia.api.onfinality.io/public',
          'https://ethereum-sepolia-rpc.publicnode.com',
          'https://rpc.sentio.xyz/sepolia',
          'https://ethereum-sepolia-public.nodies.app',
          'https://ethereum-sepolia.rpc.subquery.network/public',
          'https://sepolia.drpc.org'
        ],
        chainId: 11155111
      },
      'MATIC-AMOY': {
        rpcs: [
          'https://rpc-amoy.polygon.technology',
          'https://polygon-amoy.drpc.org'
        ],
        chainId: 80002
      },
      'ARC-TESTNET': {
        rpcs: [
          process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network'
        ],
        chainId: 4734
      },
    };

    const networkConfig = networkConfigs[blockchain] || networkConfigs['ETH-SEPOLIA'];
    
    // Try each RPC URL until one works
    let provider: ethers.JsonRpcProvider | null = null;
    let lastError: Error | null = null;
    
    for (const rpcUrl of networkConfig.rpcs) {
      try {
        console.log(`   Trying RPC: ${rpcUrl}`);
        // Create provider with explicit network to prevent auto-detection
        const network = ethers.Network.from({
          name: blockchain.toLowerCase(),
          chainId: networkConfig.chainId
        });
        
        provider = new ethers.JsonRpcProvider(rpcUrl, network, {
          staticNetwork: network,
          batchMaxCount: 1,
        });
        
        // Test the connection with a balance query directly
        await Promise.race([
          provider.getBalance(address),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000))
        ]);
        console.log(`   ✅ Connected to ${rpcUrl}`);
        break; // Connection successful
      } catch (err) {
        console.log(`   ❌ Failed: ${(err as Error).message}`);
        lastError = err as Error;
        provider = null;
        continue; // Try next RPC
      }
    }
    
    if (!provider) {
      console.error(`❌ All RPC endpoints failed for ${blockchain}`);
      console.error(`   Last error: ${lastError?.message}`);
      // Return zero balance instead of throwing error
      return NextResponse.json({
        address,
        blockchain,
        balance: '0',
        nativeBalance: '0',
        symbol: blockchain.includes('ETH') ? 'ETH' : blockchain.includes('MATIC') ? 'MATIC' : 'ETH',
        error: 'RPC connection failed',
      });
    }

    // Get native balance (ETH, MATIC, etc.) with timeout
    console.log(`   Fetching native balance...`);
    const balancePromise = provider.getBalance(address);
    const balance = await Promise.race([
      balancePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))
    ]) as bigint;
    const formattedBalance = ethers.formatEther(balance);
    console.log(`   Native balance: ${formattedBalance}`);

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
        console.log(`   Fetching USDC balance from ${usdcAddresses[blockchain]}...`);
        const usdcBalPromise = usdcContract.balanceOf(address);
        const usdcBal = await Promise.race([
          usdcBalPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]) as bigint;
        usdcBalance = ethers.formatUnits(usdcBal, 6); // USDC has 6 decimals
        console.log(`   USDC balance: ${usdcBalance}`);
      } catch (error) {
        console.error(`   ❌ Failed to fetch USDC balance:`, (error as Error).message);
      }
    }

    console.log(`✅ Balance fetch complete: ${usdcBalance} USDC, ${formattedBalance} native\n`);
    
    return NextResponse.json({
      address,
      blockchain,
      nativeBalance: formattedBalance,
      balance: usdcBalance,
      symbol: blockchain.startsWith('ETH') ? 'ETH' : blockchain.startsWith('MATIC') ? 'MATIC' : 'ETH',
    });
  } catch (error) {
    console.error('❌ Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance', message: (error as Error).message },
      { status: 500 }
    );
  }
}
