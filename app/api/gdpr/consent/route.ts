import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases } from "appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
const CONSENT_COLLECTION_ID = process.env.APPWRITE_CONSENT_COLLECTION_ID || 'user_consent_dev';

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

    try {
      const consentDoc = await databases.getDocument(
        DATABASE_ID,
        CONSENT_COLLECTION_ID,
        userId
      );

      return NextResponse.json({
        ok: true,
        preferences: consentDoc.preferences || {},
        lastUpdated: consentDoc.$updatedAt,
        version: consentDoc.version || 1
      });
    } catch (error: any) {
      if (error.code === 404) {
        // No consent record exists yet
        return NextResponse.json({
          ok: true,
          preferences: {},
          lastUpdated: null,
          version: 0
        });
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error fetching consent preferences:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch consent preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;
    const body = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid preferences data' },
        { status: 400 }
      );
    }

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

    // Validate consent preferences
    const validPreferences = {
      dataProcessing: Boolean(preferences.dataProcessing),
      bankAccountLinking: Boolean(preferences.bankAccountLinking),
      analytics: Boolean(preferences.analytics),
      marketing: Boolean(preferences.marketing),
      dataSharing: Boolean(preferences.dataSharing),
      aiProcessing: Boolean(preferences.aiProcessing),
    };

    // Ensure essential data processing is always true
    validPreferences.dataProcessing = true;

    const consentData = {
      userId,
      preferences: validPreferences,
      version: 1,
      consentDate: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    try {
      // Try to update existing document
      const existingDoc = await databases.getDocument(
        DATABASE_ID,
        CONSENT_COLLECTION_ID,
        userId
      );

      const updatedDoc = await databases.updateDocument(
        DATABASE_ID,
        CONSENT_COLLECTION_ID,
        userId,
        {
          preferences: validPreferences,
          version: (existingDoc.version || 1) + 1,
          consentDate: new Date().toISOString(),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      );

      return NextResponse.json({
        ok: true,
        message: 'Consent preferences updated successfully',
        preferences: validPreferences,
        version: updatedDoc.version
      });

    } catch (error: any) {
      if (error.code === 404) {
        // Create new document
        const newDoc = await databases.createDocument(
          DATABASE_ID,
          CONSENT_COLLECTION_ID,
          userId,
          consentData
        );

        return NextResponse.json({
          ok: true,
          message: 'Consent preferences created successfully',
          preferences: validPreferences,
          version: newDoc.version
        });
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error updating consent preferences:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update consent preferences' },
      { status: 500 }
    );
  }
}
