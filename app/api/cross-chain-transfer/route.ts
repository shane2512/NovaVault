/**
 * API Route: Execute Cross-Chain Transfer
 * 
 * POST /api/cross-chain-transfer
 * 
 * Executes cross-chain USDC transfer using Circle CCTP via Arc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCircleArcIntegration, CircleArcError } from '@/lib/services/circleArcIntegration';

export interface CrossChainTransferRequest {
  userId: string;
  sourceWalletId: string;
  destinationChain: string;
  destinationAddress: string;
  amount: string;
}

export interface CrossChainTransferResponse {
  success: boolean;
  data?: {
    trackingId: string;
    sourceTxHash: string;
    estimatedTime: number;
    explorerUrls: {
      source: string;
      destination?: string;
    };
  };
  error?: {
    message: string;
    code?: string;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CrossChainTransferResponse>> {
  try {
    // Parse request body
    const body: CrossChainTransferRequest = await request.json();

    // Validate required fields
    if (!body.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'userId is required',
            code: 'MISSING_USER_ID',
          },
        },
        { status: 400 }
      );
    }

    if (!body.sourceWalletId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'sourceWalletId is required',
            code: 'MISSING_WALLET_ID',
          },
        },
        { status: 400 }
      );
    }

    if (!body.destinationChain) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'destinationChain is required',
            code: 'MISSING_DESTINATION_CHAIN',
          },
        },
        { status: 400 }
      );
    }

    if (!body.destinationAddress) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'destinationAddress is required',
            code: 'MISSING_DESTINATION_ADDRESS',
          },
        },
        { status: 400 }
      );
    }

    if (!body.amount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'amount is required',
            code: 'MISSING_AMOUNT',
          },
        },
        { status: 400 }
      );
    }

    // Validate amount
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid amount',
            code: 'INVALID_AMOUNT',
          },
        },
        { status: 400 }
      );
    }

    // Validate destination address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.destinationAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid destination address format',
            code: 'INVALID_ADDRESS',
          },
        },
        { status: 400 }
      );
    }

    // TODO: Add authentication middleware
    // Verify user authorization

    console.log(`[API] Executing cross-chain transfer for user: ${body.userId}`);
    console.log(`[API] Amount: ${body.amount} USDC`);
    console.log(`[API] Destination: ${body.destinationChain}`);

    // Initialize integration service
    const integration = getCircleArcIntegration();

    // Execute cross-chain transfer
    const result = await integration.executeCrossChainTransfer({
      userId: body.userId,
      sourceWalletId: body.sourceWalletId,
      destinationChain: body.destinationChain,
      destinationAddress: body.destinationAddress,
      amount: body.amount,
    });

    console.log(`[API] Cross-chain transfer initiated`);
    console.log(`[API] Tracking ID: ${result.trackingId}`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          trackingId: result.trackingId,
          sourceTxHash: result.sourceTxHash,
          estimatedTime: result.estimatedTime,
          explorerUrls: result.explorerUrls,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Error executing cross-chain transfer:', error);

    // Handle specific errors
    if (error instanceof CircleArcError) {
      const statusCode = error.code === 'UNAUTHORIZED' ? 403 : 500;

      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'INTEGRATION_ERROR',
          },
        },
        { status: statusCode }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to execute cross-chain transfer',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
