// API route to send transaction via Circle SDK or direct blockchain
import { NextRequest, NextResponse } from 'next/server';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { getTxExplorerUrl, type SupportedChain } from '@/lib/services/circleCCTPService';

export async function POST(request: NextRequest) {
  try {
    const { walletId, to, amount, tokenAddress, blockchain } = await request.json();

    console.log('💸 Send request:', { walletId, blockchain, amount, to: to.substring(0, 10) + '...' });

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
      amount: [amount],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
    });

    // Extract transaction details from Circle response
    const result: any = transactionResponse.data;
    const circleTransactionId = result?.id; // Circle's internal transaction ID (UUID)
    const blockchainTxHash = result?.txHash; // Actual blockchain transaction hash (if confirmed)
    
    // Generate explorer URL only if we have a real blockchain transaction hash
    let explorerUrl: string | undefined;
    let message: string;
    
    if (blockchainTxHash && blockchainTxHash.startsWith('0x')) {
      // We have a confirmed blockchain transaction hash
      const explorerBases: Record<string, string> = {
        'ETH-SEPOLIA': 'https://sepolia.etherscan.io',
        'MATIC-AMOY': 'https://amoy.polygonscan.com',
        'BASE-SEPOLIA': 'https://sepolia.basescan.org',
        'AVAX-FUJI': 'https://testnet.snowtrace.io',
        'ARC-TESTNET': 'https://testnet.arcscan.app',
      };
      const explorerBase = explorerBases[blockchain as string] || 'https://sepolia.etherscan.io';
      explorerUrl = `${explorerBase}/tx/${blockchainTxHash}`;
      message = `Transaction confirmed on blockchain`;
      
      console.log('\u2705 Transaction confirmed successfully!');
      console.log(`   Circle Transaction ID: ${circleTransactionId}`);
      console.log(`   Blockchain TX Hash: ${blockchainTxHash}`);
      console.log(`   View on Explorer: ${explorerUrl}`);
    } else {
      // Transaction is pending - no blockchain hash yet
      message = `Transaction submitted to Circle (ID: ${circleTransactionId}). Waiting for blockchain confirmation...`;
      console.log('\u2705 Transaction submitted to Circle!');
      console.log(`   Circle Transaction ID: ${circleTransactionId}`);
      console.log(`   Status: Pending blockchain confirmation`);
      console.log(`   Note: Transaction hash will be available after confirmation`);
    }

    return NextResponse.json({
      success: true,
      transaction: transactionResponse.data,
      txHash: blockchainTxHash, // Actual blockchain hash (may be undefined if pending)
      circleTransactionId, // Circle's internal ID
      txId: blockchainTxHash || circleTransactionId, // For backwards compatibility
      explorerUrl,
      message,
      state: result?.state, // Include transaction state (INITIATED, PENDING, CONFIRMED, etc.)
    });
  } catch (error: any) {
    console.error('❌ Transaction error:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    // Extract Circle API error message
    const circleError = error.response?.data?.message || error.response?.data?.error;
    const errorMessage = circleError || error.message || 'Failed to send transaction';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.response?.data
      },
      { status: 500 }
    );
  }
}
