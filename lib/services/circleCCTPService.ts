/**
 * Circle CCTP Service using Circle Wallet SDK
 * 
 * Executes CCTP bridge transactions using Circle's Programmable Wallets
 * instead of private key signing.
 */

import 'server-only';
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { ethers } from 'ethers';
import { randomUUID } from 'crypto';

export type SupportedChain = 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'ARC-TESTNET';

// Block Explorer URLs for each network
export const BLOCK_EXPLORERS: Record<SupportedChain, { url: string; name: string }> = {
  'ETH-SEPOLIA': {
    url: 'https://sepolia.etherscan.io',
    name: 'Etherscan'
  },
  'MATIC-AMOY': {
    url: 'https://amoy.polygonscan.com',
    name: 'PolygonScan'
  },
  'ARC-TESTNET': {
    url: 'https://testnet.arcscan.app',
    name: 'ArcScan'
  }
};

// CCTP Contract Addresses
const CCTP_CONTRACTS = {
  'ETH-SEPOLIA': {
    chainId: 11155111,
    cctpDomain: 0,
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  },
  'MATIC-AMOY': {
    chainId: 80002,
    cctpDomain: 7,
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  },
  'ARC-TESTNET': {
    chainId: 5042002,
    cctpDomain: 26,
    usdcAddress: '0x3600000000000000000000000000000000000000',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  },
};

interface BridgeTransferParams {
  walletId: string;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amount: string;
  destinationAddress: string;
}

interface BridgeResult {
  burnTxHash: string;
  burnExplorerUrl: string;
  messageHash?: string;
  status: 'pending' | 'completed' | 'failed';
  estimatedTime: number;
}

/**
 * Get block explorer URL for a transaction
 */
export function getTxExplorerUrl(chain: SupportedChain, txHash: string): string {
  return `${BLOCK_EXPLORERS[chain].url}/tx/${txHash}`;
}

/**
 * Get block explorer URL for an address
 */
export function getAddressExplorerUrl(chain: SupportedChain, address: string): string {
  return `${BLOCK_EXPLORERS[chain].url}/address/${address}`;
}

/**
 * Initialize Circle Wallets Client
 */
async function initializeClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('Circle credentials not configured');
  }

  return initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
}

/**
 * Approve USDC spending for TokenMessenger contract
 */
async function approveUSDC(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  walletId: string,
  sourceChain: SupportedChain,
  amount: string
): Promise<string> {
  const contracts = CCTP_CONTRACTS[sourceChain];
  const amountInWei = ethers.parseUnits(amount, 6).toString(); // USDC has 6 decimals
  
  console.log(`Approving ${amount} USDC (${amountInWei} units) for TokenMessenger...`);
  
  const response = await client.createContractExecutionTransaction({
    idempotencyKey: randomUUID(),
    walletId: walletId,
    contractAddress: contracts.usdcAddress,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [
      { type: 'address', value: contracts.tokenMessenger },
      { type: 'uint256', value: amountInWei }
    ],
    fee: {
      type: 'level',
      config: {
        feeLevel: 'MEDIUM',
      },
    },
  } as any);
  
  return response.data?.id || '';
}

/**
 * Execute CCTP depositForBurn
 */
async function burnUSDC(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  walletId: string,
  sourceChain: SupportedChain,
  destinationChain: SupportedChain,
  amount: string,
  recipientAddress: string
): Promise<{ txHash: string; messageHash?: string }> {
  const sourceContracts = CCTP_CONTRACTS[sourceChain];
  const destDomain = CCTP_CONTRACTS[destinationChain].cctpDomain;
  const amountInWei = ethers.parseUnits(amount, 6).toString();
  
  // Convert recipient address to bytes32 (remove 0x, pad to 64 chars)
  const recipientBytes32 = '0x' + recipientAddress.slice(2).padStart(64, '0');
  
  console.log(`Burning ${amount} USDC for transfer to domain ${destDomain}...`);
  console.log(`Recipient (bytes32): ${recipientBytes32}`);
  
  const response = await client.createContractExecutionTransaction({
    idempotencyKey: randomUUID(),
    walletId: walletId,
    contractAddress: sourceContracts.tokenMessenger,
    abiFunctionSignature: 'depositForBurn(uint256,uint32,bytes32,address)',
    abiParameters: [
      { type: 'uint256', value: amountInWei },
      { type: 'uint32', value: destDomain.toString() },
      { type: 'bytes32', value: recipientBytes32 },
      { type: 'address', value: sourceContracts.usdcAddress }
    ],
    fee: {
      type: 'level',
      config: {
        feeLevel: 'MEDIUM',
      },
    },
  } as any);
  
  return {
    txHash: response.data?.id || '',
    // Message hash would need to be extracted from logs
  };
}

/**
 * Bridge USDC using Circle Developer-Controlled Wallets + CCTP
 * 
 * This uses createContractExecutionTransaction to call:
 * 1. approve() on USDC contract
 * 2. depositForBurn() on TokenMessenger
 */
export async function bridgeUSDCWithCircleWallet(
  params: BridgeTransferParams
): Promise<BridgeResult> {
  const { walletId, sourceChain, destinationChain, amount, destinationAddress } = params;

  try {
    const client = await initializeClient();
    
    console.log('🌉 Starting CCTP bridge via Circle Developer-Controlled Wallets');
    console.log(`Amount: ${amount} USDC`);
    console.log(`Route: ${sourceChain} → ${destinationChain}`);
    console.log(`Recipient: ${destinationAddress}`);
    
    // Step 1: Approve USDC
    console.log('\n📝 Step 1: Approving USDC spend...');
    const approveTxHash = await approveUSDC(client, walletId, sourceChain, amount);
    console.log(`✅ Approve TX: ${approveTxHash}`);
    
    // Wait a bit for approval to confirm
    console.log('⏳ Waiting 10s for approval confirmation...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 2: Execute depositForBurn
    console.log('\n🔥 Step 2: Executing depositForBurn...');
    const burnResult = await burnUSDC(
      client,
      walletId,
      sourceChain,
      destinationChain,
      amount,
      destinationAddress
    );
    console.log(`✅ Burn TX: ${burnResult.txHash}`);
    
    return {
      burnTxHash: burnResult.txHash,
      burnExplorerUrl: getTxExplorerUrl(sourceChain, burnResult.txHash),
      messageHash: burnResult.messageHash,
      status: 'pending',
      estimatedTime: 1200, // 20 minutes for CCTP
    };
  } catch (error: any) {
    console.error('❌ Bridge failed:', error);
    
    // Extract Circle API error message if available
    const errorMessage = error.response?.data?.message ||
                        error.message ||
                        'Unknown error';
    
    throw new Error(`Circle bridge failed: ${errorMessage}`);
  }
}

/**
 * Get USDC balance for a Circle wallet (fallback method)
 */
export async function getCircleWalletUSDCBalance(
  walletId: string,
  chain: SupportedChain
): Promise<string> {
  try {
    const client = await initializeClient();
    const balanceResponse = await client.getWalletTokenBalance({ id: walletId });
    const usdcToken = balanceResponse.data?.tokenBalances?.find(
      (balance) => balance.token?.symbol === 'USDC' && balance.token?.blockchain === chain
    );
    
    return usdcToken?.amount || '0';
  } catch (error) {
    console.error('Failed to get Circle wallet balance:', error);
    return '0';
  }
}
