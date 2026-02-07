/**
 * API Route: Get Active Wallet
 * 
 * GET /api/get-active-wallet?userId={userId}
 * 
 * Retrieves the currently active Circle wallet for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWalletManager, WalletManagerError } from '@/lib/services/walletManager';
import { getCircleService } from '@/lib/services/circleService';

export interface GetActiveWalletResponse {
  success: boolean;
  data?: {
    walletId: string;
    circleWalletId: string;
    address: string;
    blockchain: string;
    arcSmartWalletAddress?: string;
    name: string;
    isActive: boolean;
    balance?: string;
    createdAt: string;
  } | null;
  error?: {
    message: string;
    code?: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<GetActiveWalletResponse>> {
  try {
    // Extract userId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const includeBalance = searchParams.get('includeBalance') === 'true';

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

    // TODO: Add authentication middleware
    // Verify that the requesting user is authorized
    // Example:
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.id !== userId) {
    //   return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    // }

    console.log(`[API] Fetching active wallet for user: ${userId}`);

    // Initialize services
    const walletManager = getWalletManager();
    const circleService = getCircleService();

    // Get active wallet for user
    const activeWallet = await walletManager.getActiveWallet(userId);

    if (!activeWallet) {
      console.log(`[API] No active wallet found for user: ${userId}`);
      return NextResponse.json(
        {
          success: true,
          data: null,
        },
        { status: 200 }
      );
    }

    console.log(`[API] Active wallet found:`, {
      walletId: activeWallet.id,
      address: activeWallet.address,
    });

    // Optionally fetch balance
    let balance: string | undefined;

    if (includeBalance) {
      try {
        balance = await circleService.getUSDCBalance(
          activeWallet.circleWalletId,
          activeWallet.blockchain
        );
        console.log(`[API] Balance fetched: ${balance} USDC`);
      } catch (error) {
        console.warn(`[API] Failed to fetch balance:`, error);
        balance = '0';
      }
    }

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
          balance,
          createdAt: activeWallet.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Error fetching active wallet:', error);

    // Handle specific errors
    if (error instanceof WalletManagerError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'WALLET_MANAGER_ERROR',
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
          message: error instanceof Error ? error.message : 'Failed to fetch active wallet',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
