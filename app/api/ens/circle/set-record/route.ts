import { NextRequest, NextResponse } from "next/server";
import { createCircleENSServiceV3 } from "@/lib/services/circleENSServiceV3";

/**
 * POST /api/ens/circle/set-record
 * Set a single ENS text record via Circle SDK
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ensName, key, value } = body;

    if (!ensName || !key || value === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: ensName, key, value" },
        { status: 400 }
      );
    }

    // Create Circle ENS service
    const ensService = createCircleENSServiceV3();

    // Set text record via Circle SDK
    const result = await ensService.setTextRecord(ensName, key, value);

    return NextResponse.json({
      success: true,
      data: {
        txId: result.txHash,
        txHash: result.txHash,
        message: `ENS text record '${key}' set successfully`,
        viewOn: result.txHash
          ? `https://sepolia.etherscan.io/tx/${result.txHash}`
          : undefined,
      },
    });
  } catch (error: any) {
    console.error("ENS Circle Set Record Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to set ENS text record",
      },
      { status: 500 }
    );
  }
}
