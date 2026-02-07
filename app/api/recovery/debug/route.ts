/**
 * Debug API - Check recovery storage state
 * GET /api/recovery/debug
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllStoredRecoveries } from '@/lib/services/recoveryExecutor';

export async function GET() {
  try {
    console.log('[Recovery Debug] ==> Debug endpoint called');
    
    const allRecoveries = getAllStoredRecoveries();
    console.log('[Recovery Debug] Raw storage result:', allRecoveries);
    
    return NextResponse.json({
      success: true,
      totalRecoveries: allRecoveries.length,
      recoveries: allRecoveries.map(recovery => ({
        namehash: recovery.namehash.substring(0, 20) + '...',
        ensName: recovery.ensName,
        requestId: recovery.requestId,
        guardians: recovery.guardians,
        threshold: recovery.threshold,
        approvals: recovery.approvals || [],
        status: recovery.status,
        createdAt: recovery.createdAt,
      })),
      raw: allRecoveries, // Full data for debugging
    });
  } catch (error: any) {
    console.error('[Recovery Debug] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/recovery/debug - Test storage directly  
export async function POST(req: NextRequest) {
  try {
    console.log('[Recovery Debug] Testing recovery executor...');
    
    // Import the storage directly
    const { getRecoveryExecutor } = await import('@/lib/services/recoveryExecutor');
    const executor = getRecoveryExecutor();
    
    // Test basic functionality
    console.log('[Recovery Debug] Executor initialized successfully');
    
    // Check storage
    const allRecoveries = getAllStoredRecoveries();
    
    return NextResponse.json({
      success: true,
      message: 'Recovery executor is working  (now event-driven - use POST /api/recovery/execute)',
      totalRecoveries: allRecoveries.length,
      allRecoveries
    });
  } catch (error: any) {
    console.error('[Recovery Debug] Test failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}