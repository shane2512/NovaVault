/**
 * Circle Bridge Kit Service
 * 
 * Uses Circle's official Bridge Kit SDK for CCTP transfers
 * https://developers.circle.com/bridge-kit
 */

import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromPrivateKey } from '@circle-fin/adapter-viem-v2';

export type SupportedChain = 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'UNICHAIN-SEPOLIA';

// Chain name mapping for Bridge Kit (with underscores as per official SDK)
const CHAIN_MAPPING: Record<SupportedChain, string> = {
  'ETH-SEPOLIA': 'Ethereum_Sepolia',
  'MATIC-AMOY': 'Polygon_Amoy_Testnet',
  'UNICHAIN-SEPOLIA': 'Unichain_Sepolia',
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
    chain: CHAIN_MAPPING[sourceChain] as any,
  });

  const destAdapter = createAdapterFromPrivateKey({
    privateKey: privateKey as `0x${string}`,
    chain: CHAIN_MAPPING[destinationChain] as any,
  });
  
  console.log(`Bridging ${amount} USDC from ${sourceChain} to ${destinationChain}...`);
  
  // Execute bridge transfer with both adapters
  const result = await kit.bridge({
    from: {
      adapter: sourceAdapter,
      chain: CHAIN_MAPPING[sourceChain] as any,
    },
    to: {
      adapter: destAdapter,
      chain: CHAIN_MAPPING[destinationChain] as any,
      recipientAddress: recipient, // Optional - if not provided, uses source address
    },
    amount: amount,
    token: 'USDC',
  });
  
  console.log('Bridge operation started:', result.id);
  
  return {
    operationId: result.id,
    burnTxHash: result.burn?.txHash || '',
    mintTxHash: result.mint?.txHash,
    status: result.status,
  };
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
    chain: CHAIN_MAPPING[sourceChain] as any,
  });
  
  const estimate = await kit.estimate({
    from: {
      adapter,
      chain: CHAIN_MAPPING[sourceChain] as any,
    },
    to: {
      chain: CHAIN_MAPPING[destinationChain] as any,
    },
    amount,
    token: 'USDC',
  });
  
  return {
    fees: estimate.fees,
    gasFees: estimate.gasFees,
    estimatedTime: estimate.estimatedTimeSeconds,
  };
}
