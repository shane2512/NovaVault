// API route to send transaction via Circle SDK or direct blockchain
import { NextRequest, NextResponse } from 'next/server';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const { walletId, to, amount, tokenAddress, blockchain } = await request.json();

    if (!walletId || !to || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Handle Arc Network separately (not supported by Circle)
    if (blockchain === 'ARC-TESTNET') {
      return NextResponse.json(
        { 
          error: 'Arc Network transactions must be sent through Circle-supported networks. Please use ETH-SEPOLIA or MATIC-AMOY and bridge to Arc.',
          suggestion: 'Use Sepolia or Polygon Amoy wallet to send, then bridge to Arc Network.'
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
      return NextResponse.json(
        { error: 'Circle credentials not configured' },
        { status: 500 }
      );
    }

    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    // Get USDC token address for the blockchain
    const usdcAddresses: Record<string, string> = {
      'ETH-SEPOLIA': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      'MATIC-AMOY': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    };

    const finalTokenAddress = tokenAddress || usdcAddresses[blockchain];

    // Create transaction using Circle SDK for supported networks
    const transactionResponse = await client.createTransaction({
      walletId,
      blockchain: blockchain || 'ETH-SEPOLIA',
      tokenAddress: finalTokenAddress,
      destinationAddress: to,
      amounts: [amount],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
    });

    return NextResponse.json({
      success: true,
      transaction: transactionResponse.data,
    });
  } catch (error: any) {
    console.error('Transaction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send transaction' },
      { status: 500 }
    );
  }
}
