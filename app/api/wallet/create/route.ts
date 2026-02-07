import { NextRequest, NextResponse } from 'next/server';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const { blockchain, name } = await request.json();

    if (!blockchain) {
      return NextResponse.json(
        { error: 'Blockchain parameter is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Creating new Circle wallet...', { blockchain, name });

    // Create the wallet
    const response = await circleClient.createWallets({
      accountType: 'SCA',
      blockchains: [blockchain as any],
      count: 1,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID!,
    });

    if (!response.data?.wallets || response.data.wallets.length === 0) {
      console.error('❌ Failed to create wallet:', response);
      return NextResponse.json(
        { error: 'Failed to create wallet', details: response },
        { status: 500 }
      );
    }

    const wallet = response.data.wallets[0];

    console.log('✅ Wallet created successfully:', {
      id: wallet.id,
      address: wallet.address,
      blockchain: wallet.blockchain,
    });

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        name: name || `Wallet ${wallet.address.substring(0, 6)}`,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ Error creating wallet:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create wallet',
        message: error.message || 'Unknown error',
        details: error.response?.data || error
      },
      { status: 500 }
    );
  }
}
