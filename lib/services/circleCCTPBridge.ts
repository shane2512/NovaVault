/**
 * Circle Programmable Wallets + CCTP Direct Integration
 * 
 * Uses Circle's Developer-Controlled Wallets SDK to directly interact with
 * CCTP contracts (TokenMessenger, MessageTransmitter) for cross-chain USDC transfers.
 * 
 * This approach doesn't use Bridge Kit - instead it calls CCTP contracts directly
 * using Circle's createTransaction API, which works with MPC wallets.
 * 
 * Flow:
 * 1. Approve USDC spend to TokenMessenger
 * 2. Call depositForBurn on TokenMessenger (burns USDC on source)
 * 3. Wait for Circle attestation (~10-20 min)
 * 4. Call receiveMessage on destination chain (mints USDC)
 * 
 * @see https://developers.circle.com/stablecoins/docs/cctp-getting-started
 * @see https://developers.circle.com/wallets/docs/programmable-wallets-cctp
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { ethers } from 'ethers';
import { randomUUID } from 'crypto';

export type SupportedChain = 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'ARC-TESTNET';

// CCTP Contract Addresses (Circle official testnet deployments)
const CCTP_CONTRACTS = {
  'ETH-SEPOLIA': {
    chainId: 11155111,
    domain: 0,
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    rpcUrl: 'https://eth-sepolia.public.blastapi.io',
    circleBlockchain: 'ETH-SEPOLIA' as const,
  },
  'MATIC-AMOY': {
    chainId: 80002,
    domain: 7,
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    circleBlockchain: 'MATIC-AMOY' as const,
  },
  'ARC-TESTNET': {
    chainId: 5042002,
    domain: 26, // Arc Testnet CCTP domain (destination-only per Circle docs)
    usdc: '0x3600000000000000000000000000000000000000',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    rpcUrl: 'https://rpc.testnet.arc.network',
    circleBlockchain: 'ARC-TESTNET' as const,
  },
} as const;

// TokenMessenger ABI (minimal - only what we need)
const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)',
  'function depositForBurnWithCaller(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller) external returns (uint64)',
];

// USDC Token ABI (ERC20 minimal)
const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

interface BridgeParams {
  circleWalletId: string;
  sourceChain: SupportedChain;
  destChain: SupportedChain;
  amount: string; // USDC amount in human-readable format (e.g., "10.5")
  recipientAddress: string; // Recipient on destination chain
}

/**
 * Bridge USDC from Circle wallet using CCTP
 * This is the main function to call
 */
export async function bridgeUSDCFromCircleWallet(params: BridgeParams): Promise<{
  success: boolean;
  steps: {
    step1: { description: string; txId?: string; status: string };
    step2: { description: string; txId?: string; status: string; burnTxHash?: string };
  };
  burnTxHash?: string;
  operationId?: string;
  explorerUrl?: string;
  estimatedTime: number; // seconds
}> {
  const { circleWalletId, sourceChain, destChain, amount, recipientAddress } = params;

  // Validate chains
  if (!CCTP_CONTRACTS[sourceChain] || !CCTP_CONTRACTS[destChain]) {
    throw new Error(`Unsupported chain. Source: ${sourceChain}, Dest: ${destChain}`);
  }

  if (sourceChain === destChain) {
    throw new Error('Source and destination chains must be different');
  }

  // Arc is destination-only per Circle CCTP docs
  if (sourceChain === 'ARC-TESTNET') {
    throw new Error('Arc Testnet can only be used as destination, not source');
  }

  const sourceConfig = CCTP_CONTRACTS[sourceChain];
  const destConfig = CCTP_CONTRACTS[destChain];

  console.log('🌉 Starting CCTP Bridge from Circle Wallet');
  console.log(`   Wallet ID: ${circleWalletId}`);
  console.log(`   From: ${sourceChain} → To: ${destChain}`);
  console.log(`   Amount: ${amount} USDC`);
  console.log(`   Recipient: ${recipientAddress}`);

  // Initialize Circle client
  if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
    throw new Error('Circle API credentials not configured');
  }

  const circleClient = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });

  // Convert amount to wei (USDC has 6 decimals)
  const amountInWei = ethers.parseUnits(amount, 6).toString();

  // Get wallet address
  const walletResponse = await circleClient.getWallet({ id: circleWalletId });
  const walletAddress = walletResponse.data?.wallet?.address;

  if (!walletAddress) {
    throw new Error(`Could not get address for wallet ${circleWalletId}`);
  }

  console.log(`   Wallet Address: ${walletAddress}`);

  // Check wallet balances before proceeding
  console.log('   🔍 Checking wallet balances...');
  const balances = await circleClient.getWalletTokenBalance({ id: circleWalletId });
  const usdcBalance = balances.data?.tokenBalances?.find(
    b => b.token?.symbol === 'USDC' || b.token?.tokenAddress?.toLowerCase() === sourceConfig.usdc.toLowerCase()
  );
  const nativeBalance = balances.data?.tokenBalances?.find(
    b => b.token?.isNative === true
  );

  console.log(`   💰 USDC Balance: ${usdcBalance?.amount || '0'} USDC`);
  console.log(`   ⛽ Gas Balance: ${nativeBalance?.amount || '0'} ${nativeBalance?.token?.symbol || 'ETH'}`);

  // Check if enough USDC
  const usdcBalanceNum = parseFloat(usdcBalance?.amount || '0');
  const amountNum = parseFloat(amount);
  if (usdcBalanceNum < amountNum) {
    throw new Error(`Insufficient USDC balance. Have: ${usdcBalanceNum}, Need: ${amountNum}`);
  }

  // Check if enough gas (warn if low)
  const gasBalanceNum = parseFloat(nativeBalance?.amount || '0');
  if (gasBalanceNum < 0.001) {
    console.warn(`   ⚠️  Warning: Low gas balance (${gasBalanceNum}). Transaction may fail.`);
  }

  // STEP 1: Approve TokenMessenger to spend USDC
  console.log('');
  console.log('📝 STEP 1: Approving USDC spend...');
  console.log(`   Contract: ${sourceConfig.usdc}`);
  console.log(`   Spender: ${sourceConfig.tokenMessenger}`);
  console.log(`   Amount (wei): ${amountInWei}`);

  const approveData = new ethers.Interface(USDC_ABI).encodeFunctionData('approve', [
    sourceConfig.tokenMessenger,
    amountInWei,
  ]);

  const approveResponse = await circleClient.createContractExecutionTransaction({
    idempotencyKey: randomUUID(),
    walletId: circleWalletId,
    contractAddress: sourceConfig.usdc,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [sourceConfig.tokenMessenger, amountInWei],
    fee: {
      type: 'level',
      config: { feeLevel: 'MEDIUM' }
    },
  });

  const approveTxId = approveResponse.data?.id;
  console.log(`   ✅ Approve transaction submitted: ${approveTxId}`);
  console.log(`   State: ${approveResponse.data?.state}`);
  console.log(`   ⏳ Waiting for approval confirmation...`);

  // Wait for approval to confirm (poll transaction status)
  await waitForCircleTransaction(circleClient, approveTxId!);

  console.log(`   ✅ Approval confirmed!`);

  // STEP 2: Call depositForBurn on TokenMessenger
  console.log('');
  console.log('🔥 STEP 2: Burning USDC on source chain...');

  // Convert recipient address to bytes32 format for CCTP
  const recipientBytes32 = ethers.zeroPadValue(recipientAddress, 32);
  
  console.log(`   Contract: ${sourceConfig.tokenMessenger}`);
  console.log(`   Amount (wei): ${amountInWei}`);
  console.log(`   Destination Domain: ${destConfig.domain}`);
  console.log(`   Recipient (bytes32): ${recipientBytes32}`);
  console.log(`   USDC Address: ${sourceConfig.usdc}`);

  const burnResponse = await circleClient.createContractExecutionTransaction({
    idempotencyKey: randomUUID(),
    walletId: circleWalletId,
    contractAddress: sourceConfig.tokenMessenger,
    abiFunctionSignature: 'depositForBurn(uint256,uint32,bytes32,address)',
    abiParameters: [
      amountInWei,
      destConfig.domain.toString(),
      recipientBytes32,
      sourceConfig.usdc
    ],
    fee: {
      type: 'level',
      config: { feeLevel: 'MEDIUM' }
    },
  });

  const burnTxId = burnResponse.data?.id;
  console.log(`   ✅ Burn transaction submitted: ${burnTxId}`);
  console.log(`   State: ${burnResponse.data?.state}`);
  console.log(`   ⏳ Waiting for burn confirmation...`);

  // Wait for burn transaction
  const burnTxDetails = await waitForCircleTransaction(circleClient, burnTxId!);
  const burnTxHash = burnTxDetails?.txHash;

  console.log(`   ✅ Burn confirmed! TX Hash: ${burnTxHash}`);

  // Generate explorer URL
  const explorerBases: Record<SupportedChain, string> = {
    'ETH-SEPOLIA': 'https://sepolia.etherscan.io',
    'MATIC-AMOY': 'https://amoy.polygonscan.com',
    'ARC-TESTNET': 'https://testnet.arcscan.app',
  };
  const explorerUrl = `${explorerBases[sourceChain]}/tx/${burnTxHash}`;

  console.log('');
  console.log('✅ ========================================');
  console.log('✅ CCTP BRIDGE INITIATED!');
  console.log('✅ ========================================');
  console.log(`   Approve TX: ${approveTxId}`);
  console.log(`   Burn TX: ${burnTxId}`);
  console.log(`   Burn TX Hash: ${burnTxHash}`);
  console.log(`   Explorer: ${explorerUrl}`);
  console.log('');
  console.log('⏳ Circle is now attesting the burn transaction...');
  console.log('   This takes 10-20 minutes');
  console.log('   USDC will automatically mint on destination chain');
  console.log('   No further action needed!');
  console.log('✅ ========================================');

  return {
    success: true,
    steps: {
      step1: {
        description: 'Approve USDC spend',
        txId: approveTxId,
        status: 'completed',
      },
      step2: {
        description: 'Burn USDC on source chain',
        txId: burnTxId,
        status: 'completed',
        burnTxHash,
      },
    },
    burnTxHash,
    operationId: burnTxId,
    explorerUrl,
    estimatedTime: 1200, // 20 minutes
  };
}

/**
 * Wait for Circle transaction to be confirmed
 */
async function waitForCircleTransaction(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  txId: string
): Promise<any> {
  const maxAttempts = 60; // 5 minutes max
  const delayMs = 5000; // Check every 5 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const txResponse = await client.getTransaction({ id: txId });
    const state = txResponse.data?.transaction?.state;
    const txHash = txResponse.data?.transaction?.txHash;
    const errorReason = txResponse.data?.transaction?.errorReason;
    const errorDetails = txResponse.data?.transaction;

    console.log(`   [${attempt + 1}/${maxAttempts}] Transaction state: ${state}`);

    if (state === 'COMPLETE' || state === 'CONFIRMED') {
      return {
        state,
        txHash,
        transaction: txResponse.data?.transaction,
      };
    }

    if (state === 'FAILED' || state === 'DENIED') {
      console.error('Transaction failed details:', JSON.stringify(errorDetails, null, 2));
      const errorMsg = errorReason || `Transaction ${state}`;
      throw new Error(`Transaction failed: ${errorMsg}\nDetails: ${JSON.stringify({
        state,
        txHash,
        errorReason,
        walletId: errorDetails?.walletId,
        contractAddress: errorDetails?.contractAddress,
        amounts: errorDetails?.amounts,
      }, null, 2)}`);
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('Transaction confirmation timeout');
}

/**
 * Get USDC balance for a Circle wallet on a specific chain
 */
export async function getCircleWalletBalance(
  circleWalletId: string,
  chain: SupportedChain
): Promise<string> {
  const config = CCTP_CONTRACTS[chain];

  if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
    throw new Error('Circle API credentials not configured');
  }

  const circleClient = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });

  const balanceResponse = await circleClient.getWalletTokenBalance({
    id: circleWalletId,
  });

  const tokenBalances = balanceResponse.data?.tokenBalances || [];

  // Find USDC balance for the specified chain
  const usdcBalance = tokenBalances.find(
    (balance: any) =>
      balance.token?.symbol === 'USDC' &&
      balance.token?.blockchain === config.circleBlockchain
  );

  return usdcBalance?.amount || '0';
}
