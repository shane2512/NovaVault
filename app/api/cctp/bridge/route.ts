import { NextRequest, NextResponse } from 'next/server';
import { bridgeUSDCFromCircleWallet, type SupportedChain } from '@/lib/services/circleCCTPBridge';

/**
 * CCTP Bridge API Route - Direct Circle Wallet Integration
 * 
 * Uses Circle's Developer-Controlled Wallets SDK to interact directly with
 * CCTP contracts (TokenMessenger). This approach:
 * 
 * 1. Works with Circle MPC wallets (no private keys needed)
 * 2. Calls CCTP contracts directly using Circle's createTransaction API
 * 3. Two-step process:
 *    - Step 1: Approve USDC spend to TokenMessenger
 *    - Step 2: Call depositForBurn (burns USDC + starts CCTP)
 * 4. Circle automatically attests and mints on destination (~10-20 minutes)
 * 
 * NO bridge wallet needed - everything uses your Circle wallet!
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceChain, destinationChain, amount, recipient, circleWalletId } = body;

    console.log('🌉 Circle CCTP Bridge request:', { sourceChain, destinationChain, amount, recipient, circleWalletId });

    // Validate inputs
    if (!sourceChain || !destinationChain || !amount || !recipient) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!circleWalletId) {
      return NextResponse.json(
        { error: 'Circle wallet ID required for bridging' },
        { status: 400 }
      );
    }

    if (sourceChain === destinationChain) {
      return NextResponse.json(
        { error: 'Source and destination chains must be different' },
        { status: 400 }
      );
    }

    // Check Circle API credentials
    if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
      return NextResponse.json(
        {
          error: 'Circle API not configured',
          details: 'CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET required in .env.local'
        },
        { status: 500 }
      );
    }

    // Execute CCTP bridge using Circle wallet
    console.log('Using Circle Programmable Wallets SDK for CCTP bridging...');
    const result = await bridgeUSDCFromCircleWallet({
      circleWalletId,
      sourceChain: sourceChain as SupportedChain,
      destChain: destinationChain as SupportedChain,
      amount,
      recipientAddress: recipient,
    });

    
    // Generate explorer URLs (already in result but enhance response)
    const explorerBases: Record<string, string> = {
      'ETH-SEPOLIA': 'https://sepolia.etherscan.io',
      'MATIC-AMOY': 'https://amoy.polygonscan.com',
      'ARC-TESTNET': 'https://testnet.arcscan.app',
    };
    
    const burnExplorerUrl = result.burnTxHash
      ? `${explorerBases[sourceChain as string] || 'https://sepolia.etherscan.io'}/tx/${result.burnTxHash}`
      : undefined;
    
    console.log('✅ CCTP bridge initiated from Circle wallet!');
    console.log(`   Step 1 (Approve): ${result.steps.step1.txId}`);
    console.log(`   Step 2 (Burn): ${result.steps.step2.txId}`);
    console.log(`   Burn TX Hash: ${result.burnTxHash}`);
    console.log(`   Explorer: ${burnExplorerUrl}`);

    return NextResponse.json({
      success: true,
      method: 'circle-cctp-direct',
      message: 'CCTP bridge initiated from Circle wallet! USDC will mint on destination chain in 10-20 minutes.',
      steps: result.steps,
      burnTxHash: result.burnTxHash,
      burnExplorerUrl,
      operationId: result.operationId,
      estimatedTime: result.estimatedTime,
      explorerUrls: {
        burn: burnExplorerUrl,
      },
      note: 'No bridge wallet needed - all transactions from your Circle wallet!',
    });

  } catch (error: any) {
    console.error('❌ Bridge error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Bridge failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
