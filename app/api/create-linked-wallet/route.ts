/**
 * API Route: Create Linked Wallet (Circle + Arc)
 * 
 * POST /api/create-linked-wallet
 * 
 * Creates a Circle Programmable Wallet and links it to an Arc Smart Wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCircleArcIntegration, CircleArcError } from '@/lib/services/circleArcIntegration';

export interface CreateLinkedWalletRequest {
  userId: string;
  blockchain?: string;
  name?: string;
}

export interface CreateLinkedWalletResponse {
  success: boolean;
  data?: {
    userId: string;
    circleWalletId: string;
    circleAddress: string;
    arcSmartWalletAddress: string;
    blockchain: string;
    name: string;
    totalBalance: {
      circle: string;
      arc: string;
      combined: string;
    };
    isActive: boolean;
    createdAt: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateLinkedWalletResponse>> {
  try {
    // Parse request body
    const body: CreateLinkedWalletRequest = await request.json();

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

    // Sanitize inputs
    const userId = body.userId.trim();
    const blockchain = body.blockchain?.trim() || 'ETH-SEPOLIA';
    const name = body.name?.trim();

    // TODO: Add authentication middleware
    // Verify user authorization

    console.log(`[API] Creating linked wallet for user: ${userId}`);

    // Initialize integration service
    const integration = getCircleArcIntegration();

    // Create linked wallet
    const linkedWallet = await integration.createLinkedWallet(userId, blockchain, name);

    console.log(`[API] Linked wallet created successfully`);
    console.log(`[API] Circle: ${linkedWallet.circleAddress}`);
    console.log(`[API] Arc: ${linkedWallet.arcSmartWalletAddress}`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          userId: linkedWallet.userId,
          circleWalletId: linkedWallet.circleWalletId,
          circleAddress: linkedWallet.circleAddress,
          arcSmartWalletAddress: linkedWallet.arcSmartWalletAddress,
          blockchain: linkedWallet.blockchain,
          name: name || `Wallet ${Date.now()}`,
          totalBalance: linkedWallet.totalBalance,
          isActive: linkedWallet.isActive,
          createdAt: linkedWallet.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating linked wallet:', error);

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
          message: error instanceof Error ? error.message : 'Failed to create linked wallet',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
