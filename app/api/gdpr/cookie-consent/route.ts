import { NextResponse } from "next/server";
import { Client, Databases } from "appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
const COOKIE_CONSENT_COLLECTION_ID = process.env.APPWRITE_COOKIE_CONSENT_COLLECTION_ID || 'cookie_consent_dev';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { preferences, timestamp, version } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid cookie consent data' },
        { status: 400 }
      );
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
    }

    const databases = new Databases(client);

    // Get client IP and user agent for audit trail
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const consentData = {
      preferences,
      timestamp: timestamp || new Date().toISOString(),
      version: version || 1,
      ipAddress,
      userAgent,
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Store cookie consent record
    const documentId = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await databases.createDocument(
      DATABASE_ID,
      COOKIE_CONSENT_COLLECTION_ID,
      documentId,
      consentData
    );

    return NextResponse.json({
      ok: true,
      message: 'Cookie consent preferences saved successfully',
      documentId
    });

  } catch (error: any) {
    console.error('Error saving cookie consent:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to save cookie consent preferences' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
    }

    const databases = new Databases(client);

    // Get recent cookie consent records (for analytics)
    const response = await databases.listDocuments(
      DATABASE_ID,
      COOKIE_CONSENT_COLLECTION_ID,
      [],
      25, // Limit to 25 recent records
      undefined,
      undefined,
      undefined,
      'createdAt'
    );

    // Aggregate consent statistics
    const stats = {
      totalConsents: response.documents.length,
      analyticsEnabled: 0,
      marketingEnabled: 0,
      functionalEnabled: 0,
      essentialOnly: 0
    };

    response.documents.forEach((doc: any) => {
      const prefs = doc.preferences || {};
      if (prefs.analytics) stats.analyticsEnabled++;
      if (prefs.marketing) stats.marketingEnabled++;
      if (prefs.functional) stats.functionalEnabled++;
      if (!prefs.analytics && !prefs.marketing && !prefs.functional) {
        stats.essentialOnly++;
      }
    });

    return NextResponse.json({
      ok: true,
      stats,
      recentConsents: response.documents.slice(0, 10) // Return last 10 for review
    });

  } catch (error: any) {
    console.error('Error fetching cookie consent data:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch cookie consent data' },
      { status: 500 }
    );
  }
}
