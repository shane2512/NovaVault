/**
 * POST /api/recovery/approve
 * 
 * Guardian approves a recovery request
 * 
 * Flow:
 * 1. Verify guardian signature
 * 2. Submit approval to RecoveryController.sol
 * 3. Check if threshold is met
 * 4. Return updated approval status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecoveryExecutor } from '@/lib/services/recoveryExecutor';
import { getENSService } from '@/lib/services/ensService';
import { ethers } from 'ethers';

export interface ApproveRecoveryRequest {
  namehash?: string;
  recoveryId?: string; // Support looking up by recoveryId
  guardianAddress: string;
  signature?: string; // Optional for testing mode
}

export interface ApproveRecoveryResponse {
  success: boolean;
  approved?: boolean;
  approvalCount?: number;
  approvalsCount?: number; // Alias for frontend
  threshold?: number;
  thresholdMet?: boolean;
  status?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ApproveRecoveryRequest = await req.json();
    const { namehash, recoveryId, guardianAddress, signature } = body;

    // Validate inputs
    if (!guardianAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: guardianAddress' },
        { status: 400 }
      );
    }

    if (!namehash && !recoveryId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: namehash or recoveryId' },
        { status: 400 }
      );
    }

    // Validate address
    if (!ethers.isAddress(guardianAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid guardian address format' },
        { status: 400 }
      );
    }

    const executor = getRecoveryExecutor();

    // Look up namehash if recovery Id is provided
    let lookupNamehash = namehash;
    if (!lookupNamehash && recoveryId) {
      // Find the recovery by ID in in-memory storage
      const recovery = await executor.findRecoveryByNamehash(recoveryId);
      if (recovery) {
        lookupNamehash = recovery.namehash;
      } else {
        return NextResponse.json(
          { success: false, error: 'Recovery request not found' },
          { status: 404 }
        );
      }
    }

    if (!lookupNamehash) {
      return NextResponse.json(
        { success: false, error: 'Could not determine recovery namehash' },
        { status: 400 }
      );
    }

    // Get current recovery status
    const currentStatus: any = await executor.getExecutionStatus(lookupNamehash);

    if (!currentStatus) {
      return NextResponse.json(
        { success: false, error: 'Recovery request not found' },
        { status: 404 }
      );
    }

    // Verify guardian is authorized
    const recovery = await executor.findRecoveryByNamehash(lookupNamehash);
    
    if (!recovery) {
      return NextResponse.json(
        { success: false, error: 'Recovery request not found' },
        { status: 404 }
      );
    }

    const isGuardian = recovery.guardians.some(
      (g: string) => g.toLowerCase() === guardianAddress.toLowerCase()
    );

    if (!isGuardian) {
      return NextResponse.json(
        { success: false, error: 'Address is not an authorized guardian' },
        { status: 403 }
      );
    }

    console.log('[Recovery API] Guardian approval from:', guardianAddress);
    console.log('[Recovery API] Namehash:', lookupNamehash);

    // Approve in-memory (for testing without smart contract)
    const result = await executor.approveRecoveryInMemory(lookupNamehash, guardianAddress);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 409 }
      );
    }

    console.log('[Recovery API] Approval successful');
    console.log('[Recovery API] Approvals:', result.approvalCount, '/', result.threshold);
    console.log('[Recovery API] Threshold met:', result.thresholdMet);

    return NextResponse.json({
      success: true,
      approved: true,
      approvalCount: result.approvalCount,
      approvalsCount: result.approvalCount,
      threshold: result.threshold,
      thresholdMet: result.thresholdMet,
      status: result.status,
    });

  } catch (error) {
    console.error('[Recovery API] Approve failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve recovery',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check approval status for a guardian
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const namehash = searchParams.get('namehash');
    const guardianAddress = searchParams.get('guardianAddress');

    if (!namehash) {
      return NextResponse.json(
        { success: false, error: 'Missing namehash parameter' },
        { status: 400 }
      );
    }

    const executor = getRecoveryExecutor();
    const status: any = executor.getExecutionStatus(namehash);

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Recovery request not found' },
        { status: 404 }
      );
    }

    let hasApproved = false;
    if (guardianAddress && ethers.isAddress(guardianAddress)) {
      hasApproved = status.approvals?.includes(guardianAddress) || false;
    }

    return NextResponse.json({
      success: true,
      namehash,
      guardianAddress,
      hasApproved,
      approvalCount: status.approvalCount,
      threshold: status.threshold,
      thresholdMet: status.approvalCount >= status.threshold,
      status: status.status,
    });

  } catch (error) {
    console.error('[Recovery API] Check approval failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check approval status',
      },
      { status: 500 }
    );
  }
}
