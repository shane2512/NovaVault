import 'server-only';
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";import { randomUUID } from 'crypto';
// Arc Network Configuration (verified from docs.arc.network)
export const ARC_CONFIG = {
  chainId: 5042002,
  rpcUrl: "https://rpc.testnet.arc.network",
  name: "Arc Testnet",
  explorerUrl: "https://testnet.arcscan.app",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18, // Native balance
  },
  // Verified contract addresses from docs.arc.network/arc/references/contract-addresses
  contracts: {
    usdc: "0x3600000000000000000000000000000000000000",
    eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    // CCTP Contracts (Domain 26)
    cctp: {
      tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
      messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
      tokenMinter: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192",
      message: "0xbaC0179bB358A8936169a63408C8481D582390C4",
    },
    // Gateway Contracts (Domain 26)
    gateway: {
      wallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
      minter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    },
    // Common Ethereum Contracts
    create2Factory: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  },
} as const;

/**
 * Circle Wallets Service - MPC-based wallet infrastructure
 */
export class CircleWalletsService {
  private client: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;
  private walletSetId: string;

  constructor() {
    this.walletSetId = process.env.CIRCLE_WALLET_SET_ID || "";
  }

  /**
   * Initialize Circle Wallets SDK client
   */
  async initialize() {
    if (this.client) return this.client;

    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
      throw new Error("Circle API key and entity secret required");
    }

    this.client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    return this.client;
  }

  /**
   * Create a new wallet set
   */
  async createWalletSet(name: string) {
    const client = await this.initialize();
    
    const response = await client.createWalletSet({
      idempotencyKey: randomUUID(),
      name,
    });

    return response.data?.walletSet;
  }

  /**
   * Create wallets on Arc Network
   * @param count - Number of wallets to create
   */
  async createWallets(count: number = 1) {
    const client = await this.initialize();

    if (!this.walletSetId) {
      throw new Error("Wallet Set ID not configured. Set CIRCLE_WALLET_SET_ID in .env");
    }

    const response = await client.createWallets({
      idempotencyKey: randomUUID(),
      walletSetId: this.walletSetId,
      blockchains: ["ARC-TESTNET"],
      count,
      accountType: "EOA", // Externally Owned Account
    });

    return response.data?.wallets;
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string) {
    const client = await this.initialize();
    const response = await client.getWallet({ id: walletId });
    return response.data?.wallet;
  }

  /**
   * List all wallets in the wallet set
   */
  async listWallets() {
    const client = await this.initialize();

    const response = await client.listWallets({
      walletSetId: this.walletSetId,
      blockchain: "ARC-TESTNET",
      pageSize: 50,
    });

    return response.data?.wallets;
  }

  /**
   * Get wallet balance (USDC and other tokens)
   */
  async getWalletBalance(walletId: string) {
    const client = await this.initialize();
    
    const response = await client.getWalletTokenBalance({
      id: walletId,
    });

    return response.data?.tokenBalances;
  }

  /**
   * Transfer USDC from wallet
   * @param walletId - Source wallet ID
   * @param destinationAddress - Recipient address
   * @param amount - Amount in USDC (e.g., "10.50")
   */
  async transferUSDC(walletId: string, destinationAddress: string, amount: string) {
    const client = await this.initialize();

    // Get USDC token ID (this should be cached in production)
    const balances = await this.getWalletBalance(walletId);
    const usdcToken = balances?.find((b) => b.token?.symbol === "USDC");

    if (!usdcToken?.token?.id) {
      throw new Error("USDC token not found");
    }

    const response = await client.createTransaction({
      idempotencyKey: randomUUID(),
      walletId,
      tokenId: usdcToken.token.id,
      destinationAddress,
      amount: [amount],
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
    });

    return response.data;
  }

  /**
   * Get transaction status
   */
  async getTransaction(transactionId: string) {
    const client = await this.initialize();
    const response = await client.getTransaction({ id: transactionId });
    return response.data?.transaction;
  }

  /**
   * List transactions for a wallet
   */
  async listTransactions(walletId: string, limit: number = 20) {
    const client = await this.initialize();

    const response = await client.listTransactions({
      walletIds: [walletId],
      pageSize: limit,
    });

    return response.data?.transactions;
  }

  /**
   * Estimate transfer fee
   */
  async estimateFee(walletId: string, destinationAddress: string, amount: string) {
    const client = await this.initialize();

    const balances = await this.getWalletBalance(walletId);
    const usdcToken = balances?.find((b) => b.token?.symbol === "USDC");

    if (!usdcToken?.token?.id) {
      throw new Error("USDC token not found");
    }

    const response = await client.estimateTransferFee({
      walletId,
      tokenId: usdcToken.token.id,
      destinationAddress,
      amount: [amount],
    });

    return response.data;
  }

  /**
   * Execute smart contract method
   */
  async executeContract(
    walletId: string,
    contractAddress: string,
    functionSignature: string,
    parameters: any[]
  ) {
    const client = await this.initialize();

    const response = await client.createContractExecutionTransaction({
      idempotencyKey: randomUUID(),
      walletId,
      contractAddress,
      abiFunctionSignature: functionSignature,
      abiParameters: parameters,
      fee: {
        type: 'level',
        config: {
          feeLevel: 'MEDIUM',
        },
      },
    });

    return response.data;
  }

  /**
   * Get Explorer URL for wallet address
   */
  getExplorerUrl(address: string): string {
    return `${ARC_CONFIG.explorerUrl}/address/${address}`;
  }

  /**
   * Get Explorer URL for transaction
   */
  getTxExplorerUrl(txHash: string): string {
    return `${ARC_CONFIG.explorerUrl}/tx/${txHash}`;
  }
}

// Singleton instance
export const circleWalletsService = new CircleWalletsService();
