import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    logger.debug("Debug endpoint called", { headers: Object.fromEntries(request.headers.entries()) });
    
    const user: any = await requireAuthUser(request);
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name
      },
      message: "Authentication successful"
    });
  } catch (error: any) {
    logger.error("Debug endpoint error", { error: error.message, status: error.status });
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        status: error.status || 500
      },
      { status: error.status || 500 }
    );
  }
}
