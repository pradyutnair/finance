export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, ID, Query } from "appwrite";
import { getRequisition, HttpError } from "@/lib/gocardless";
import { getDb } from "@/lib/mongo/client";

type RenewBody = {
  requisitionId: string;
  institutionId?: string;
  institutionName?: string;
};

export async function POST(request: Request) {
  try {
    // Authenticated user required
    const user: any = await requireAuthUser(request);
    const userId = (user?.$id || user?.id) as string;

    // Parse inputs
    const json = (await request.json().catch(() => ({}))) as RenewBody;
    let { requisitionId, institutionId, institutionName } = json || {} as RenewBody;
    if (!requisitionId || typeof requisitionId !== 'string') {
      return NextResponse.json({ ok: false, error: "'requisitionId' is required" }, { status: 400 });
    }

    // Optionally verify requisition with provider to enrich data
    try {
      const req = await getRequisition(requisitionId);
      institutionId = institutionId || req?.institution_id || undefined;
      institutionName = institutionName || req?.institution_name || undefined;
    } catch (_e) {
      // If verification fails, proceed best-effort with provided fields
    }

    if (!institutionId) {
      return NextResponse.json({ ok: false, error: "'institutionId' is required (could not derive from provider)" }, { status: 400 });
    }

    // MongoDB path
    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb();
      
      // Update bank_connections_dev
      await db.collection('bank_connections_dev').updateOne(
        { userId, institutionId },
        {
          $set: {
            requisitionId,
            status: 'active',
            institutionId,
            ...(institutionName ? { institutionName } : {}),
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            userId,
            createdAt: new Date().toISOString(),
          }
        },
        { upsert: true }
      );

      // Update requisitions_dev
      await db.collection('requisitions_dev').updateOne(
        { userId, institutionId },
        {
          $set: {
            requisitionId,
            institutionId,
            ...(institutionName ? { institutionName } : {}),
            status: 'LINKED',
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: {
            userId,
            createdAt: new Date().toISOString(),
          }
        },
        { upsert: true }
      );

      return NextResponse.json({ ok: true, requisitionId, institutionId });
    }

    // Appwrite writes disabled - MongoDB is now the primary backend
    console.log('⚠️  Appwrite writes disabled. Use DATA_BACKEND=mongodb for renew.');
    return NextResponse.json({
      ok: false,
      error: 'Appwrite writes are disabled. Set DATA_BACKEND=mongodb to renew requisitions.'
    }, { status: 400 });

    /* Legacy Appwrite code (disabled)
    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
    const REQUISITIONS_COLLECTION_ID = process.env.APPWRITE_REQUISITIONS_COLLECTION_ID || 'requisitions_dev';
    const BANK_CONNECTIONS_COLLECTION_ID = process.env.APPWRITE_BANK_CONNECTIONS_COLLECTION_ID || 'bank_connections_dev';

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY as string;
    const databases = new Databases(client);

    // 1) Update latest bank connection for this user + institution
    try {
      const conns = await databases.listDocuments(
        DATABASE_ID,
        BANK_CONNECTIONS_COLLECTION_ID,
        [
          Query.equal('userId', userId),
          Query.equal('institutionId', institutionId),
        ]
      );
      if (Array.isArray(conns.documents) && conns.documents.length > 0) {
        // Choose most recent
        const latest = conns.documents.reduce((a: any, b: any) => {
          const at = a?.$createdAt ? Date.parse(a.$createdAt) : 0;
          const bt = b?.$createdAt ? Date.parse(b.$createdAt) : 0;
          return bt > at ? b : a;
        });
        await databases.updateDocument(
          DATABASE_ID,
          BANK_CONNECTIONS_COLLECTION_ID,
          latest.$id,
          {
            requisitionId,
            status: 'active',
            institutionId,
            ...(institutionName ? { institutionName } : {}),
          }
        );

        // Delete all older bank connection docs for this user+institution
        for (const doc of conns.documents) {
          if (doc.$id === latest.$id) continue;
          try {
            await databases.deleteDocument(
              DATABASE_ID,
              BANK_CONNECTIONS_COLLECTION_ID,
              doc.$id
            );
          } catch (delErr) {
            console.warn('Failed to delete old bank connection doc', doc.$id, delErr);
          }
        }
      }
    } catch (e) {
      console.error('Error updating bank connection requisitionId:', e);
      // Continue to requisitions update even if this fails
    }

    // 2) Upsert requisition record for this user/institution with new id
    try {
      // Try to find an existing requisition doc for this user+institution
      const existing = await databases.listDocuments(
        DATABASE_ID,
        REQUISITIONS_COLLECTION_ID,
        [
          Query.equal('userId', userId),
          Query.equal('institutionId', institutionId),
        ]
      );

      let keepId: string | null = null;
      if (existing.documents.length > 0) {
        const latest = existing.documents.reduce((a: any, b: any) => {
          const at = a?.$createdAt ? Date.parse(a.$createdAt) : 0;
          const bt = b?.$createdAt ? Date.parse(b.$createdAt) : 0;
          return bt > at ? b : a;
        });
        await databases.updateDocument(
          DATABASE_ID,
          REQUISITIONS_COLLECTION_ID,
          latest.$id,
          {
            requisitionId,
            institutionId,
            ...(institutionName ? { institutionName } : {}),
          }
        );
        keepId = latest.$id;
      } else {
        // Create a new requisition document keyed by requisition id for traceability
        await databases.createDocument(
          DATABASE_ID,
          REQUISITIONS_COLLECTION_ID,
          requisitionId,
          {
            userId,
            requisitionId,
            institutionId,
            ...(institutionName ? { institutionName } : {}),
            status: 'LINKED',
          }
        );
        keepId = requisitionId;
      }

      // Delete all older requisitions for this user+institution except the kept one
      try {
        const allForInst = existing.documents.length
          ? existing.documents
          : (
              await databases.listDocuments(
                DATABASE_ID,
                REQUISITIONS_COLLECTION_ID,
                [Query.equal('userId', userId), Query.equal('institutionId', institutionId)]
              )
            ).documents;
        for (const doc of allForInst) {
          if (!keepId || doc.$id === keepId) continue;
          try {
            await databases.deleteDocument(
              DATABASE_ID,
              REQUISITIONS_COLLECTION_ID,
              doc.$id
            );
          } catch (delErr) {
            console.warn('Failed to delete old requisition doc', doc.$id, delErr);
          }
        }
      } catch (listDelErr) {
        console.warn('Failed to enumerate old requisitions for deletion:', listDelErr);
      }
    } catch (e) {
      console.error('Error upserting requisition record:', e);
    }

    return NextResponse.json({ ok: true, requisitionId, institutionId });
    */
  } catch (err: any) {
    console.error('Error in renew requisition endpoint:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || 'Internal Server Error';
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


