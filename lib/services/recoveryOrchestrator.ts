/**
 * Recovery Orchestrator
 * Coordinates guardian-based wallet recovery with Arc Gateway fund migration
 */

import { ethers } from 'ethers';
import { getGuardianConfig, transferENSOwnership, setTextRecord } from './ensRecoveryService';
import { getTxExplorerUrl } from './circleCCTPService';

// In-memory recovery state (in production, use database)
interface RecoveryRequest {
  id: string;
  oldENSName: string;
  oldWalletAddress: string;
  newWalletAddress: string;
  guardians: string[];
  threshold: number;
  approvals: string[]; // Guardian addresses who approved
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  executedAt?: number;
  txHashes?: {
    ensTransfer?: string;
    fundMigration?: string[];
  };
}

const recoveryRequests: Map<string, RecoveryRequest> = new Map();

/**
 * Generate unique recovery ID
 */
function generateRecoveryId(oldENS: string, newWallet: string): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${oldENS}-${newWallet}-${Date.now()}`)
  ).substring(0, 18);
}

/**
 * Initiate recovery request
 */
export async function initiateRecovery(
  oldENSName: string,
  newWalletAddress: string
): Promise<{
  recoveryId: string;
  guardians: string[];
  threshold: number;
  status: string;
}> {
  // Validate new wallet address
  if (!ethers.isAddress(newWalletAddress)) {
    throw new Error('Invalid new wallet address');
  }
  
  // Get guardian configuration from ENS
  const config = await getGuardianConfig(oldENSName);
  
  if (config.guardians.length === 0) {
    throw new Error('No guardians configured for this ENS name');
  }
  
  if (!config.walletAddress) {
    throw new Error('No wallet address found in ENS records');
  }
  
  // Create recovery request
  const recoveryId = generateRecoveryId(oldENSName, newWalletAddress);
  
  const request: RecoveryRequest = {
    id: recoveryId,
    oldENSName,
    oldWalletAddress: config.walletAddress,
    newWalletAddress,
    guardians: config.guardians,
    threshold: config.threshold,
    approvals: [],
    status: 'pending',
    createdAt: Date.now()
  };
  
  recoveryRequests.set(recoveryId, request);
  
  console.log('🔄 Recovery initiated:', {
    recoveryId,
    oldENS: oldENSName,
    newWallet: newWalletAddress,
    guardians: config.guardians.length,
    threshold: config.threshold
  });
  
  return {
    recoveryId,
    guardians: config.guardians,
    threshold: config.threshold,
    status: 'pending'
  };
}

/**
 * Guardian approves recovery
 */
export async function approveRecovery(
  recoveryId: string,
  guardianAddress: string
): Promise<{
  approved: boolean;
  approvalsCount: number;
  thresholdMet: boolean;
  status: string;
}> {
  const request = recoveryRequests.get(recoveryId);
  
  if (!request) {
    throw new Error('Recovery request not found');
  }
  
  if (request.status !== 'pending') {
    throw new Error(`Recovery is already ${request.status}`);
  }
  
  // Validate guardian
  const isGuardian = request.guardians
    .map(g => g.toLowerCase())
    .includes(guardianAddress.toLowerCase());
  
  if (!isGuardian) {
    throw new Error('Address is not a guardian for this recovery');
  }
  
  // Check if already approved
  const alreadyApproved = request.approvals
    .map(a => a.toLowerCase())
    .includes(guardianAddress.toLowerCase());
  
  if (alreadyApproved) {
    throw new Error('Guardian has already approved this recovery');
  }
  
  // Add approval
  request.approvals.push(guardianAddress);
  
  const thresholdMet = request.approvals.length >= request.threshold;
  
  if (thresholdMet) {
    request.status = 'approved';
    console.log('✅ Recovery threshold met!', {
      recoveryId,
      approvals: request.approvals.length,
      threshold: request.threshold
    });
  }
  
  recoveryRequests.set(recoveryId, request);
  
  return {
    approved: true,
    approvalsCount: request.approvals.length,
    thresholdMet,
    status: request.status
  };
}

/**
 * Get recovery status
 */
export function getRecoveryStatus(recoveryId: string): RecoveryRequest | null {
  return recoveryRequests.get(recoveryId) || null;
}

/**
 * List all recovery requests (for guardian dashboard)
 */
export function listRecoveryRequests(guardianAddress?: string): RecoveryRequest[] {
  const all = Array.from(recoveryRequests.values());
  
  if (!guardianAddress) {
    return all;
  }
  
  // Filter by guardian
  return all.filter(req =>
    req.guardians
      .map(g => g.toLowerCase())
      .includes(guardianAddress.toLowerCase())
  );
}

/**
 * Execute recovery (after threshold met)
 */
export async function executeRecovery(
  recoveryId: string,
  executorPrivateKey: string
): Promise<{
  success: boolean;
  ensTransferTx?: string;
  fundMigrationTxs?: string[];
  newOwner: string;
}> {
  const request = recoveryRequests.get(recoveryId);
  
  if (!request) {
    throw new Error('Recovery request not found');
  }
  
  if (request.status !== 'approved') {
    throw new Error(`Cannot execute recovery in status: ${request.status}`);
  }
  
  if (request.approvals.length < request.threshold) {
    throw new Error('Threshold not met');
  }
  
  request.status = 'executing';
  recoveryRequests.set(recoveryId, request);
  
  console.log('🚀 Executing recovery...', {
    recoveryId,
    oldENS: request.oldENSName,
    newWallet: request.newWalletAddress
  });
  
  try {
    const txHashes: string[] = [];
    
    // Step 1: Transfer ENS ownership to new wallet
    console.log('📝 Step 1: Transferring ENS ownership...');
    const ensTransferTx = await transferENSOwnership(
      request.oldENSName,
      request.newWalletAddress,
      executorPrivateKey
    );
    txHashes.push(ensTransferTx);
    console.log('✅ ENS transferred:', ensTransferTx);
    
    // Step 2: Update wallet address in ENS text record
    console.log('📝 Step 2: Updating wallet text record...');
    const walletUpdateTx = await setTextRecord(
      request.oldENSName,
      'wallet',
      request.newWalletAddress,
      executorPrivateKey
    );
    txHashes.push(walletUpdateTx);
    console.log('✅ Wallet record updated:', walletUpdateTx);
    
    // Step 3: Migrate funds from old wallet to new wallet
    console.log('📝 Step 3: Migrating funds...');
    const fundMigrationTxs = await migrateFunds(
      request.oldWalletAddress,
      request.newWalletAddress,
      executorPrivateKey
    );
    txHashes.push(...fundMigrationTxs);
    console.log('✅ Funds migrated:', fundMigrationTxs.length, 'transactions');
    
    // Update request
    request.status = 'completed';
    request.executedAt = Date.now();
    request.txHashes = {
      ensTransfer: ensTransferTx,
      fundMigration: fundMigrationTxs
    };
    recoveryRequests.set(recoveryId, request);
    
    console.log('🎉 Recovery completed successfully!');
    
    return {
      success: true,
      ensTransferTx,
      fundMigrationTxs,
      newOwner: request.newWalletAddress
    };
    
  } catch (error: any) {
    console.error('❌ Recovery execution failed:', error);
    request.status = 'failed';
    recoveryRequests.set(recoveryId, request);
    
    throw new Error(`Recovery execution failed: ${error.message}`);
  }
}

/**
 * Migrate funds from old wallet to new wallet across all chains
 */
async function migrateFunds(
  oldWallet: string,
  newWallet: string,
  signerPrivateKey: string
): Promise<string[]> {
  const txHashes: string[] = [];
  
  // Networks to check and migrate
  const networks = [
    {
      name: 'ETH-SEPOLIA',
      rpc: 'https://eth-sepolia.api.onfinality.io/public',
      usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
    },
    {
      name: 'MATIC-AMOY',
      rpc: 'https://rpc-amoy.polygon.technology',
      usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
    },
    {
      name: 'ARC-TESTNET',
      rpc: 'https://rpc.testnet.arc.network',
      usdc: '0x3600000000000000000000000000000000000000' // Native USDC on Arc
    }
  ];
  
  console.log('💰 Checking balances across networks...');
  
  for (const network of networks) {
    try {
      const provider = new ethers.JsonRpcProvider(network.rpc);
      const signer = new ethers.Wallet(signerPrivateKey, provider);
      
      // Check ETH balance
      const ethBalance = await provider.getBalance(oldWallet);
      if (ethBalance > BigInt(0)) {
        console.log(`  💵 ${network.name}: ${ethers.formatEther(ethBalance)} ETH`);
        
        // Transfer ETH (leave some for gas)
        const gasReserve = ethers.parseEther('0.001');
        if (ethBalance > gasReserve) {
          const amountToSend = ethBalance - gasReserve;
          const tx = await signer.sendTransaction({
            to: newWallet,
            value: amountToSend
          });
          await tx.wait();
          txHashes.push(tx.hash);
          console.log(`  ✅ Transferred ${ethers.formatEther(amountToSend)} ETH`);
        }
      }
      
      // Check USDC balance
      if (network.usdc) {
        const usdcAbi = [
          'function balanceOf(address) view returns (uint256)',
          'function transfer(address to, uint256 amount) returns (bool)'
        ];
        
        const usdc = new ethers.Contract(network.usdc, usdcAbi, signer);
        const usdcBalance = await usdc.balanceOf(oldWallet);
        
        if (usdcBalance > BigInt(0)) {
          console.log(`  💵 ${network.name}: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
          
          const tx = await usdc.transfer(newWallet, usdcBalance);
          await tx.wait();
          txHashes.push(tx.hash);
          console.log(`  ✅ Transferred ${ethers.formatUnits(usdcBalance, 6)} USDC`);
        }
      }
      
    } catch (error: any) {
      console.warn(`  ⚠️  ${network.name} migration failed:`, error.message);
      // Continue with other networks even if one fails
    }
  }
  
  console.log(`✅ Fund migration complete: ${txHashes.length} transactions`);
  
  return txHashes;
}

/**
 * Cancel recovery (by guardian or owner)
 */
export function cancelRecovery(
  recoveryId: string,
  cancellerAddress: string
): boolean {
  const request = recoveryRequests.get(recoveryId);
  
  if (!request) {
    throw new Error('Recovery request not found');
  }
  
  if (request.status !== 'pending') {
    throw new Error('Can only cancel pending recoveries');
  }
  
  // Verify canceller is a guardian
  const isGuardian = request.guardians
    .map(g => g.toLowerCase())
    .includes(cancellerAddress.toLowerCase());
  
  if (!isGuardian) {
    throw new Error('Only guardians can cancel recovery');
  }
  
  recoveryRequests.delete(recoveryId);
  console.log('❌ Recovery cancelled:', recoveryId);
  
  return true;
}
