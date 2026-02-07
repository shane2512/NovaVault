/**
 * Circle Bridge Kit + Programmable Wallets Integration (CLIENT-SIDE)
 * 
 * Uses Circle's Bridge Kit SDK with Circle Programmable Wallets for secure CCTP bridging
 * This must run client-side (browser) as it requires user authentication
 * 
 * Flow:
 * 1. User authenticates with Circle Web SDK (PIN/biometrics)
 * 2. Web SDK creates a signer compatible with Bridge Kit
 * 3. Bridge Kit constructs CCTP transactions (approve + depositForBurn)
 * 4. Circle signs via MPC and broadcasts
 * 
 * @see https://developers.circle.com/bridge-kit
 * @see https://developers.circle.com/wallets/web
 */

import { BridgeKit } from '@circle-fin/bridge-kit';
import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk';

export type SupportedChain = 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'ARC-TESTNET' | 'UNICHAIN-SEPOLIA';

// Chain name mapping for Bridge Kit (official SDK format)
const CHAIN_MAPPING: Record<SupportedChain, string> = {
  'ETH-SEPOLIA': 'Ethereum_Sepolia',
  'MATIC-AMOY': 'Polygon_Amoy_Testnet',
  'ARC-TESTNET': 'Arc_Testnet', // Check Bridge Kit docs for exact name
  'UNICHAIN-SEPOLIA': 'Unichain_Sepolia',
};

interface BridgeTransfer {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amount: string;
  recipient?: string;
  walletId: string; // Circle wallet ID
}

/**
 * Initialize Circle Web SDK (must be called client-side)
 */
export function initializeCircleWebSDK(appId: string): W3SSdk {
  const sdk = new W3SSdk();
  sdk.setAppSettings({
    appId,
  });
  return sdk;
}

/**
 * Transfer USDC using Bridge Kit + Circle Programmable Wallets
 * 
 * IMPORTANT: This function must be called from the browser (client-side)
 * It requires user authentication via Circle Web SDK
 */
export async function bridgeUSDCWithCircleWallet({
  sourceChain,
  destinationChain,
  amount,
  recipient,
  walletId,
  circleSDK,
}: BridgeTransfer & { circleSDK: W3SSdk }): Promise<{
  operationId: string;
  burnTxHash: string;
  mintTxHash?: string;
  status: string;
  burnExplorerUrl: string;
  mintExplorerUrl?: string;
}> {
  
  console.log('🌉 Initializing Circle Bridge Kit...');
  
  // Step 1: Authenticate user with Circle (if not already authenticated)
  // This will prompt PIN/biometrics if needed
  await circleSDK.execute(walletId);
  
  console.log('✅ Circle authentication successful');
  
  // Step 2: Get Circle wallet signer
  // The Web SDK provides a signer that Bridge Kit can use
  // Note: getSigner may not be available in all SDK versions
  let signer;
  try {
    signer = (circleSDK as any).getSigner?.(walletId);
  } catch (error) {
    console.warn('[Bridge] getSigner not available, using fallback');
  }

  if (!signer) {
    throw new Error('Failed to get Circle wallet signer');
  }
  
  console.log('✅ Circle signer obtained');
  
  // Step 3: Initialize Bridge Kit
  const bridgeKit = new BridgeKit();
  
  // Step 4: Create adapter from Circle signer
  // Note: We may need to wrap the Circle signer to match Bridge Kit's adapter interface
  const sourceAdapter = createCircleAdapter(signer, sourceChain);
  const destAdapter = recipient 
    ? createRecipientAdapter(recipient, destinationChain)
    : sourceAdapter;
  
  console.log(`🌉 Bridging ${amount} USDC from ${sourceChain} to ${destinationChain}...`);
  
  // Step 5: Execute bridge transaction
  const result: any = await bridgeKit.bridge({
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
  
  console.log('✅ Bridge operation started:', result.id);
  
  // Step 6: Generate explorer URLs
  const burnTxHash = result.burn?.txHash || result.txHash || '';
  const mintTxHash = result.mint?.txHash || '';
  
  return {
    operationId: result.id || 'unknown',
    burnTxHash,
    mintTxHash,
    status: result.status || 'pending',
    burnExplorerUrl: getTxExplorerUrl(sourceChain, burnTxHash),
    mintExplorerUrl: mintTxHash ? getTxExplorerUrl(destinationChain, mintTxHash) : undefined,
  };
}

/**
 * Create Bridge Kit adapter from Circle signer
 */
function createCircleAdapter(signer: any, chain: SupportedChain) {
  // TODO: Implement adapter wrapper
  // Bridge Kit expects a specific adapter interface
  // We need to wrap Circle's signer to match that interface
  // 
  // The adapter should implement:
  // - address: string
  // - signMessage(message): Promise<string>
  // - signTransaction(tx): Promise<string>
  // - sendTransaction(tx): Promise<{hash: string}>
  
  return {
    address: signer.address,
    signMessage: async (message: string) => {
      return await signer.signMessage(message);
    },
    signTransaction: async (tx: any) => {
      return await signer.signTransaction(tx);
    },
    sendTransaction: async (tx: any) => {
      return await signer.sendTransaction(tx);
    },
  };
}

/**
 * Create adapter for recipient address (if different from sender)
 */
function createRecipientAdapter(address: string, chain: SupportedChain) {
  // For recipient-only operations, we just need the address
  return {
    address,
    signMessage: async () => { throw new Error('Recipient cannot sign'); },
    signTransaction: async () => { throw new Error('Recipient cannot sign'); },
    sendTransaction: async () => { throw new Error('Recipient cannot send'); },
  };
}

/**
 * Get transaction explorer URL
 */
function getTxExplorerUrl(chain: SupportedChain, txHash: string): string {
  const explorers: Record<SupportedChain, string> = {
    'ETH-SEPOLIA': 'https://sepolia.etherscan.io/tx',
    'MATIC-AMOY': 'https://amoy.polygonscan.com/tx',
    'ARC-TESTNET': 'https://testnet.arcscan.app/tx',
    'UNICHAIN-SEPOLIA': 'https://unichain-sepolia.blockscout.com/tx',
  };
  
  return `${explorers[chain]}/${txHash}`;
}

/**
 * Listen to bridge status updates (client-side only)
 */
export function subscribeToBridgeStatus(
  bridgeKit: BridgeKit,
  operationId: string,
  onUpdate: (status: any) => void
) {
  // Bridge Kit provides event listeners for status updates
  // Implementation depends on Bridge Kit SDK version
  
  bridgeKit.on('*', (update: any) => {
    if (update.id === operationId) {
      onUpdate(update);
    }
  });
}
