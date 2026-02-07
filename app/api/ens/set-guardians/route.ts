import { NextRequest, NextResponse } from 'next/server';
import { setGuardianConfig } from '@/lib/services/ensRecoveryService';

export async function POST(request: NextRequest) {
  try {
    const { ensName, guardians, threshold, walletAddress } = await request.json();
    
    if (!ensName || !guardians || !threshold || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Bridge wallet private key not configured' },
        { status: 500 }
      );
    }
    
    const result = await setGuardianConfig(
      ensName,
      guardians,
      threshold,
      walletAddress,
      privateKey
    );
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to set guardians' },
      { status: 500 }
    );
  }
}
