/**
 * Circle Wallets API Service with MPC Support
 * 
 * Handles programmatic wallet creation, balance queries, and USDC transfers
 * using Circle's Programmable Wallets with Multi-Party Computation (MPC).
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { randomUUID } from 'crypto';

// Types
export interface CircleWalletCreateRequest {
  idempotencyKey: string;
  entitySecretCiphertext: string;
  blockchains: string[];
  count: number;
  walletSetId?: string;
  metadata?: Array<{ key: string; value: string }>;
}

export interface CircleWallet {
  walletId: string;
  address: string;
  blockchain: string;
  createDate: string;
  updateDate: string;
  state: 'LIVE' | 'FROZEN';
  walletSetId?: string;
  custodyType: 'DEVELOPER' | 'ENDUSER';
  accountType: 'SCA' | 'EOA';
}

export interface CircleWalletResponse {
  data: {
    wallets: CircleWallet[];
  };
}

export interface CircleBalanceResponse {
  data: {
    tokenBalances: Array<{
      token: {
        id: string;
        blockchain: string;
        name: string;
        symbol: string;
        decimals: number;
      };
      amount: string;
      updateDate: string;
    }>;
  };
}

export interface CircleTransferRequest {
  idempotencyKey: string;
  blockchain: string;
  tokenId: string;
  destination: {
    type: 'blockchain';
    address: string;
    chain: string;
  };
  amounts: string[];
  fee?: {
    type: 'level' | 'custom';
    config: {
      feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
      gasLimit?: string;
      maxFeePerGas?: string;
      priorityFeePerGas?: string;
    };
  };
  walletId: string;
}

export interface CircleTransferResponse {
  data: {
    id: string;
    state: 'INITIATED' | 'PENDING_RISK_SCREENING' | 'DENIED' | 'QUEUED' | 'SENT' | 'CONFIRMED' | 'COMPLETE' | 'FAILED';
    amounts: string[];
    blockchain: string;
    createDate: string;
    userId?: string;
  };
}

export class CircleWalletsError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CircleWalletsError';
  }
}

/**
 * Circle Wallets Service
 * 
 * Provides MPC wallet creation, balance queries, and transfer capabilities
 * using Circle's Programmable Wallets API.
 */
export class CircleWalletsService {
  private client: AxiosInstance;
  private entitySecret: string;

  constructor() {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    const baseURL = process.env.CIRCLE_API_BASE_URL || 'https://api.circle.com/v1';

    if (!apiKey) {
      throw new CircleWalletsError('CIRCLE_API_KEY not found in environment variables');
    }

    if (!entitySecret) {
      throw new CircleWalletsError('CIRCLE_ENTITY_SECRET not found in environment variables');
    }

    this.entitySecret = entitySecret;

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        return Promise.reject(this.handleAxiosError(error));
      }
    );
  }

  /**
   * Create an MPC-enabled Circle Programmable Wallet
   * 
   * @param userId - User identifier for wallet association
   * @param blockchain - Target blockchain (e.g., 'ETH-SEPOLIA', 'BASE-SEPOLIA', 'MATIC-AMOY')
   * @returns Created wallet details
   */
  async createMPCWallet(
    userId: string,
    blockchain: string = 'ETH-SEPOLIA'
  ): Promise<CircleWallet> {
    try {
      const idempotencyKey = this.generateIdempotencyKey(userId);

      const requestBody: CircleWalletCreateRequest = {
        idempotencyKey,
        entitySecretCiphertext: this.entitySecret,
        blockchains: [blockchain],
        count: 1,
        metadata: [
          { key: 'userId', value: userId },
          { key: 'createdAt', value: new Date().toISOString() },
          { key: 'source', value: 'revault' },
        ],
      };

      const response = await this.client.post<CircleWalletResponse>(
        '/w3s/wallets',
        requestBody
      );

      const wallet = response.data.data.wallets[0];

      if (!wallet) {
        throw new CircleWalletsError('No wallet returned from Circle API');
      }

      return wallet;
    } catch (error) {
      if (error instanceof CircleWalletsError) {
        throw error;
      }
      throw new CircleWalletsError(
        `Failed to create MPC wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'WALLET_CREATION_FAILED'
      );
    }
  }

  /**
   * Get wallet details by walletId
   * 
   * @param walletId - Circle wallet ID
   * @returns Wallet details
   */
  async getWallet(walletId: string): Promise<CircleWallet> {
    try {
      const response = await this.client.get<{ data: { wallet: CircleWallet } }>(
        `/w3s/wallets/${walletId}`
      );

      return response.data.data.wallet;
    } catch (error) {
      throw new CircleWalletsError(
        `Failed to fetch wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'WALLET_FETCH_FAILED'
      );
    }
  }

  /**
   * Get all wallets (with pagination support)
   * 
   * @param params - Query parameters
   * @returns List of wallets
   */
  async getWallets(params?: {
    blockchain?: string;
    walletSetId?: string;
    pageSize?: number;
    pageBefore?: string;
    pageAfter?: string;
  }): Promise<CircleWallet[]> {
    try {
      const response = await this.client.get<CircleWalletResponse>(
        '/w3s/wallets',
        { params }
      );

      return response.data.data.wallets;
    } catch (error) {
      throw new CircleWalletsError(
        `Failed to fetch wallets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'WALLETS_FETCH_FAILED'
      );
    }
  }

  /**
   * Get wallet balance for all tokens
   * 
   * @param walletId - Circle wallet ID
   * @returns Token balances
   */
  async getWalletBalance(walletId: string): Promise<CircleBalanceResponse['data']> {
    try {
      const response = await this.client.get<CircleBalanceResponse>(
        `/w3s/wallets/${walletId}/balances`
      );

      return response.data.data;
    } catch (error) {
      throw new CircleWalletsError(
        `Failed to fetch wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'BALANCE_FETCH_FAILED'
      );
    }
  }

  /**
   * Get USDC balance specifically
   * 
   * @param walletId - Circle wallet ID
   * @param blockchain - Blockchain identifier
   * @returns USDC balance as string
   */
  async getUSDCBalance(walletId: string, blockchain: string = 'ETH-SEPOLIA'): Promise<string> {
    try {
      const balances = await this.getWalletBalance(walletId);
      
      const usdcBalance = balances.tokenBalances.find(
        (balance) =>
          balance.token.symbol === 'USDC' &&
          balance.token.blockchain === blockchain
      );

      return usdcBalance?.amount || '0';
    } catch (error) {
      throw new CircleWalletsError(
        `Failed to fetch USDC balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'USDC_BALANCE_FETCH_FAILED'
      );
    }
  }

  /**
   * Transfer USDC from Circle wallet to destination address
   * 
   * @param walletId - Source wallet ID
   * @param destination - Destination blockchain address
   * @param amount - Amount in USDC (human-readable, e.g., "10.5")
   * @param blockchain - Source blockchain
   * @returns Transfer response
   */
  async transferUSDC(
    walletId: string,
    destination: string,
    amount: string,
    blockchain: string = 'ETH-SEPOLIA'
  ): Promise<CircleTransferResponse['data']> {
    try {
      // Get USDC token ID for the blockchain
      const tokenId = this.getUSDCTokenId(blockchain);

      const idempotencyKey = this.generateIdempotencyKey(`${walletId}-${destination}-${amount}-${Date.now()}`);

      const requestBody: CircleTransferRequest = {
        idempotencyKey,
        blockchain,
        tokenId,
        destination: {
          type: 'blockchain',
          address: destination,
          chain: blockchain,
        },
        amounts: [amount],
        fee: {
          type: 'level',
          config: {
            feeLevel: 'MEDIUM',
          },
        },
        walletId,
      };

      const response = await this.client.post<CircleTransferResponse>(
        '/w3s/transactions/transfer',
        requestBody
      );

      return response.data.data;
    } catch (error) {
      throw new CircleWalletsError(
        `Failed to transfer USDC: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'USDC_TRANSFER_FAILED'
      );
    }
  }

  /**
   * Get transaction status
   * 
   * @param transactionId - Transaction ID
   * @returns Transaction details
   */
  async getTransaction(transactionId: string): Promise<CircleTransferResponse['data']> {
    try {
      const response = await this.client.get<CircleTransferResponse>(
        `/w3s/transactions/${transactionId}`
      );

      return response.data.data;
    } catch (error) {
      throw new CircleWalletsError(
        `Failed to fetch transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'TRANSACTION_FETCH_FAILED'
      );
    }
  }

  /**
   * Get USDC token ID for a given blockchain
   * 
   * @param blockchain - Blockchain identifier
   * @returns Token ID
   */
  private getUSDCTokenId(blockchain: string): string {
    const tokenMap: Record<string, string> = {
      'ETH-SEPOLIA': '36b1424a-0ea1-5891-8a95-48adb4436ab2',
      'AVAX-FUJI': '0952e34a-8c34-594e-88ee-f9aab32b18fa',
      'MATIC-AMOY': 'de1a1641-c5cf-550d-b853-8be0c0dc1d1f',
      'BASE-SEPOLIA': 'aa586abc-5f47-5007-abbc-8ea45cb938af',
      'ARB-SEPOLIA': 'ff594da7-6e72-5834-b2ee-a89f9dbe4e59',
      'OP-SEPOLIA': 'e5e379a4-de06-5ac2-a8e6-a8fa5a2ff1fa',
    };

    const tokenId = tokenMap[blockchain];
    
    if (!tokenId) {
      throw new CircleWalletsError(
        `Unsupported blockchain: ${blockchain}`,
        undefined,
        'UNSUPPORTED_BLOCKCHAIN'
      );
    }

    return tokenId;
  }

  /**
   * Generate idempotency key for API calls
   * 
   * @param input - Input string (unused, kept for compatibility)
   * @returns UUID v4 idempotency key
   */
  private generateIdempotencyKey(input: string): string {
    return randomUUID();
  }

  /**
   * Handle Axios errors and convert to CircleWalletsError
   * 
   * @param error - Axios error
   * @returns CircleWalletsError
   */
  private handleAxiosError(error: AxiosError): CircleWalletsError {
    if (error.response) {
      const data = error.response.data as any;
      return new CircleWalletsError(
        data?.message || error.message,
        error.response.status,
        data?.code,
        data
      );
    } else if (error.request) {
      return new CircleWalletsError(
        'No response received from Circle API',
        undefined,
        'NO_RESPONSE'
      );
    } else {
      return new CircleWalletsError(
        error.message,
        undefined,
        'REQUEST_SETUP_ERROR'
      );
    }
  }
}

// Singleton instance
let circleService: CircleWalletsService | null = null;

/**
 * Get or create CircleWalletsService singleton instance
 * 
 * @returns CircleWalletsService instance
 */
export function getCircleService(): CircleWalletsService {
  if (!circleService) {
    circleService = new CircleWalletsService();
  }
  return circleService;
}
