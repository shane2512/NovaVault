import { NextRequest, NextResponse } from "next/server";
import { createCircleENSServiceV3 } from "@/lib/services/circleENSServiceV3";

/**
 * POST /api/ens/circle/setup
 * Setup complete ENS identity using private key signing
 * Hot wallet signs transactions, Circle wallet is recovery target
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ensName, zkSecretHash, description } = body;

    if (!ensName || !zkSecretHash) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: ensName, zkSecretHash" },
        { status: 400 }
      );
    }

    // Create Circle ENS service V3 (private key signing)
    const ensService = createCircleENSServiceV3();

    // Verify signer owns the ENS
    const isOwner = await ensService.ownsName(ensName);
    if (!isOwner) {
      return NextResponse.json(
        {
          success: false,
          error: `Hot wallet does not own ${ensName}. ENS must be owned by deployment wallet temporarily for setup.`,
        },
        { status: 403 }
      );
    }

    // Check signer has gas
    const balance = await ensService.getSignerBalance();
    if (parseFloat(balance) < 0.001) {
      return NextResponse.json(
        {
          success: false,
          error: `Hot wallet has insufficient gas: ${balance} ETH. Need at least 0.001 ETH.`,
        },
        { status: 400 }
      );
    }

    // Setup identity (records point to Circle wallet)
    const result = await ensService.setupIdentity(ensName, {
      zkSecretHash,
      description: description || "NovaVault Circle Wallet",
    });

    return NextResponse.json({
      success: true,
      data: {
        txHash: result.txHash,
        message: "ENS identity setup complete. Records point to Circle wallet for recovery.",
        viewOn: `https://sepolia.etherscan.io/tx/${result.txHash}`,
      },
    });
  } catch (error: any) {
    console.error("ENS Circle Setup Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to setup ENS identity",
      },
      { status: 500 }
    );
  }
}
