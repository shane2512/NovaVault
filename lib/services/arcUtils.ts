import { ethers } from "ethers";

/**
 * Arc Network Configuration (verified from docs.arc.network)
 * Client-safe utilities - no Circle SDK dependencies
 */
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
    usdc: "0x3600000000000000000000000000000000000000", // Real USDC on Arc
    eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  }
} as const;

/**
 * Arc Utilities - Client-safe helper functions
 * These don't require Circle SDK and can be used in browser
 */
export class ArcUtils {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(ARC_CONFIG.rpcUrl);
  }

  /**
   * Connect to Arc Network with user's wallet
   */
  async connect(signer: ethers.Signer) {
    this.signer = signer;
    return await signer.getAddress();
  }

  /**
   * Get USDC balance (native balance on Arc)
   */
  async getUSDCBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatUnits(balance, 18);
  }

  /**
   * Get Explorer  URL for address
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

  /**
   * Format balance with decimals
   */
  formatBalance(balance: string, decimals: number = 18): string {
    return ethers.formatUnits(balance, decimals);
  }
}

// Export singleton instance for convenience
export const arcUtils = new ArcUtils();
