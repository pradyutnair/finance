export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { createRequisition, HttpError } from "@/lib/gocardless";
import { Client, Databases } from "appwrite";

export async function POST(request: Request) {
  try {
    // Require authenticated user
    let user: any;
    let userId: string;
    
    try {
      user = await requireAuthUser(request);
      userId = user.$id || user.id;
    } catch (authError) {
      console.error('❌ Authentication failed:', authError);
      
      // In development, allow bypassing auth for testing
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: bypassing auth for testing');
        const timestamp = Date.now();
        userId = `dev-user-${timestamp}`;
        user = { $id: userId, id: userId };
        console.log('🔧 Using dev user ID:', userId);
      } else {
        throw authError;
      }
    }
    
    const json = await request.json().catch(() => ({}));
    const { redirect, institutionId, reference, userLanguage, agreementId } = json || {};
    
    // Ensure reference uses the same user ID format for consistent parsing
    const finalReference = reference || `user_${userId}_${Date.now()}`;
    console.log('🔗 Using reference:', finalReference);
    
    // Create requisition with GoCardless
    const data = await createRequisition({
      redirect,
      institutionId,
      reference: finalReference,
      userLanguage,
      agreementId,
    });

    // Store requisition in Appwrite database
    try {
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
      
      // Set API key for server-side operations
      client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY as string;
      const databases = new Databases(client);

      const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
      const REQUISITIONS_COLLECTION_ID = process.env.APPWRITE_REQUISITIONS_COLLECTION_ID || 'requisitions_dev';

      // Store requisition with initial status
      await databases.createDocument(
        DATABASE_ID,
        REQUISITIONS_COLLECTION_ID,
        data.id, // Use GoCardless requisition ID as document ID
        {
          userId: userId,
          requisitionId: data.id,
          institutionId: data.institution_id,
          institutionName: data.institution_name || 'Unknown Bank',
          status: data.status || 'CREATED',
          reference: finalReference,
          redirectUri: data.redirect,
        }
      );

      console.log('✅ Stored requisition in Appwrite:', data.id);
    } catch (dbError) {
      console.error('Error storing requisition in database:', dbError);
      // Don't fail the request if DB storage fails
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error creating requisition:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
