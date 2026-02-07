/**
 * API Route: Get Cross-Chain Transfer Status
 * 
 * GET /api/cross-chain-status?trackingId={trackingId}
 * 
 * Gets the status of a cross-chain USDC transfer via CCTP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCircleArcIntegration, CircleArcError } from '@/lib/services/circleArcIntegration';

export interface CrossChainStatusResponse {
  success: boolean;
  data?: {
    status: 'PENDING' | 'IN_TRANSIT' | 'ATTESTING' | 'CONFIRMED' | 'FAILED';
    sourceChain: string;
    destinationChain: string;
    amount: string;
    sourceTxHash?: string;
    destinationTxHash?: string;
    attestation?: string;
    estimatedCompletion?: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<CrossChainStatusResponse>> {
  try {
    // Extract trackingId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const trackingId = searchParams.get('trackingId');

    // Validate required fields
    if (!trackingId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'trackingId is required',
            code: 'MISSING_TRACKING_ID',
          },
        },
        { status: 400 }
      );
    }

    console.log(`[API] Fetching cross-chain transfer status: ${trackingId}`);

    // Initialize integration service
    const integration = getCircleArcIntegration();

    // Get transfer status
    const status = await integration.getCrossChainTransferStatus(trackingId);

    console.log(`[API] Transfer status: ${status.status}`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Error fetching cross-chain status:', error);

    // Handle specific errors
    if (error instanceof CircleArcError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'INTEGRATION_ERROR',
          },
        },
        { status: 500 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch transfer status',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
