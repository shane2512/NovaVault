/**
 * Cross-Chain USDC Service
 * 
 * Handles USDC transfers across multiple chains using Circle CCTP
 * 
 * SETUP REQUIRED:
 * 1. Install Circle SDK: npm install @circle-fin/cctp-sdk
 * 2. Configure Arc SDK
 * 3. Update .env with CCTP contract addresses
 * 
 * DOCUMENTATION:
 * - Circle CCTP: https://developers.circle.com/stablecoins/docs/cctp-getting-started
 * - Arc Gateway: https://docs.arc.network/arc/gateway
 * - Arc USDC: https://docs.arc.network/arc/bridging-usdc
 */

import { ethers } from 'ethers';

// Supported chains for USDC transfers
export const SUPPORTED_CHAINS = {
  'ETH-SEPOLIA': {
    chainId: 11155111,
    cctpDomain: 0,
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    tokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    rpcUrl: 'https://1rpc.io/sepolia'
  },
  'MATIC-AMOY': {
    chainId: 80002,
    cctpDomain: 7, // Fixed: Polygon Amoy domain is 7, not 1
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    tokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    rpcUrl: 'https://rpc-amoy.polygon.technology'
  },
  'ARC-TESTNET': {
    chainId: 5042002,
    cctpDomain: 26,
    usdcAddress: '0x3600000000000000000000000000000000000000',
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    tokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    rpcUrl: 'https://rpc.testnet.arc.network'
  },
  'UNICHAIN-SEPOLIA': {
    chainId: 1301,
    cctpDomain: 10,
    usdcAddress: process.env.UNICHAIN_USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Fallback to Sepolia USDC for testing
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    tokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    rpcUrl: 'https://sepolia.unichain.org'
  }
} as const;

export type SupportedChain = keyof typeof SUPPORTED_CHAINS;

// CCTP Source Chain Restrictions (from official Circle docs)
// https://developers.circle.com/cctp/concepts/supported-chains-and-domains  
// Arc Testnet (domain 26) is DESTINATION ONLY - cannot be used as source
const DESTINATION_ONLY_CHAINS: SupportedChain[] = ['ARC-TESTNET'];

interface CrossChainTransfer {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amount: string;
  recipient: string;
}

interface TransferResult {
  burnTxHash: string;
  mintTxHash: string;
  attestationId: string;
  status: 'pending' | 'attested' | 'completed' | 'failed';
  estimatedTime: number; // in seconds
}

/**
 * Send USDC to another chain using Circle CCTP
 * 
 * FLOW:
 * 1. Approve USDC on source chain
 * 2. Burn USDC via TokenMessenger
 * 3. Wait for Circle attestation
 * 4. Mint USDC on destination chain
 */
export async function sendUSDCToChain(
  transfer: CrossChainTransfer
): Promise<TransferResult> {
  const { sourceChain, destinationChain, amount, recipient } = transfer;
  
  // Validate chains
  if (!SUPPORTED_CHAINS[sourceChain] || !SUPPORTED_CHAINS[destinationChain]) {
    throw new Error('Unsupported chain');
  }
  
  // Validate source chain restrictions (Arc Testnet is destination-only per Circle CCTP docs)
  if (DESTINATION_ONLY_CHAINS.includes(sourceChain)) {
    throw new Error(
      `❌ Arc Testnet can only receive USDC (destination-only chain per Circle CCTP).\\n\\n` +
      `Please select a different source chain:\\n` +
      `✅ Ethereum Sepolia\\n` +
      `✅ Polygon Amoy\\n` +
      `✅ Unichain Sepolia\\n\\n` +
      `See CCTP_ROUTES.md for all supported routes.`
    );
  }
  
  // Step 1: Burn USDC on source chain
  console.log(`Step 1/3: Burning USDC on ${sourceChain}...`);
  const { hash: burnTxHash, messageHash } = await burnUSDC(sourceChain, amount, destinationChain, recipient);
  
  // Step 2: Fetch Circle attestation
  console.log(`Step 2/3: Waiting for Circle attestation...`);
  const { attestation, status } = await fetchAttestation(messageHash);
  
  if (status !== 'complete') {
    throw new Error('Failed to get attestation from Circle');
  }
  
  // Step 3: Mint USDC on destination chain
  console.log(`Step 3/3: Minting USDC on ${destinationChain}...`);
  // Note: We need to extract the message from burn tx logs
  // For now, we'll need to fetch it from the burn transaction receipt
  const sourceConfig = SUPPORTED_CHAINS[sourceChain];
  const sourceNetwork = ethers.Network.from({ name: sourceChain, chainId: sourceConfig.chainId });
  const sourceProvider = new ethers.JsonRpcProvider(sourceConfig.rpcUrl, sourceNetwork, { staticNetwork: sourceNetwork });
  const burnReceipt = await sourceProvider.getTransactionReceipt(burnTxHash);
  const messengerAbi = ['event MessageSent(bytes message)'];
  const iface = new ethers.Interface(messengerAbi);
  
  let messageBytes = '';
  for (const log of burnReceipt!.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'MessageSent') {
        messageBytes = parsed.args.message;
        break;
      }
    } catch {}
  }
  
  if (!messageBytes) {
    throw new Error('Could not extract message from burn transaction');
  }
  
  const mintTx = await mintUSDC(
    destinationChain,
    messageBytes,
    attestation
  );
  
  return {
    burnTxHash,
    mintTxHash: mintTx.hash,
    attestationId: messageHash,
    status: 'completed',
    estimatedTime: calculateBridgeTime(sourceChain, destinationChain)
  };
}

/**
 * Burn USDC on source chain
 */
async function burnUSDC(
  sourceChain: SupportedChain,
  amount: string,
  destinationChain: SupportedChain,
  recipient: string
): Promise<{ hash: string; messageHash: string }> {
  const chainConfig = SUPPORTED_CHAINS[sourceChain];
  const destConfig = SUPPORTED_CHAINS[destinationChain];
  
  // Setup provider and signer
  const network = ethers.Network.from({ name: sourceChain, chainId: chainConfig.chainId });
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, network, { staticNetwork: network });
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in environment');
  }
  const signer = new ethers.Wallet(privateKey, provider);
  
  console.log(`Burning ${amount} USDC on ${sourceChain} for ${destinationChain}...`);
  
  // 1. USDC Token Contract
  const usdcAbi = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)'
  ];
  const usdc = new ethers.Contract(chainConfig.usdcAddress, usdcAbi, signer);
  
  // Convert amount to wei (USDC has 6 decimals)
  const amountWei = ethers.parseUnits(amount, 6);
  
  // Check balance
  const signerAddress = await signer.getAddress();
  const balance = await usdc.balanceOf(signerAddress);
  console.log(`Signer address: ${signerAddress}`);
  console.log(`Current USDC balance: ${ethers.formatUnits(balance, 6)}`);
  
  if (balance < amountWei) {
    throw new Error(`Insufficient USDC balance. Have: ${ethers.formatUnits(balance, 6)} USDC, Need: ${amount} USDC. Get testnet USDC from https://faucet.circle.com/`);
  }
  
  // 2. Approve TokenMessenger to spend USDC
  const currentAllowance = await usdc.allowance(signerAddress, chainConfig.tokenMessenger);
  console.log(`Current allowance: ${ethers.formatUnits(currentAllowance, 6)}`);
  console.log(`TokenMessenger: ${chainConfig.tokenMessenger}`);
  console.log(`USDC address: ${chainConfig.usdcAddress}`);
  
  if (currentAllowance < amountWei) {
    console.log(`Approving ${amount} USDC...`);
    try {
      const approveTx = await usdc.approve(chainConfig.tokenMessenger, amountWei);
      console.log(`Approval tx: ${approveTx.hash}`);
      const approveReceipt = await approveTx.wait();
      console.log(`Approval confirmed in block ${approveReceipt.blockNumber}`);
      
      // Verify approval worked
      const newAllowance = await usdc.allowance(signerAddress, chainConfig.tokenMessenger);
      console.log(`New allowance: ${ethers.formatUnits(newAllowance, 6)}`);
      
      if (newAllowance < amountWei) {
        throw new Error('Approval did not update allowance correctly');
      }
    } catch (error: any) {
      console.error('Approval failed:', error);
      throw new Error(`Failed to approve USDC: ${error.message}`);
    }
  } else {
    console.log('Sufficient allowance already exists');
  }
  
  // 3. TokenMessenger Contract
  const messengerAbi = [
    'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64)',
    'event MessageSent(bytes message)'
  ];
  const tokenMessenger = new ethers.Contract(chainConfig.tokenMessenger, messengerAbi, signer);
  
  // Convert recipient address to bytes32
  const recipientBytes32 = ethers.zeroPadValue(recipient, 32);
  
  // 4. Call depositForBurn
  console.log(`Calling depositForBurn with:`);
  console.log(`  Amount: ${amount} USDC (${amountWei.toString()} wei)`);
  console.log(`  Destination domain: ${destConfig.cctpDomain}`);
  console.log(`  Recipient: ${recipient} (${recipientBytes32})`);
  console.log(`  Burn token: ${chainConfig.usdcAddress}`);
  
  let burnTx;
  try {
    // Estimate gas first to catch errors early
    const gasEstimate = await tokenMessenger.depositForBurn.estimateGas(
      amountWei,
      destConfig.cctpDomain,
      recipientBytes32,
      chainConfig.usdcAddress
    );
    console.log(`Estimated gas: ${gasEstimate.toString()}`);
    
    burnTx = await tokenMessenger.depositForBurn(
      amountWei,
      destConfig.cctpDomain,
      recipientBytes32,
      chainConfig.usdcAddress
    );
  } catch (error: any) {
    console.error('depositForBurn failed:', error);
    
    // Provide helpful error messages
    if (error.message?.includes('insufficient allowance') || error.message?.includes('ERC20: insufficient allowance')) {
      throw new Error('USDC approval insufficient. Please try again.');
    } else if (error.message?.includes('burn amount exceeds balance')) {
      throw new Error('Insufficient USDC balance for this transfer.');
    } else if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient native token for gas fees. Get testnet ETH/MATIC/etc from a faucet.');
    }
    
    throw new Error(`Failed to burn USDC: ${error.message || 'Unknown error'}`);
  }
  
  const receipt = await burnTx.wait();
  console.log(`Burn transaction confirmed: ${receipt.hash}`);
  
  // Extract message hash from logs
  const messageSentEvent = receipt.logs.find((log: any) => {
    try {
      const parsed = tokenMessenger.interface.parseLog(log);
      return parsed?.name === 'MessageSent';
    } catch {
      return false;
    }
  });
  
  let messageHash = '';
  if (messageSentEvent) {
    const parsed = tokenMessenger.interface.parseLog(messageSentEvent);
    const messageBytes = parsed?.args.message;
    messageHash = ethers.keccak256(messageBytes);
    console.log(`Message hash: ${messageHash}`);
  }
  
  return {
    hash: receipt.hash,
    messageHash
  };
}

/**
 * Fetch Circle attestation for a burn transaction
 */
async function fetchAttestation(messageHash: string): Promise<{
  attestation: string;
  status: string;
}> {
  // Circle's Iris API for testnet
  const IRIS_API_URL = 'https://iris-api-sandbox.circle.com';
  
  console.log(`Fetching attestation for message hash: ${messageHash}`);
  
  let attempts = 0;
  const maxAttempts = 60; // Try for up to 5 minutes (60 * 5 seconds)
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${IRIS_API_URL}/attestations/${messageHash}`);
      
      if (response.status === 200) {
        const data = await response.json();
        
        if (data.status === 'complete' && data.attestation) {
          console.log('✅ Attestation received!');
          return {
            attestation: data.attestation,
            status: 'complete'
          };
        }
        
        console.log(`Attestation status: ${data.status}, waiting...`);
      } else if (response.status === 404) {
        console.log(`Attempt ${attempts + 1}/${maxAttempts}: Attestation not ready yet...`);
      } else {
        console.error(`Unexpected response status: ${response.status}`);
      }
      
      // Wait 5 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
      
    } catch (error) {
      console.error('Error fetching attestation:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
  }
  
  throw new Error('Attestation timeout - please try again later or check Circle Attestation API');
}

/**
 * Mint USDC on destination chain
 */
async function mintUSDC(
  destinationChain: SupportedChain,
  message: string,
  attestation: string
): Promise<{ hash: string }> {
  const chainConfig = SUPPORTED_CHAINS[destinationChain];
  
  // Setup provider and signer
  const network = ethers.Network.from({ name: destinationChain, chainId: chainConfig.chainId });
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, network, { staticNetwork: network });
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in environment');
  }
  const signer = new ethers.Wallet(privateKey, provider);
  
  console.log(`Minting USDC on ${destinationChain}...`);
  
  // MessageTransmitter Contract
  const transmitterAbi = [
    'function receiveMessage(bytes calldata message, bytes calldata attestation) returns (bool)',
    'function usedNonces(bytes32 hashSourceAndNonce) view returns (uint256)'
  ];
  const messageTransmitter = new ethers.Contract(
    chainConfig.messageTransmitter,
    transmitterAbi,
    signer
  );
  
  // Check if message already used (to avoid reverts)
  const messageBytes = ethers.getBytes(message);
  const messageHash = ethers.keccak256(messageBytes);
  const usedNonce = await messageTransmitter.usedNonces(messageHash);
  
  if (usedNonce > 0) {
    throw new Error('Message already processed on destination chain');
  }
  
  // Call receiveMessage
  console.log('Calling receiveMessage...');
  const mintTx = await messageTransmitter.receiveMessage(
    message,
    attestation
  );
  
  const receipt = await mintTx.wait();
  console.log(`✅ Mint transaction confirmed: ${receipt.hash}`);
  
  return {
    hash: receipt.hash
  };
}

/**
 * Get unified USDC balance across all chains
 */
export async function getCrossChainBalance(
  address: string
): Promise<{
  total: string;
  breakdown: Array<{ chain: SupportedChain; balance: string }>;
}> {
  // Only check the 3 Circle wallet networks (exclude UNICHAIN-SEPOLIA)
  const chains: SupportedChain[] = ['ETH-SEPOLIA', 'MATIC-AMOY', 'ARC-TESTNET'];
  
  // Fetch balances in parallel
  const balances = await Promise.all(
    chains.map(chain => getUSDCBalance(chain, address))
  );
  
  const breakdown = chains.map((chain, i) => ({
    chain,
    balance: balances[i]
  }));
  
  const total = balances.reduce((sum, balance) => {
    return (parseFloat(sum) + parseFloat(balance)).toString();
  }, '0');
  
  return { total, breakdown };
}

/**
 * Get USDC balance on a specific chain
 */
async function getUSDCBalance(
  chain: SupportedChain,
  address: string
): Promise<string> {
  const chainConfig = SUPPORTED_CHAINS[chain];
  const network = ethers.Network.from({ name: chain, chainId: chainConfig.chainId });
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, network, { staticNetwork: network });
  
  const usdcContract = new ethers.Contract(
    chainConfig.usdcAddress,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  try {
    const balance = await usdcContract.balanceOf(address);
    return ethers.formatUnits(balance, 6); // USDC has 6 decimals
  } catch (error) {
    console.error(`Failed to fetch balance on ${chain}:`, error);
    return '0';
  }
}

/**
 * Calculate estimated bridge time between chains
 */
function calculateBridgeTime(
  sourceChain: SupportedChain,
  destinationChain: SupportedChain
): number {
  // Base time: Circle attestation (10-20 seconds)
  let baseTime = 15;
  
  // Add network-specific delays
  if (sourceChain === 'ARC-TESTNET' || destinationChain === 'ARC-TESTNET') {
    baseTime += 30; // Arc might be slower
  }
  
  return baseTime;
}

/**
 * Monitor transfer status
 */
export async function getTransferStatus(
  attestationId: string
): Promise<TransferResult['status']> {
  // TODO: Query Circle API for attestation status
  
  return 'pending';
}
