import { NextRequest, NextResponse } from 'next/server';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { randomUUID } from 'crypto';

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const { blockchains, name } = await request.json();

    if (!blockchains || blockchains.length === 0) {
      return NextResponse.json(
        { error: 'Blockchains parameter is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Creating NEW wallet set with multi-chain wallet...', { blockchains, name });

    // Step 1: Create a NEW Wallet Set (required for same address across chains)
    const walletSetResponse = await circleClient.createWalletSet({
      idempotencyKey: randomUUID(),
      name: name || `NovaVault Multi-Chain Wallet ${Date.now()}`,
    });

    const walletSetId = walletSetResponse.data?.walletSet?.id;
    if (!walletSetId) {
      throw new Error('Failed to create wallet set');
    }

    console.log('✅ Wallet set created:', walletSetId);

    // Step 2: Create wallets on all specified blockchains within the wallet set
    // This ensures the SAME address across all chains
    const response = await circleClient.createWallets({
      idempotencyKey: randomUUID(),
      accountType: 'SCA',
      blockchains: blockchains as any[],
      count: 1,
      walletSetId: walletSetId,
    });

    console.log('📦 Raw Circle API response:', JSON.stringify(response.data, null, 2));

    if (!response.data?.wallets || response.data.wallets.length === 0) {
      console.error('❌ Failed to create wallets:', response);
      return NextResponse.json(
        { error: 'Failed to create wallets', details: response },
        { status: 500 }
      );
    }

    // Circle returns separate wallet IDs for each blockchain
    // But they share the same address (it's the same wallet across networks)
    const wallets = response.data.wallets;
    
    // Use the first wallet's ID as the primary identifier
    const primaryWalletId = wallets[0].id;
    const sharedAddress = wallets[0].address;

    const formattedWallet = {
      id: primaryWalletId,
      walletSetId: walletSetId, // Store the wallet set ID for reference
      name: name || `Wallet ${sharedAddress.substring(0, 6)}`,
      networks: wallets.map(w => ({
        blockchain: w.blockchain,
        address: w.address,
        walletId: w.id, // Store individual wallet ID for each network
        balance: '0',
        nativeBalance: '0',
        symbol: w.blockchain.includes('ETH') ? 'ETH' : 
                w.blockchain.includes('MATIC') ? 'MATIC' : 
                w.blockchain.includes('ARC') ? 'USDC' : 'ETH',
      })),
      createdAt: new Date().toISOString(),
    };

    console.log('✅ Multi-chain wallet created successfully!');
    console.log('   Wallet Set ID:', walletSetId);
    console.log('   Primary Wallet ID:', primaryWalletId);
    console.log('   Shared Address:', sharedAddress);
    console.log('   Networks:', wallets.length);
    wallets.forEach(w => {
      console.log(`   - ${w.blockchain}: ${w.id}`);
    });

    return NextResponse.json({
      success: true,
      wallet: formattedWallet,
      walletSetId: walletSetId, // Include in response
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
