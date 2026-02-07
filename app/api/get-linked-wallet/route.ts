/**
 * API Route: Get Linked Wallet Details
 * 
 * GET /api/get-linked-wallet?userId={userId}&walletId={walletId}
 * 
 * Retrieves a specific linked wallet (Circle + Arc) with combined balances.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCircleArcIntegration, CircleArcError } from '@/lib/services/circleArcIntegration';

export interface GetLinkedWalletResponse {
  success: boolean;
  data?: {
    walletId: string;
    userId: string;
    name: string;
    circleWallet: {
      id: string;
      address: string;
      blockchain: string;
    };
    arcWallet: {
      address: string;
      isDeployed: boolean;
      version: string;
    };
    balances: {
      circle: string;
      arc: string;
      combined: string;
    };
    createdAt: string;
    lastSynced: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const walletId = searchParams.get('walletId');

    // Validate required fields
    if (!userId) {
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

    if (!walletId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'walletId is required',
            code: 'MISSING_WALLET_ID',
          },
        },
        { status: 400 }
      );
    }

    console.log(`[API] Fetching linked wallet: ${walletId} for user: ${userId}`);

    // Initialize integration service
    const integration = getCircleArcIntegration();

    // Get linked wallet
    const wallet = await integration.getLinkedWallet(userId, walletId);

    if (!wallet) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Wallet ${walletId} not found for user ${userId}`,
            code: 'WALLET_NOT_FOUND',
          },
        },
        { status: 404 }
      );
    }

    console.log(`[API] Linked wallet retrieved successfully`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: wallet,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Error fetching linked wallet:', error);

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
          message: error instanceof Error ? error.message : 'Failed to fetch linked wallet',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
