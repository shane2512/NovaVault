/**
 * Circle-Arc Integration Service
 * 
 * Coordinates Circle Programmable Wallets with Arc Smart Wallets
 * for unified cross-chain USDC treasury management.
 */

import { getCircleService } from './circleService';
import { arcService } from './arcService';
import { getWalletManager, UserWallet } from './walletManager';

// Types
export interface LinkedWallet {
  userId: string;
  circleWalletId: string;
  circleAddress: string;
  arcSmartWalletAddress: string;
  blockchain: string;
  totalBalance: {
    circle: string;
    arc: string;
    combined: string;
  };
  isActive: boolean;
  createdAt: string;
}

export interface CrossChainTransferRequest {
  userId: string;
  sourceWalletId: string;
  destinationChain: string;
  destinationAddress: string;
  amount: string;
}

export interface CrossChainTransferResponse {
  success: boolean;
  trackingId: string;
  sourceTxHash: string;
  estimatedTime: number;
  explorerUrls: {
    source: string;
    destination?: string;
  };
}

export class CircleArcError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'CircleArcError';
  }
}

/**
 * Circle-Arc Integration Service
 * 
 * Provides unified interface for managing Circle and Arc wallets together
 */
export class CircleArcIntegration {
  /**
   * Create and link Circle wallet to Arc smart wallet
   * 
   * @param userId - User identifier
   * @param blockchain - Circle wallet blockchain
   * @param name - Wallet name
   * @returns Linked wallet information
   */
  async createLinkedWallet(
    userId: string,
    blockchain: string = 'ETH-SEPOLIA',
    name?: string
  ): Promise<LinkedWallet> {
    try {
      console.log(`[CircleArc] Creating linked wallet for user: ${userId}`);

      // 1. Create Circle programmable wallet with MPC
      const circleService = getCircleService();
      const circleWallet = await circleService.createMPCWallet(userId, blockchain);

      console.log(`[CircleArc] Circle wallet created: ${circleWallet.address}`);

      // 2. Create Arc smart wallet linked to Circle wallet
      // Note: In production, you'd need proper signing setup
      // For now, this generates a deterministic address
      const arcWalletAddress = await this.linkToArcSmartWallet(
        circleWallet.address,
        userId
      );

      console.log(`[CircleArc] Arc smart wallet linked: ${arcWalletAddress}`);

      // 3. Save to wallet manager
      const walletManager = getWalletManager();
      const userWallet = await walletManager.saveWalletToUser({
        userId,
        circleWalletId: circleWallet.walletId,
        address: circleWallet.address,
        blockchain: circleWallet.blockchain,
        arcSmartWalletAddress: arcWalletAddress,
        name,
        metadata: {
          circleCreateDate: circleWallet.createDate,
          custodyType: circleWallet.custodyType,
          accountType: circleWallet.accountType,
          linked: true,
        },
      });

      // 4. Get balances
      const balances = await this.getLinkedWalletBalances(
        circleWallet.walletId,
        arcWalletAddress,
        blockchain
      );

      const linkedWallet: LinkedWallet = {
        userId,
        circleWalletId: circleWallet.walletId,
        circleAddress: circleWallet.address,
        arcSmartWalletAddress: arcWalletAddress,
        blockchain: circleWallet.blockchain,
        totalBalance: balances,
        isActive: userWallet.isActive,
        createdAt: userWallet.createdAt,
      };

      console.log(`[CircleArc] Linked wallet created successfully`);
      return linkedWallet;
    } catch (error) {
      throw new CircleArcError(
        `Failed to create linked wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LINKED_WALLET_CREATION_FAILED'
      );
    }
  }

  /**
   * Get linked wallet information
   * 
   * @param userId - User identifier
   * @param walletId - User wallet ID
   * @returns Linked wallet information
   */
  async getLinkedWallet(userId: string, walletId: string): Promise<LinkedWallet | null> {
    try {
      const walletManager = getWalletManager();
      const userWallet = await walletManager.getWalletById(walletId);

      if (!userWallet || userWallet.userId !== userId) {
        return null;
      }

      if (!userWallet.arcSmartWalletAddress) {
        throw new CircleArcError(
          'Wallet is not linked to Arc smart wallet',
          'NOT_LINKED'
        );
      }

      const balances = await this.getLinkedWalletBalances(
        userWallet.circleWalletId,
        userWallet.arcSmartWalletAddress,
        userWallet.blockchain
      );

      return {
        userId: userWallet.userId,
        circleWalletId: userWallet.circleWalletId,
        circleAddress: userWallet.address,
        arcSmartWalletAddress: userWallet.arcSmartWalletAddress,
        blockchain: userWallet.blockchain,
        totalBalance: balances,
        isActive: userWallet.isActive,
        createdAt: userWallet.createdAt,
      };
    } catch (error) {
      throw new CircleArcError(
        `Failed to get linked wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LINKED_WALLET_FETCH_FAILED'
      );
    }
  }

  /**
   * Execute cross-chain USDC transfer via CCTP
   * 
   * @param request - Cross-chain transfer request
   * @returns Transfer response with tracking info
   */
  async executeCrossChainTransfer(
    request: CrossChainTransferRequest
  ): Promise<CrossChainTransferResponse> {
    try {
      console.log(`[CircleArc] Executing cross-chain transfer for user: ${request.userId}`);

      // 1. Get user wallet
      const walletManager = getWalletManager();
      const userWallet = await walletManager.getWalletById(request.sourceWalletId);

      if (!userWallet || userWallet.userId !== request.userId) {
        throw new CircleArcError('Wallet not found or unauthorized', 'UNAUTHORIZED');
      }

      if (!userWallet.arcSmartWalletAddress) {
        throw new CircleArcError('Wallet not linked to Arc', 'NOT_LINKED');
      }

      // 2. Initiate CCTP transfer from Arc
      const { txHash, trackingId } = await arcService.routeUSDCCrossChain(
        userWallet.arcSmartWalletAddress,
        request.destinationAddress,
        request.amount,
        request.destinationChain
      );

      console.log(`[CircleArc] Cross-chain transfer initiated: ${trackingId}`);

      // 3. Prepare response
      const response: CrossChainTransferResponse = {
        success: true,
        trackingId,
        sourceTxHash: txHash,
        estimatedTime: 900, // 15 minutes
        explorerUrls: {
          source: arcService.getTxExplorerUrl(txHash),
        },
      };

      return response;
    } catch (error) {
      throw new CircleArcError(
        `Failed to execute cross-chain transfer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CROSS_CHAIN_TRANSFER_FAILED'
      );
    }
  }

  /**
   * Get cross-chain transfer status
   * 
   * @param trackingId - CCTP tracking ID
   * @returns Transfer status
   */
  async getCrossChainTransferStatus(trackingId: string) {
    try {
      return await arcService.getCrossChainStatus(trackingId);
    } catch (error) {
      throw new CircleArcError(
        `Failed to get transfer status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STATUS_FETCH_FAILED'
      );
    }
  }

  /**
   * Link existing Circle wallet to Arc smart wallet
   * 
   * @param circleAddress - Circle wallet address
   * @param userId - User identifier
   * @returns Arc smart wallet address
   */
  private async linkToArcSmartWallet(
    circleAddress: string,
    userId: string
  ): Promise<string> {
    try {
      // In production, this would deploy an Arc smart wallet contract
      // For now, generate deterministic address
      const arcAddress = await arcService.linkCircleWallet(circleAddress, userId);
      return arcAddress;
    } catch (error) {
      throw new CircleArcError(
        `Failed to link to Arc: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ARC_LINK_FAILED'
      );
    }
  }

  /**
   * Get combined balances for linked wallet
   * 
   * @param circleWalletId - Circle wallet ID
   * @param arcWalletAddress - Arc smart wallet address
   * @param blockchain - Blockchain identifier
   * @returns Combined balance information
   */
  private async getLinkedWalletBalances(
    circleWalletId: string,
    arcWalletAddress: string,
    blockchain: string
  ): Promise<{ circle: string; arc: string; combined: string }> {
    try {
      // Get Circle wallet balance
      const circleService = getCircleService();
      let circleBalance = '0';
      try {
        circleBalance = await circleService.getUSDCBalance(circleWalletId, blockchain);
      } catch (error) {
        console.warn(`[CircleArc] Failed to fetch Circle balance:`, error);
      }

      // Get Arc wallet balance
      let arcBalance = '0';
      try {
        arcBalance = await arcService.getSmartWalletBalance(arcWalletAddress);
      } catch (error) {
        console.warn(`[CircleArc] Failed to fetch Arc balance:`, error);
      }

      // Calculate combined balance
      const combined = (
        parseFloat(circleBalance || '0') + parseFloat(arcBalance || '0')
      ).toFixed(6);

      return {
        circle: circleBalance,
        arc: arcBalance,
        combined,
      };
    } catch (error) {
      console.error(`[CircleArc] Error fetching balances:`, error);
      return {
        circle: '0',
        arc: '0',
        combined: '0',
      };
    }
  }

  /**
   * Transfer USDC from Circle to Arc wallet
   * 
   * @param userId - User identifier
   * @param walletId - Wallet ID
   * @param amount - Amount to transfer
   * @returns Transaction hash
   */
  async transferCircleToArc(
    userId: string,
    walletId: string,
    amount: string
  ): Promise<string> {
    try {
      // Get wallet
      const walletManager = getWalletManager();
      const wallet = await walletManager.getWalletById(walletId);

      if (!wallet || wallet.userId !== userId) {
        throw new CircleArcError('Wallet not found or unauthorized', 'UNAUTHORIZED');
      }

      if (!wallet.arcSmartWalletAddress) {
        throw new CircleArcError('Wallet not linked to Arc', 'NOT_LINKED');
      }

      // Transfer from Circle to Arc
      const circleService = getCircleService();
      const transfer = await circleService.transferUSDC(
        wallet.circleWalletId,
        wallet.arcSmartWalletAddress,
        amount,
        wallet.blockchain
      );

      return transfer.id;
    } catch (error) {
      throw new CircleArcError(
        `Failed to transfer to Arc: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFER_TO_ARC_FAILED'
      );
    }
  }
}

// Singleton instance
let circleArcIntegration: CircleArcIntegration | null = null;

/**
 * Get or create CircleArcIntegration singleton instance
 * 
 * @returns CircleArcIntegration instance
 */
export function getCircleArcIntegration(): CircleArcIntegration {
  if (!circleArcIntegration) {
    circleArcIntegration = new CircleArcIntegration();
  }
  return circleArcIntegration;
}
