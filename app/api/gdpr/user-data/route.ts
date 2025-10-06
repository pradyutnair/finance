import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases } from "appwrite";
import { auditLogger } from "@/lib/gdpr/audit-logger";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (token) {
      client.setJWT(token);
    } else {
      const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
      if (apiKey) {
        (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
      }
    }

    const databases = new Databases(client);

    // Get user profile data
    let userData = null;
    try {
      const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private';
      const userDoc = await databases.getDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId
      );
      userData = userDoc;
    } catch (error) {
      // User profile might not exist yet
      userData = {
        userId,
        name: '',
        email: '',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // Log data access for audit
    await auditLogger.logDataAccess(
      userId,
      'user_profile',
      userId,
      request,
      { dataType: 'personal_information' }
    );

    return NextResponse.json({
      ok: true,
      userData,
      accessDate: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
