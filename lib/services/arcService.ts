import { ethers } from "ethers";

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
  },
} as const;

/**
 * Arc Service - Handles interactions with Arc Network
 */
export class ArcService {
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
   * @param address - Wallet address
   * @returns Balance in USDC (18 decimals)
   */
  async getUSDCBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatUnits(balance, 18);
  }

  /**
   * Get USDC balance in human-readable format (6 decimals)
   * @param address - Wallet address
   * @returns Balance formatted as USDC with 6 decimals
   */
  async getUSDCBalanceFormatted(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    // Convert from 18 decimals (native) to 6 decimals (display)
    const balanceIn6Decimals = balance / BigInt(10 ** 12);
    return ethers.formatUnits(balanceIn6Decimals, 6);
  }

  /**
   * Send USDC to another address
   * @param to - Recipient address
   * @param amount - Amount in USDC (will be converted to 18 decimals)
   */
  async sendUSDC(to: string, amount: string) {
    if (!this.signer) throw new Error("No signer connected");

    const amountWei = ethers.parseUnits(amount, 18);
    const tx = await this.signer.sendTransaction({
      to,
      value: amountWei,
    });

    return await tx.wait();
  }

  /**
   * Get contract instance for SmartWallet
   */
  getSmartWallet(address: string, abi: any) {
    if (!this.signer) throw new Error("No signer connected");
    return new ethers.Contract(address, abi, this.signer);
  }

  /**
   * Deploy SmartWallet contract
   */
  async deploySmartWallet(abi: any, bytecode: string) {
    if (!this.signer) throw new Error("No signer connected");

    const factory = new ethers.ContractFactory(abi, bytecode, this.signer);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    return await contract.getAddress();
  }

  /**
   * Get current gas price in USDC
   */
  async getGasPrice(): Promise<string> {
    const feeData = await this.provider.getFeeData();
    return ethers.formatUnits(feeData.gasPrice || 0, 6); // Format as USDC
  }

  /**
   * Check network connection
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string) {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string, confirmations = 1) {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Get Explorer URL for address
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
export const arcService = new ArcService();
