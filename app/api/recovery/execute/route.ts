/**
 * Recovery Event Listener API Route
 * 
 * Listens for RecoveryApproved events from RecoveryController.sol 
 * and triggers the fund migration + ENS update execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { recoveryExecutor } from '@/lib/services/recoveryExecutor';

export async function POST(req: NextRequest) {
  try {
    console.log('🔔 Recovery event webhook triggered');

    const body = await req.json();
    const { eventHash, ensNode, newWalletAddress, oldWalletId } = body;

    // Validate required parameters
    if (!eventHash || !ensNode || !newWalletAddress || !oldWalletId) {
      return NextResponse.json({
        error: 'Missing required parameters',
        required: ['eventHash', 'ensNode', 'newWalletAddress', 'oldWalletId']
      }, { status: 400 });
    }

    // Validate event hash format
    if (!ethers.isHexString(eventHash, 32)) {
      return NextResponse.json({
        error: 'Invalid event hash format'
      }, { status: 400 });
    }

    // Validate addresses
    if (!ethers.isAddress(newWalletAddress)) {
      return NextResponse.json({
        error: 'Invalid new wallet address'
      }, { status: 400 });
    }

    console.log(`🎯 Processing RecoveryApproved event:`, {
      eventHash,
      ensNode,
      newWalletAddress,
      oldWalletId
    });

    // Execute recovery in background (don't wait for completion)
    const execution = await recoveryExecutor.executeRecovery({
      ensNode,
      oldWalletId,
      newWalletAddress,
      eventHash
    });

    console.log(`✅ Recovery execution started: ${execution.id}`);

    // Return immediately with execution details
    return NextResponse.json({
      success: true,
      message: 'Recovery execution started',
      execution: {
        id: execution.id,
        ensNode: execution.ensNode,
        state: execution.state,
        startedAt: execution.startedAt
      }
    });

  } catch (error) {
    console.error('❌ Recovery execution failed:', error);

    return NextResponse.json({
      error: 'Recovery execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get status of recovery execution
 * Handles both execution status queries and recovery eligibility checks
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const executionId = searchParams.get('executionId');
    const ensNode = searchParams.get('ensNode');
    const namehash = searchParams.get('namehash');

    // Case 1: Query existing execution status
    if (executionId || ensNode) {
      let execution;
      if (executionId) {
        execution = recoveryExecutor.getExecution(executionId);
      } else if (ensNode) {
        const state = recoveryExecutor.getExecutionStatus(ensNode);
        execution = { state };
      }

      if (!execution) {
        return NextResponse.json({
          error: 'Recovery execution not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        execution
      });
    }

    // Case 2: Check if recovery can be executed
    if (namehash) {
      // For now, return a basic response since we're using the event-driven model
      return NextResponse.json({
        success: true,
        canExecute: false,
        message: 'Recovery execution is triggered automatically by smart contract events'
      });
    }

    // No valid parameters provided
    return NextResponse.json({
      error: 'Either executionId, ensNode, or namehash is required'
    }, { status: 400 });

  } catch (error) {
    console.error('Failed to get recovery status:', error);

    return NextResponse.json({
      error: 'Failed to get recovery status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
