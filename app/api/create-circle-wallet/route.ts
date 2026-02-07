/**
 * API Route: Create Circle Wallet
 * 
 * POST /api/create-circle-wallet
 * 
 * Creates a new Circle Programmable Wallet with MPC for the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCircleService, CircleWalletsError } from '@/lib/services/circleService';
import { getWalletManager, WalletManagerError } from '@/lib/services/walletManager';

export interface CreateWalletRequest {
  userId: string;
  blockchain?: string;
  name?: string;
  arcSmartWalletAddress?: string;
}

export interface CreateWalletResponse {
  success: boolean;
  data?: {
    walletId: string;
    circleWalletId: string;
    address: string;
    blockchain: string;
    arcSmartWalletAddress?: string;
    name: string;
    isActive: boolean;
    createdAt: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateWalletResponse>> {
  try {
    // Parse request body
    const body: CreateWalletRequest = await request.json();

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
    const arcSmartWalletAddress = body.arcSmartWalletAddress?.trim();

    // Validate blockchain format
    const validBlockchains = [
      'ETH-SEPOLIA',
      'BASE-SEPOLIA',
      'MATIC-AMOY',
      'AVAX-FUJI',
      'ARB-SEPOLIA',
      'OP-SEPOLIA',
    ];

    if (!validBlockchains.includes(blockchain)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Invalid blockchain. Supported: ${validBlockchains.join(', ')}`,
            code: 'INVALID_BLOCKCHAIN',
          },
        },
        { status: 400 }
      );
    }

    // Validate Arc address format if provided
    if (arcSmartWalletAddress && !/^0x[a-fA-F0-9]{40}$/.test(arcSmartWalletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid Arc smart wallet address format',
            code: 'INVALID_ARC_ADDRESS',
          },
        },
        { status: 400 }
      );
    }

    // TODO: Add authentication middleware
    // For now, we trust the userId from the request
    // In production, use:
    // - NextAuth session
    // - JWT token validation
    // - Cookie-based auth
    // Example:
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.id !== userId) {
    //   return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    // }

    console.log(`[API] Creating Circle wallet for user: ${userId}`);

    // Initialize services
    const circleService = getCircleService();
    const walletManager = getWalletManager();

    // Create MPC wallet via Circle
    console.log(`[API] Calling Circle API to create MPC wallet...`);
    const circleWallet = await circleService.createMPCWallet(userId, blockchain);

    console.log(`[API] Circle wallet created:`, {
      walletId: circleWallet.walletId,
      address: circleWallet.address,
      blockchain: circleWallet.blockchain,
    });

    // Save wallet to user account
    console.log(`[API] Saving wallet to user account...`);
    const userWallet = await walletManager.saveWalletToUser({
      userId,
      circleWalletId: circleWallet.walletId,
      address: circleWallet.address,
      blockchain: circleWallet.blockchain,
      arcSmartWalletAddress,
      name,
      metadata: {
        circleCreateDate: circleWallet.createDate,
        custodyType: circleWallet.custodyType,
        accountType: circleWallet.accountType,
      },
    });

    console.log(`[API] Wallet successfully saved with ID: ${userWallet.id}`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          walletId: userWallet.id,
          circleWalletId: userWallet.circleWalletId,
          address: userWallet.address,
          blockchain: userWallet.blockchain,
          arcSmartWalletAddress: userWallet.arcSmartWalletAddress,
          name: userWallet.name!,
          isActive: userWallet.isActive,
          createdAt: userWallet.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating Circle wallet:', error);

    // Handle specific errors
    if (error instanceof CircleWalletsError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'CIRCLE_API_ERROR',
          },
        },
        { status: error.statusCode || 500 }
      );
    }

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
          message: error instanceof Error ? error.message : 'Failed to create wallet',
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
