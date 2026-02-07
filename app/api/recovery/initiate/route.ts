/**
 * POST /api/recovery/initiate
 * 
 * Initiates a guardian-based recovery flow
 * 
 * Flow:
 * 1. Read guardian config from ENS
 * 2. Submit recovery request to RecoveryController.sol
 * 3. Create Gateway policy
 * 4. Return recovery details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecoveryExecutor, RecoveryRequest } from '@/lib/services/recoveryExecutor';
import { getGuardianConfig, getTextRecord } from '@/lib/services/ensRecoveryService';
import { ethers } from 'ethers';

export interface InitiateRecoveryRequest {
  ensName?: string;
  oldENSName?: string; // Alternative field name from frontend
  currentOwner?: string; // Optional, will fetch from ENS if not provided
  newOwner?: string;
  newWalletAddress?: string; // Alternative field name from frontend
  circleWalletId?: string; // Optional, will read from ENS if not provided
}

export interface InitiateRecoveryResponse {
  success: boolean;
  request?: RecoveryRequest;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: InitiateRecoveryRequest = await req.json();
    
    // Support both field name formats
    const ensName = body.ensName || body.oldENSName;
    const newOwner = body.newOwner || body.newWalletAddress;
    let currentOwner = body.currentOwner;
    const circleWalletId = body.circleWalletId;

    // Validate inputs
    if (!ensName || !newOwner) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: ensName and newWalletAddress' },
        { status: 400 }
      );
    }

    // Validate new owner address
    if (!ethers.isAddress(newOwner)) {
      return NextResponse.json(
        { success: false, error: 'Invalid new wallet address format' },
        { status: 400 }
      );
    }
    
    // Fetch current owner from ENS if not provided
    if (!currentOwner) {
      try {
        const provider = new ethers.JsonRpcProvider(
          process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.api.onfinality.io/public'
        );
        const resolvedAddress = await provider.resolveName(ensName);
        if (resolvedAddress) {
          currentOwner = resolvedAddress;
          console.log('[Recovery API] Resolved current owner from ENS:', currentOwner);
        } else {
          return NextResponse.json(
            { success: false, error: 'Could not resolve current owner from ENS. The ENS name may not have an ETH address set.' },
            { status: 404 }
          );
        }
      } catch (err) {
        console.error('[Recovery API] Error resolving ENS:', err);
        return NextResponse.json(
          { success: false, error: 'Failed to resolve ENS name to current owner address' },
          { status: 500 }
        );
      }
    }
    
    // Validate current owner address
    if (!ethers.isAddress(currentOwner)) {
      return NextResponse.json(
        { success: false, error: 'Invalid current owner address format' },
        { status: 400 }
      );
    }

    // Check if recovery is already in progress
    const namehash = ethers.namehash(ensName);
    const executor = getRecoveryExecutor();

    try {
      const existingStatus: any = await executor.getRecoveryStatus(namehash);
      
      if (existingStatus.status === 'PENDING' || existingStatus.status === 'APPROVED') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Recovery already in progress for this ENS name',
            existing: existingStatus 
          },
          { status: 409 }
        );
      }
    } catch (err) {
      // No existing recovery, continue
    }

    // Verify guardian configuration exists using ensRecoveryService
    let guardianConfig;
    try {
      guardianConfig = await getGuardianConfig(ensName);
    } catch (err: any) {
      // Provide more helpful error with debugging info
      return NextResponse.json(
        { 
          success: false, 
          error: `Guardian configuration not found for "${ensName}". Make sure you have set up guardians for this ENS name in the wallet dashboard. You can verify your ENS records at: /api/ens/debug?name=${ensName}`,
          details: err.message
        },
        { status: 404 }
      );
    }
    
    if (!guardianConfig || guardianConfig.guardians.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `No guardians configured for "${ensName}". Please set up guardians in the wallet dashboard first.`,
        },
        { status: 404 }
      );
    }

    console.log('[Recovery API] Initiating recovery for:', ensName);
    console.log('[Recovery API] Guardians:', guardianConfig.guardians.length);
    console.log('[Recovery API] Threshold:', guardianConfig.threshold);
    console.log('[Recovery API] Current Owner:', currentOwner);
    console.log('[Recovery API] New Owner:', newOwner);

    // Get Circle wallet ID if not provided
    let walletId = circleWalletId;
    if (!walletId) {
      walletId = await getTextRecord(ensName, 'circleWalletId') || undefined;
      if (!walletId) {
        console.warn('[Recovery API] Circle wallet ID not found, recovery will proceed without it');
      }
    }

    // Get executor and initiate recovery
    console.log('[Recovery API] ========== CALLING EXECUTOR ==========');
    // Reuse executor instance from above
    
    // Initiate recovery with guardian config
    const request = await executor.initiateRecovery(
      ensName,
      currentOwner,
      newOwner,
      guardianConfig.guardians,
      guardianConfig.threshold,
      walletId
    );
    console.log('[Recovery API] ========== EXECUTOR RETURNED ==========');

    console.log('[Recovery API] Recovery initiated successfully');
    console.log('[Recovery API] Namehash:', request.namehash);
    console.log('[Recovery API] Request ID:', request.requestId);

    return NextResponse.json({
      success: true,
      recoveryId: request.requestId,  // Use the actual requestId from executor
      guardians: guardianConfig.guardians,
      threshold: guardianConfig.threshold,
      request: {
        requestId: request.requestId,
        namehash: request.namehash,
        ensName: ensName,
        currentOwner: currentOwner,
        newOwner: newOwner,
        guardians: guardianConfig.guardians,
        threshold: guardianConfig.threshold,
        approvalCount: 0,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        circleWalletId: walletId,
      },
    });

  } catch (error) {
    console.error('[Recovery API] Initiate failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate recovery',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if recovery can be initiated
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ensName = searchParams.get('ensName');

    if (!ensName) {
      return NextResponse.json(
        { success: false, error: 'Missing ensName parameter' },
        { status: 400 }
      );
    }
    
    // Check guardian configuration using ensRecoveryService
    const guardianConfig = await getGuardianConfig(ensName);
    const circleWalletId = await getTextRecord(ensName, 'circleWalletId');
    
    // Resolve wallet address
    const provider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.api.onfinality.io/public'
    );
    const walletAddress = await provider.resolveName(ensName);

    return NextResponse.json({
      success: true,
      canInitiate: !!(guardianConfig && guardianConfig.guardians.length > 0 && walletAddress),
      ensName,
      walletAddress,
      circleWalletId,
      guardians: guardianConfig?.guardians || [],
      threshold: guardianConfig?.threshold || 0,
    });

  } catch (error) {
    console.error('[Recovery API] Check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check recovery status',
      },
      { status: 500 }
    );
  }
}
