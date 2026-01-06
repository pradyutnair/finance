import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error-handler";
import { APPWRITE_CONFIG, CLIENT_COLLECTIONS } from "@/lib/config";
import { Client, Databases, ID } from "appwrite";
import { logger } from "@/lib/logger";
import { AuthUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    // Log cookies for debugging (in development only)
    const cookies = request.headers.get('cookie');
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Profile API request cookies', { 
        hasCookies: !!cookies,
        cookieCount: cookies ? cookies.split(';').length : 0,
        cookiePreview: cookies ? cookies.substring(0, 100) : 'none'
      });
    }

    let user: AuthUser;
    try {
      user = await requireAuthUser(request) as AuthUser;
    } catch (authError: unknown) {
      const err = authError as { message?: string; status?: number };
      logger.error('Authentication failed in profile API', { 
        error: err.message,
        status: err.status,
        hasCookies: !!cookies
      });
      return NextResponse.json({ 
        ok: false, 
        error: err.message || 'Authentication required. Please ensure you are logged in.' 
      }, { status: err.status || 401 });
    }
    
    const userId = user.$id || user.id;
    if (!userId) {
      logger.error('User ID not found after authentication', { user });
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }

    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);

    const apiKey = APPWRITE_CONFIG.apiKey;
    if (apiKey) {
      (client as { headers: Record<string, string> }).headers = {
        ...(client as { headers: Record<string, string> }).headers,
        "X-Appwrite-Key": apiKey,
      };
    }

    const databases = new Databases(client);

    try {
      const profile = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        CLIENT_COLLECTIONS.usersPrivate,
        userId
      );
      return NextResponse.json({ ok: true, profile });
    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err.code === 404) {
        // Profile doesn't exist, create it
        const profileData = {
          userId: userId,
          role: "user",
          name: user.name || "",
          email: user.email || "",
        };

        const profile = await databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          CLIENT_COLLECTIONS.usersPrivate,
          userId,
          profileData
        );
        return NextResponse.json({ ok: true, profile });
      }
      throw error;
    }
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}

