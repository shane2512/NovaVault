/**
 * API Route: Set Active Wallet
 * 
 * POST /api/set-active-wallet
 * 
 * Sets the active Circle wallet for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWalletManager, WalletManagerError } from '@/lib/services/walletManager';

export interface SetActiveWalletRequest {
  userId: string;
  walletId: string;
}

export interface SetActiveWalletResponse {
  success: boolean;
  data?: {
    walletId: string;
    circleWalletId: string;
    address: string;
    blockchain: string;
    arcSmartWalletAddress?: string;
    name: string;
    isActive: boolean;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SetActiveWalletResponse>> {
  try {
    // Parse request body
    const body: SetActiveWalletRequest = await request.json();

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

    if (!body.walletId) {
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

    // Sanitize inputs
    const userId = body.userId.trim();
    const walletId = body.walletId.trim();

    // TODO: Add authentication middleware
    // Verify that the requesting user is authorized
    // Example:
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.id !== userId) {
    //   return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    // }

    console.log(`[API] Setting active wallet for user ${userId}: ${walletId}`);

    // Initialize wallet manager
    const walletManager = getWalletManager();

    // Set active wallet
    const activeWallet = await walletManager.setActiveWallet(userId, walletId);

    console.log(`[API] Active wallet set successfully:`, {
      walletId: activeWallet.id,
      address: activeWallet.address,
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          walletId: activeWallet.id,
          circleWalletId: activeWallet.circleWalletId,
          address: activeWallet.address,
          blockchain: activeWallet.blockchain,
          arcSmartWalletAddress: activeWallet.arcSmartWalletAddress,
          name: activeWallet.name!,
          isActive: activeWallet.isActive,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Error setting active wallet:', error);

    // Handle specific errors
    if (error instanceof WalletManagerError) {
      const statusCode = error.code === 'WALLET_NOT_FOUND' ? 404 : 
                         error.code === 'UNAUTHORIZED_WALLET_ACCESS' ? 403 : 500;

      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'WALLET_MANAGER_ERROR',
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
          message: error instanceof Error ? error.message : 'Failed to set active wallet',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
