/**
 * GET /api/recovery/status
 * 
 * Get recovery request status and progress
 * 
 * Returns:
 * - Recovery request details
 * - Guardian approvals
 * - Gateway policy status
 * - Execution progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecoveryExecutor, RecoveryStatus } from '@/lib/services/recoveryExecutor';
import { getENSService } from '@/lib/services/ensService';
import { ethers } from 'ethers';

export interface RecoveryStatusResponse {
  success: boolean;
  status?: RecoveryStatus & {
    guardians?: Array<{
      address: string;
      approved: boolean;
    }>;
    gatewayStatus?: string;
    estimatedExecutionTime?: string;
  };
  error?: string;
}

/**
 * Helper function to get all recoveries for a guardian
 */
async function getRecoveriesForGuardian(guardianAddress: string) {
  try {
    console.log('[Recovery API] Getting recoveries for guardian:', guardianAddress);
    
    const executor = getRecoveryExecutor();
    const recoveries = await executor.getRecoveriesForGuardian(guardianAddress);

    console.log('[Recovery API] Found recoveries:', recoveries.length);

    return NextResponse.json({
      success: true,
      recoveries: recoveries.map((r: any) => ({
        id: r.requestId,
        oldENSName: r.ensName,
        oldWalletAddress: r.currentOwner,
        newWalletAddress: r.newOwner,
        guardians: r.guardians,
        threshold: r.threshold,
        approvals: r.approvals || [],
        status: r.status?.toLowerCase() || 'pending',
        createdAt: new Date(r.createdAt).getTime(),
      })),
    });
  } catch (error: any) {
    console.error('[Recovery API] Failed to list recoveries for guardian:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recoveries' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const namehash = searchParams.get('namehash');
    const ensName = searchParams.get('ensName');
    const guardianAddress = searchParams.get('guardianAddress');
    const recoveryId = searchParams.get('recoveryId');

    // Support listing all recoveries for a guardian
    if (guardianAddress) {
      return await getRecoveriesForGuardian(guardianAddress);
    }

    // Support lookup by recovery ID
    if (recoveryId) {
      try {
        console.log('[Recovery API] Looking up recovery by ID:', recoveryId);
        
        const executor = getRecoveryExecutor();
        const recovery = await executor.findRecoveryByRequestId(recoveryId);

        if (!recovery) {
          console.log('[Recovery API] Recovery not found for ID:', recoveryId);
          return NextResponse.json(
            { success: false, error: 'Recovery request not found' },
            { status: 404 }
          );
        }

        console.log('[Recovery API] Found recovery:', {
          ensName: recovery.ensName,
          status: recovery.status,
          approvals: recovery.approvals?.length || 0,
          threshold: recovery.threshold
        });

        // Return single recovery in the same format as guardian list
        return NextResponse.json({
          success: true,
          recovery: {
            id: recovery.requestId,
            oldENSName: recovery.ensName,
            oldWalletAddress: recovery.currentOwner,
            newWalletAddress: recovery.newOwner,
            guardians: recovery.guardians,
            threshold: recovery.threshold,
            approvals: recovery.approvals || [],
            status: recovery.status?.toLowerCase() || 'pending',
            createdAt: new Date(recovery.createdAt).getTime(),
            executionStartedAt: recovery.executionStartedAt ? new Date(recovery.executionStartedAt).getTime() : undefined,
            completedAt: recovery.completedAt ? new Date(recovery.completedAt).getTime() : undefined,
            failedAt: recovery.failedAt ? new Date(recovery.failedAt).getTime() : undefined,
            executionPhase: recovery.executionPhase || null,
            settlementTxId: recovery.settlementTxId || null,
            ensTransferTxHash: recovery.ensTransferTxHash || null,
            rotationTxHash: recovery.rotationTxHash || null,
            policyId: recovery.policyId || null,
            error: recovery.error,
          },
        });
      } catch (error: any) {
        console.error('[Recovery API] Failed to fetch recovery by ID:', error);
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to fetch recovery' },
          { status: 500 }
        );
      }
    }

    // Support lookup by either namehash or ENS name
    let lookupNamehash = namehash;
    
    if (!lookupNamehash && ensName) {
      lookupNamehash = ethers.namehash(ensName);
    }

    if (!lookupNamehash) {
      return NextResponse.json(
        { success: false, error: 'Missing namehash or ensName parameter' },
        { status: 400 }
      );
    }

    const executor = getRecoveryExecutor();
    const status = await executor.getRecoveryStatus(lookupNamehash);

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Recovery request not found' },
        { status: 404 }
      );
    }

    // Enhance status with guardian details
    const ensService = getENSService();
    let guardiansWithStatus: Array<{ address: string; approved: boolean }> = [];

    // Get guardian config from ENS if ensName is available
    if (ensName) {
      const guardianConfig = await ensService.getGuardianConfig(ensName);
      
      if (guardianConfig) {
        // We don't have individual approval info from status, so just list guardians
        guardiansWithStatus = guardianConfig.guardians.map(address => ({
          address,
          approved: false, // Would need to query contract for individual approvals
        }));
      }
    }

    // Determine Gateway status based on stage
    let gatewayStatus = 'NOT_STARTED';
    if (status.stage === 'GATEWAY_PENDING') {
      gatewayStatus = 'POLICY_CHECKING';
    } else if (status.stage === 'EXECUTING') {
      gatewayStatus = 'EXECUTING';
    } else if (status.stage === 'COMPLETED') {
      gatewayStatus = 'COMPLETED';
    }

    // Calculate estimated execution time
    let estimatedExecutionTime: string | undefined;
    if (status.stage === 'GATEWAY_PENDING') {
      const executionTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      estimatedExecutionTime = executionTime.toISOString();
    }

    console.log('[Recovery API] Status check for:', lookupNamehash);
    console.log('[Recovery API] Stage:', status.stage);
    console.log('[Recovery API] Approvals:', status.guardianApprovals, '/', status.guardiansRequired);

    return NextResponse.json({
      success: true,
      status: {
        stage: status.stage,
        guardianApprovals: status.guardianApprovals,
        guardiansRequired: status.guardiansRequired,
        guardians: guardiansWithStatus,
        gatewayStatus,
        estimatedExecutionTime,
      },
    });

  } catch (error) {
    console.error('[Recovery API] Status check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recovery status',
      },
      { status: 500 }
    );
  }
}

// POST endpoint for canceling recovery (by current owner)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { namehash, ownerSignature } = body;

    if (!namehash || !ownerSignature) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: namehash, ownerSignature' },
        { status: 400 }
      );
    }

    // This would call a cancelRecovery function on the RecoveryController
    // For now, return not implemented
    return NextResponse.json(
      { success: false, error: 'Cancel recovery not yet implemented' },
      { status: 501 }
    );

  } catch (error) {
    console.error('[Recovery API] Cancel failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel recovery',
      },
      { status: 500 }
    );
  }
}
