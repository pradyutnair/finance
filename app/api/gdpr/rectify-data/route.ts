import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases } from "appwrite";
import { auditLogger } from "@/lib/gdpr/audit-logger";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;
    const body = await request.json();
    const { field, value } = body;

    if (!field || value === undefined) {
      return NextResponse.json(
        { ok: false, error: 'Field and value are required' },
        { status: 400 }
      );
    }

    // Validate field names
    const allowedFields = ['name', 'email', 'avatarUrl', 'preferredCurrencies'];
    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { ok: false, error: 'Field is not editable' },
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

    // Get current user data
    const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private';
    let userDoc;
    
    try {
      userDoc = await databases.getDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId
      );
    } catch (error) {
      // Create user document if it doesn't exist
      userDoc = await databases.createDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId,
        {
          userId,
          role: 'user',
          [field]: value
        }
      );
    }

    // Update the field
    const updateData = {
      [field]: value,
      updatedAt: new Date().toISOString()
    };

    const updatedDoc = await databases.updateDocument(
      DATABASE_ID,
      USERS_PRIVATE_COLLECTION_ID,
      userId,
      updateData
    );

    // Log data modification for audit
    await auditLogger.logDataModification(
      userId,
      'user_profile',
      userId,
      request,
      {
        field,
        oldValue: userDoc[field],
        newValue: value,
        modificationType: 'user_rectification'
      }
    );

    return NextResponse.json({
      ok: true,
      message: `${field} updated successfully`,
      updatedData: {
        [field]: value,
        updatedAt: updatedDoc.$updatedAt
      }
    });

  } catch (error: any) {
    console.error('Error rectifying user data:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update user data' },
      { status: 500 }
    );
  }
}
