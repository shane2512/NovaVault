import { NextRequest, NextResponse } from 'next/server';
import { transferUSDCToArc } from '@/lib/services/circleCCTPManual';

/**
 * API Route: Manual CCTP Bridge (Sepolia → Arc)
 * 
 * POST /api/cctp/manual-bridge
 * 
 * Uses Circle's manual CCTP integration to transfer USDC from Sepolia to Arc
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sepoliaWalletId, arcWalletId, amount, destinationAddress } = body;

    // Validate inputs
    if (!sepoliaWalletId || !arcWalletId || !amount || !destinationAddress) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters',
          required: ['sepoliaWalletId', 'arcWalletId', 'amount', 'destinationAddress']
        },
        { status: 400 }
      );
    }

    console.log('🌉 Starting CCTP transfer...');
    console.log(`   Sepolia Wallet: ${sepoliaWalletId}`);
    console.log(`   Arc Wallet: ${arcWalletId}`);
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Destination: ${destinationAddress}`);

    // Execute the transfer using manual CCTP integration
    const result = await transferUSDCToArc({
      walletId: sepoliaWalletId,
      arcWalletId: arcWalletId,
      amount,
      destinationAddress,
    });

    console.log('✅ CCTP transfer successful!');
    console.log(`   Burn TX: ${result.burnTxHash}`);
    console.log(`   Mint TX: ${result.mintTxHash}`);

    return NextResponse.json({
      success: true,
      ...result,
      sourceChain: 'ETH-SEPOLIA',
      destChain: 'ARC-TESTNET',
      method: 'manual-cctp',
      explorerUrls: {
        burn: `https://sepolia.etherscan.io/tx/${result.burnTxHash}`,
        mint: `https://testnet.arcscan.net/tx/${result.mintTxHash}`,
      }
    });

  } catch (error: any) {
    console.error('❌ CCTP transfer failed:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'CCTP transfer failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
