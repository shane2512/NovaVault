import { NextRequest, NextResponse } from "next/server";
import { createCircleENSServiceV3 } from "@/lib/services/circleENSServiceV3";

/**
 * GET /api/ens/circle/verify
 * Verify ENS name and check setup status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Missing 'name' parameter" },
        { status: 400 }
      );
    }

    // Create Circle ENS service V3 (private key signing)
    const ensService = createCircleENSServiceV3();

    // Get comprehensive name info
    const nameInfo = await ensService.getNameInfo(name);

    return NextResponse.json({
      success: true,
      data: nameInfo,
    });
  } catch (error: any) {
    console.error("ENS Circle Verify Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to verify ENS ownership",
      },
      { status: 500 }
    );
  }
}
