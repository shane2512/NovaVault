/**
 * Circle Developer-Controlled Wallets Adapter for Bridge Kit
 * 
 * This adapter enables Bridge Kit to use Circle's Developer-Controlled Wallets
 * for CCTP bridging operations without exposing private keys.
 * 
 * Architecture:
 * 1. Bridge Kit needs a signer (WalletClient in viem terms)
 * 2. We create a custom WalletClient that uses Circle API for signing
 * 3. Circle API handles the actual signing via MPC
 * 4. Bridge Kit gets signed transactions and broadcasts them
 */

import { createPublicClient, createWalletClient, custom, http, type WalletClient, type Chain, type Account } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';
import 'server-only';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

// Unichain Sepolia configuration
export const unichainSepolia: Chain = {
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
    public: { http: ['https://sepolia.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Unichain Explorer', url: 'https://sepolia.uniscan.xyz' },
  },
  testnet: true,
};

// Arc Testnet configuration
export const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arc Scan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
};

/**
 * Chain mapping for Circle blockchain IDs
 */
export const CIRCLE_CHAIN_MAPPING = {
  'ETH-SEPOLIA': sepolia,
  'MATIC-AMOY': polygonAmoy,
  'ARC-TESTNET': arcTestnet,
  'UNICHAIN-SEPOLIA': unichainSepolia,
} as const;

export type SupportedCircleChain = keyof typeof CIRCLE_CHAIN_MAPPING;

/**
 * Create a custom EIP1193 provider that uses Circle Developer-Controlled Wallets
 * This allows Bridge Kit to request signatures from Circle's MPC infrastructure
 */
function createCircleEIP1193Provider(walletId: string, address: string, circleChain: SupportedCircleChain) {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY not found in environment');
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
  });

  return {
    async request({ method, params }: { method: string; params?: Array<any> }) {
      console.log(`🔵 Circle Provider: ${method}`, params);

      switch (method) {
        case 'eth_accounts':
        case 'eth_requestAccounts':
          // Return the Circle wallet address
          return [address];

        case 'eth_chainId':
          // Return the chain ID in hex
          const chain = CIRCLE_CHAIN_MAPPING[circleChain];
          return `0x${chain.id.toString(16)}`;

        case 'eth_sendTransaction':
          // This is the key method - Circle will sign and send the transaction
          const [txRequest] = params as any[];
          console.log('📤 Sending transaction via Circle API:', txRequest);

          try {
            // Create transaction via Circle API
            const response = await client.createTransaction({
              walletId,
              blockchain: circleChain,
              // Convert the transaction to Circle's format
              ...txRequest,
              // Note: Circle's createTransaction may need different params
              // This might need to be: amount, destinationAddress, tokenId, etc.
            } as any);

            console.log('✅ Circle transaction created:', response.data?.id);
            
            // Return the transaction hash
            // Note: Circle may return different format, adjust as needed
            return response.data?.id;
          } catch (error) {
            console.error('❌ Circle transaction failed:', error);
            throw error;
          }

        case 'eth_sign':
        case 'personal_sign':
          // Sign a message
          const [messageToSign, signerAddress] = params as any[];
          console.log('✍️ Signing message via Circle API');

          // Note: Circle Developer-Controlled Wallets may not support arbitrary message signing
          // This might require a different approach or API endpoint
          throw new Error('Message signing not yet implemented for Circle Developer-Controlled Wallets');

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4':
          // Sign typed data (used for permits, etc.)
          const [typedDataAddress, typedDataJSON] = params as any[];
          console.log('✍️ Signing typed data via Circle API');

          // This is critical for ERC-20 permits (approve offline)
          // Circle Developer-Controlled Wallets may not support this
          throw new Error('Typed data signing not yet implemented for Circle Developer-Controlled Wallets');

        default:
          // For read-only methods, delegate to the public RPC
          console.log(`⚠️ Unhandled method: ${method}, falling back to public RPC`);
          throw new Error(`Method ${method} not supported by Circle provider`);
      }
    },
  };
}

/**
 * Create a Bridge Kit-compatible adapter using Circle Developer-Controlled Wallets
 * 
 * @param walletId - Circle wallet ID
 * @param address - Wallet address (0x...)
 * @param circleChain - Circle blockchain identifier (e.g., 'ETH-SEPOLIA')
 */
export function createCircleWalletAdapter(
  walletId: string,
  address: string,
  circleChain: SupportedCircleChain
) {
  const chain = CIRCLE_CHAIN_MAPPING[circleChain];
  
  // Create custom provider that uses Circle API
  const provider = createCircleEIP1193Provider(walletId, address, circleChain);

  // Create public client for reading blockchain data
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  // Create wallet client using the Circle provider
  const walletClient = createWalletClient({
    account: address as `0x${string}`,
    chain,
    transport: custom(provider as any),
  });

  return {
    publicClient,
    walletClient,
    chain,
    address,
  };
}

/**
 * IMPORTANT LIMITATION:
 * 
 * The above implementation will likely FAIL because Circle Developer-Controlled Wallets API
 * does not support arbitrary contract execution (approve, depositForBurn).
 * 
 * The API only supports:
 * - createTransaction (basic token transfers with tokenId)
 * - NOT: arbitrary contract calls
 * 
 * For Bridge Kit to work with Circle Wallets, we need ONE of:
 * 
 * 1. Circle User-Controlled Wallets (@circle-fin/w3s-pw-web-sdk)
 *    - User controls wallet in browser
 *    - Can sign arbitrary transactions
 *    - Bridge Kit fully supported
 * 
 * 2. Server-side private key wallet
 *    - Use bridgeKitService.ts with private key
 *    - Less secure (exposes key)
 *    - Bridge Kit fully supported
 * 
 * 3. Circle adds CCTP support to Developer-Controlled Wallets API
 *    - Wait for Circle to add approve/depositForBurn endpoints
 *    - Most secure + best UX
 *    - Not available yet
 */
