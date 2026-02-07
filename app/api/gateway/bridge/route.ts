/**
 * Gateway Bridge API Route
 * POST /api/gateway/bridge
 */

import { NextRequest, NextResponse } from 'next/server';
import { bridgeViaGateway, type GatewaySupportedChain } from '@/lib/services/circleGatewayBridge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { circleWalletId, sourceChain, destChain, amount, recipientAddress } = body;

    // Validate required fields
    if (!circleWalletId || !sourceChain || !destChain || !amount || !recipientAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🌉 Gateway Bridge Request:');
    console.log(`   Wallet: ${circleWalletId}`);
    console.log(`   Route: ${sourceChain} → ${destChain}`);
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Recipient: ${recipientAddress}`);

    // Execute Gateway bridge
    const result = await bridgeViaGateway({
      circleWalletId,
      sourceChain: sourceChain as GatewaySupportedChain,
      destChain: destChain as GatewaySupportedChain,
      amount,
      recipientAddress,
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: 'USDC deposited to Gateway unified balance. Instant minting available on any supported chain.',
    });

  } catch (error: any) {
    console.error('❌ Gateway bridge error:', error);
    return NextResponse.json(
      {
        error: 'Gateway bridge failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
