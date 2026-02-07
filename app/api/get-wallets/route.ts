/**
 * API Route: Get Wallets
 * 
 * GET /api/get-wallets?userId={userId}
 * 
 * Retrieves all Circle wallets for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWalletManager, WalletManagerError, UserWallet } from '@/lib/services/walletManager';
import { getCircleService } from '@/lib/services/circleService';

export interface GetWalletsResponse {
  success: boolean;
  data?: {
    wallets: Array<{
      walletId: string;
      circleWalletId: string;
      address: string;
      blockchain: string;
      arcSmartWalletAddress?: string;
      name: string;
      isActive: boolean;
      balance?: string;
      createdAt: string;
    }>;
    activeWalletId: string | null;
    totalCount: number;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<GetWalletsResponse>> {
  try {
    // Extract userId from query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const includeBalances = searchParams.get('includeBalances') === 'true';

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
    // Verify that the requesting user is authorized to access this userId
    // Example:
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.id !== userId) {
    //   return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    // }

    console.log(`[API] Fetching wallets for user: ${userId}`);

    // Initialize services
    const walletManager = getWalletManager();
    const circleService = getCircleService();

    // Get all wallets for user
    const wallets = await walletManager.getUserWallets(userId);

    console.log(`[API] Found ${wallets.length} wallets for user`);

    // Find active wallet
    const activeWallet = wallets.find((w) => w.isActive);

    // Optionally fetch balances
    const walletsWithBalances = await Promise.all(
      wallets.map(async (wallet) => {
        let balance: string | undefined;

        if (includeBalances) {
          try {
            balance = await circleService.getUSDCBalance(
              wallet.circleWalletId,
              wallet.blockchain
            );
          } catch (error) {
            console.warn(`[API] Failed to fetch balance for wallet ${wallet.id}:`, error);
            balance = '0';
          }
        }

        return {
          walletId: wallet.id,
          circleWalletId: wallet.circleWalletId,
          address: wallet.address,
          blockchain: wallet.blockchain,
          arcSmartWalletAddress: wallet.arcSmartWalletAddress,
          name: wallet.name!,
          isActive: wallet.isActive,
          balance,
          createdAt: wallet.createdAt,
        };
      })
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          wallets: walletsWithBalances,
          activeWalletId: activeWallet?.id || null,
          totalCount: wallets.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Error fetching wallets:', error);

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
          message: error instanceof Error ? error.message : 'Failed to fetch wallets',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
