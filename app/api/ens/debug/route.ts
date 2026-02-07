/**
 * Debug endpoint to check ENS text records
 * GET /api/ens/debug?name=yourname.eth
 */

import { NextRequest, NextResponse } from 'next/server';
import { getENSService } from '@/lib/services/ensService';
import { ethers } from 'ethers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ensName = searchParams.get('name');

    if (!ensName) {
      return NextResponse.json(
        { error: 'ENS name required. Use ?name=yourname.eth' },
        { status: 400 }
      );
    }

    const ensService = getENSService();

    // Get basic name info
    const nameInfo = await ensService.getNameInfo(ensName);

    // Try to get various text records
    const textRecords = await ensService.getTextRecords(ensName, [
      'guardians',
      'threshold',
      'wallet',
      'circleWalletId',
      'recoveryChain',
      'description',
      'avatar',
      'email',
    ]);

    // Try to get guardian config (if available)
    let guardianConfig = null;
    try {
      guardianConfig = await ensService.getGuardianConfig(ensName);
    } catch (err: any) {
      guardianConfig = { error: err.message };
    }

    return NextResponse.json({
      success: true,
      ensName,
      nameInfo,
      textRecords,
      guardianConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[ENS Debug] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
