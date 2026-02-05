import { NextRequest, NextResponse } from 'next/server';
import { transferUSDCViaBridgeKit } from '@/lib/services/bridgeKitService';
import { sendUSDCToChain } from '@/lib/services/crossChainService';

// Bridge Kit only supports these chains
const BRIDGE_KIT_CHAINS = ['ETH-SEPOLIA', 'MATIC-AMOY', 'UNICHAIN-SEPOLIA'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceChain, destinationChain, amount, recipient } = body;

    // Validate inputs
    if (!sourceChain || !destinationChain || !amount || !recipient) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Bridge request:', { sourceChain, destinationChain, amount, recipient });

    // Route to appropriate service based on chain support
    const usesBridgeKit = 
      BRIDGE_KIT_CHAINS.includes(sourceChain) && 
      BRIDGE_KIT_CHAINS.includes(destinationChain);

    if (usesBridgeKit) {
      // Use Circle Bridge Kit SDK for supported chains
      console.log('Using Bridge Kit SDK');
      const result = await transferUSDCViaBridgeKit({
        sourceChain: sourceChain as any,
        destinationChain: destinationChain as any,
        amount,
        recipient
      });
      
      return NextResponse.json({
        success: true,
        method: 'bridge-kit',
        ...result
      });
    } else {
      // Use manual CCTP for Arc Testnet and other chains
      console.log('Using manual CCTP');
      const result = await sendUSDCToChain({
        sourceChain: sourceChain as any,
        destinationChain: destinationChain as any,
        amount,
        recipient
      });
      
      return NextResponse.json({
        success: true,
        method: 'manual-cctp',
        burnTxHash: result.burnTxHash,
        mintTxHash: result.mintTxHash,
        operationId: result.attestationId,
        status: result.status
      });
    }

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Bridge error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Bridge failed',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
