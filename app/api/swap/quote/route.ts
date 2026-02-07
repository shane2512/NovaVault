import { NextRequest, NextResponse } from 'next/server';
import { getLocalSwapQuote } from '@/lib/services/localSwapService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenIn, tokenOut, amountIn, currentNetwork } = body;

    if (!tokenIn || !tokenOut || !amountIn) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get swap quote from local DEX
    const quote = await getLocalSwapQuote(
      tokenIn,
      tokenOut,
      amountIn,
      currentNetwork || 'ETH-SEPOLIA'
    );

    return NextResponse.json({
      success: true,
      ...quote
    });

  } catch (error: any) {
    console.error('Quote error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get quote',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
