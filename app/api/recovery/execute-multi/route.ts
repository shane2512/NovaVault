import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

/**
 * Multi-Network Recovery Execution
 * 
 * This endpoint aggregates funds from all networks during recovery:
 * 
 * USDC Funds Flow:
 * 1. Old Wallet (ETH-SEPOLIA) USDC → Bridge Kit → Arc → New Wallet
 * 2. Old Wallet (MATIC-AMOY) USDC → Bridge Kit → Arc → New Wallet
 * 3. Old Wallet (ARC-TESTNET) USDC → Direct transfer → New Wallet
 * 
 * Non-USDC Funds Flow:
 * 1. Old Wallet (Network) Non-USDC → Uniswap → USDC
 * 2. USDC → Bridge Kit → Arc → New Wallet
 * 3. New Wallet (Arc) → Send to respective networks
 * 4. Each network: USDC → Uniswap → Original token
 */

interface NetworkBalance {
  blockchain: string;
  address: string;
  usdcBalance: string;
  nativeBalance: string;
  tokens: Array<{ symbol: string; balance: string; address: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      namehash, 
      oldWalletNetworks, // Array of NetworkBalance[]
      newWalletAddress,  // New wallet address on Arc
      ensName 
    } = await request.json();

    if (!namehash || !oldWalletNetworks || !newWalletAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('🔄 Starting multi-network recovery execution...');
    console.log(`   ENS: ${ensName}`);
    console.log(`   Old wallet networks: ${oldWalletNetworks.length}`);
    console.log(`   New wallet address: ${newWalletAddress}`);

    const results = {
      phase1: { status: 'pending', message: '' },
      phase2: { status: 'pending', message: '', networks: [] as any[] },
      phase3: { status: 'pending', message: '', networks: [] as any[] },
      phase4: { status: 'pending', message: '', redistributions: [] as any[] },
    };

    // ============================================
    // PHASE 1: Execute RecoveryController
    // ============================================
    console.log('\n📋 Phase 1: Executing RecoveryController...');
    try {
      const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
      const executor = new ethers.Wallet(process.env.RECOVERY_EXECUTOR_PRIVATE_KEY!, provider);
      
      const RecoveryControllerABI = [
        'function executeRecovery(bytes32 namehash) external'
      ];
      const RecoveryController = new ethers.Contract(
        process.env.RECOVERY_CONTROLLER_ADDRESS!,
        RecoveryControllerABI,
        executor
      );

      const tx = await RecoveryController.executeRecovery(namehash);
      const receipt = await tx.wait();

      results.phase1 = {
        status: 'completed',
        message: 'Recovery executed on-chain',
      };
      console.log('✅ Phase 1 complete:', receipt.hash);
    } catch (error: any) {
      results.phase1 = {
        status: 'failed',
        message: error.message,
      };
      throw new Error(`Phase 1 failed: ${error.message}`);
    }

    // ============================================
    // PHASE 2: Aggregate USDC from all networks
    // ============================================
    console.log('\n💵 Phase 2: Aggregating USDC from all networks...');
    
    for (const network of oldWalletNetworks) {
      try {
        if (parseFloat(network.usdcBalance) > 0) {
          console.log(`   Bridging ${network.usdcBalance} USDC from ${network.blockchain}...`);

          // Call Bridge Kit API
          const bridgeResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/bridge/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromChain: network.blockchain,
              toChain: 'ARC-TESTNET',
              amount: network.usdcBalance,
              fromAddress: network.address,
              toAddress: newWalletAddress,
            }),
          });

          const bridgeData = await bridgeResponse.json();
          
          results.phase2.networks.push({
            blockchain: network.blockchain,
            amount: network.usdcBalance,
            status: bridgeData.success ? 'completed' : 'failed',
            txHash: bridgeData.txHash,
            attestation: bridgeData.attestation,
          });

          console.log(`   ✅ ${network.blockchain}: ${bridgeData.txHash}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed to bridge from ${network.blockchain}:`, error.message);
        results.phase2.networks.push({
          blockchain: network.blockchain,
          status: 'failed',
          error: error.message,
        });
      }
    }

    results.phase2.status = 'completed';
    results.phase2.message = `Aggregated USDC from ${results.phase2.networks.filter(n => n.status === 'completed').length} networks`;
    console.log('✅ Phase 2 complete');

    // ============================================
    // PHASE 3: Swap non-USDC tokens to USDC
    // ============================================
    console.log('\n🔄 Phase 3: Converting non-USDC tokens...');

    for (const network of oldWalletNetworks) {
      for (const token of network.tokens) {
        if (token.symbol !== 'USDC' && parseFloat(token.balance) > 0) {
          try {
            console.log(`   Swapping ${token.balance} ${token.symbol} on ${network.blockchain}...`);

            // Call Uniswap API
            const swapResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/swap/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                blockchain: network.blockchain,
                fromToken: token.address,
                toToken: 'USDC',
                amount: token.balance,
                walletAddress: network.address,
              }),
            });

            const swapData = await swapResponse.json();

            if (swapData.success) {
              // Bridge the swapped USDC to Arc
              const bridgeResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/bridge/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fromChain: network.blockchain,
                  toChain: 'ARC-TESTNET',
                  amount: swapData.outputAmount,
                  fromAddress: network.address,
                  toAddress: newWalletAddress,
                }),
              });

              const bridgeData = await bridgeResponse.json();

              results.phase3.networks.push({
                blockchain: network.blockchain,
                token: token.symbol,
                amount: token.balance,
                usdcAmount: swapData.outputAmount,
                swapTx: swapData.txHash,
                bridgeTx: bridgeData.txHash,
                status: 'completed',
              });

              console.log(`   ✅ ${token.symbol} → USDC → Arc: ${bridgeData.txHash}`);
            }
          } catch (error: any) {
            console.error(`   ❌ Failed to swap ${token.symbol}:`, error.message);
            results.phase3.networks.push({
              blockchain: network.blockchain,
              token: token.symbol,
              status: 'failed',
              error: error.message,
            });
          }
        }
      }
    }

    results.phase3.status = 'completed';
    results.phase3.message = `Converted ${results.phase3.networks.filter(n => n.status === 'completed').length} tokens`;
    console.log('✅ Phase 3 complete');

    // ============================================
    // PHASE 4: Redistribute to original networks (optional)
    // ============================================
    console.log('\n📤 Phase 4: Redistributing to networks (optional)...');
    
    // This is optional - user may want to keep everything on Arc
    // For now, we'll skip this and let the user manually redistribute if needed
    
    results.phase4.status = 'skipped';
    results.phase4.message = 'All funds aggregated on Arc Network. Use wallet to redistribute if needed.';
    console.log('📋 Phase 4 skipped (manual redistribution)');

    console.log('\n✨ Multi-network recovery complete!');

    return NextResponse.json({
      success: true,
      message: 'Recovery executed across all networks',
      results,
      summary: {
        totalNetworks: oldWalletNetworks.length,
        usdcBridged: results.phase2.networks.filter(n => n.status === 'completed').length,
        tokensConverted: results.phase3.networks.filter(n => n.status === 'completed').length,
        newWalletAddress,
      },
    });

  } catch (error: any) {
    console.error('❌ Multi-network recovery failed:', error);
    return NextResponse.json(
      {
        error: 'Multi-network recovery execution failed',
        message: error.message,
        details: error,
      },
      { status: 500 }
    );
  }
}
