/**
 * Circle Bridge Kit Service
 * 
 * Uses Circle's official Bridge Kit SDK for CCTP transfers
 * https://developers.circle.com/bridge-kit
 */

import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';

export type SupportedChain = 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'UNICHAIN-SEPOLIA' | 'ARC-TESTNET';

// Chain name mapping for Bridge Kit (with underscores as per official SDK)
const CHAIN_MAPPING: Record<SupportedChain, string> = {
  'ETH-SEPOLIA': 'Ethereum_Sepolia',
  'MATIC-AMOY': 'Polygon_Amoy_Testnet',
  'UNICHAIN-SEPOLIA': 'Unichain_Sepolia',
  'ARC-TESTNET': 'Arc_Testnet',
};

interface BridgeTransfer {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amount: string;
  recipient?: string; // Optional - defaults to sender address
}

/**
 * Transfer USDC using Bridge Kit SDK
 */
export async function transferUSDCViaBridgeKit({
  sourceChain,
  destinationChain,
  amount,
  recipient,
}: BridgeTransfer): Promise<{
  operationId: string;
  burnTxHash: string;
  mintTxHash?: string;
  status: string;
}> {
  // Initialize Bridge Kit
  const kit = new BridgeKit();
  
  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in environment');
  }
  
  // Create adapters for both source and destination chains
  // Bridge Kit API requires adapters for both sides
  const sourceAdapter = createAdapterFromPrivateKey({
    privateKey: privateKey as `0x${string}`,
  } as any);

  const destAdapter = createAdapterFromPrivateKey({
    privateKey: privateKey as `0x${string}`,
  } as any);
  
  // Get bridge wallet address for warning message
  const { Wallet } = await import('ethers');
  const bridgeWallet = new Wallet(privateKey);
  const bridgeWalletAddress = bridgeWallet.address;
  
  console.log(`\n⚠️  IMPORTANT: Bridge Kit uses dedicated bridge wallet: ${bridgeWalletAddress}`);
  console.log(`   This wallet must have USDC on ${sourceChain} to bridge from it.`);
  console.log(`   Fund at: https://faucet.circle.com\n`);
  console.log(`Bridging ${amount} USDC from ${sourceChain} to ${destinationChain}...`);
  
  try {
    // Execute bridge transfer with both adapters
    const result: any = await kit.bridge({
    from: {
      adapter: sourceAdapter,
      chain: CHAIN_MAPPING[sourceChain] as any,
    },
    to: {
      adapter: destAdapter,
      chain: CHAIN_MAPPING[destinationChain] as any,
      recipientAddress: recipient,
    },
    amount: amount,
    token: 'USDC',
  } as any);
  
  // Debug: Log full response structure (BigInt-safe)
  console.log('🔍 Bridge Kit raw response:', JSON.stringify(result, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2));
  console.log('🔍 Response keys:', Object.keys(result || {}));
  console.log('🔍 Result type:', typeof result);
  
  // Parse response more robustly
  const operationId = result?.id || result?.operationId || result?.transactionId || 'unknown';
  const burnTxHash = result?.burn?.transactionHash || result?.burn?.txHash || result?.transactionHash || result?.txHash || result?.hash || '';
  const mintTxHash = result?.mint?.transactionHash || result?.mint?.txHash || '';
  const status = result?.status || result?.state || 'pending';
  
    console.log('Bridge operation started:', operationId);
    console.log('Burn TX Hash:', burnTxHash);
    
    if (!burnTxHash) {
      console.warn('⚠️ No burn transaction hash found in Bridge Kit response!');
      console.warn('Response structure:', result);
    }
    
    return {
      operationId,
      burnTxHash,
      mintTxHash,
      status,
    };
  } catch (error: any) {
    // Enhanced error message for insufficient balance
    if (error.message && (error.message.includes('insufficient') || error.message.includes('balance'))) {
      const errorMsg = `Insufficient USDC on ${sourceChain}.\n\n` +
        `Bridge wallet: ${bridgeWalletAddress}\n` +
        `This wallet needs USDC on ${sourceChain} to bridge from it.\n\n` +
        `Steps to fix:\n` +
        `1. Go to https://faucet.circle.com\n` +
        `2. Request USDC for ${bridgeWalletAddress}\n` +
        `3. Wait for confirmation\n` +
        `4. Try bridging again\n\n` +
        `Note: The bridge wallet is separate from your Circle wallets shown in the UI.`;
      
      console.error('❌ Bridge Wallet Insufficient Balance:', errorMsg);
      throw new Error(errorMsg);
    }
    throw error;
  }
}

/**
 * Get bridge operation status
 */
export async function getBridgeStatus(operationId: string) {
  const kit = new BridgeKit();
  // Note: getStatus might not be available in all versions
  // Check Bridge Kit documentation for exact API
  return {
    operationId,
    status: 'Use Bridge Kit event listeners for status updates',
  };
}

/**
 * Estimate bridge fees
 */
export async function estimateBridgeFee({
  sourceChain,
  destinationChain,
  amount,
}: Omit<BridgeTransfer, 'recipient'>) {
  const kit = new BridgeKit();
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in environment');
  }
  
  const adapter = createAdapterFromPrivateKey({
    privateKey: privateKey as `0x${string}`,
  } as any);
  
  const estimate: any = await kit.estimate({
    from: {
      adapter,
      chain: CHAIN_MAPPING[sourceChain] as any,
    },
    to: {
      adapter,
      chain: CHAIN_MAPPING[destinationChain] as any,
    },
    amount,
    token: 'USDC',
  } as any);
  
  return {
    fees: estimate.fees || '0',
    gasFees: estimate.gasFees || '0',
    estimatedTime: estimate.estimatedTimeSeconds || estimate.estimatedTime || 300,
  };
}
