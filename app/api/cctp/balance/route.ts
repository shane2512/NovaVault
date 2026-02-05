import { NextRequest, NextResponse } from 'next/server';
import { getCrossChainBalance } from '@/lib/services/crossChainService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    console.log('Fetching cross-chain balance for:', address);

    // Get balances across all chains
    const balance = await getCrossChainBalance(address);

    return NextResponse.json({
      success: true,
      ...balance
    });

  } catch (error: any) {
    console.error('Balance fetch error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch balance',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
