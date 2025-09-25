import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Debug endpoint called");
    console.log("Headers:", Object.fromEntries(request.headers.entries()));
    
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
    console.error("Debug endpoint error:", error);
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
