import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo/client";
import { Client, Databases } from "appwrite";
import { auditLogger } from "@/lib/gdpr/audit-logger";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;

export async function POST(request: Request) {
  try {
    // This endpoint should be protected and only accessible by admin/system
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.includes(process.env.ADMIN_API_KEY || "admin-key")) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { dryRun = true, retentionPeriods = {} } = body;

    const cleanupResults = {
      deletedRecords: 0,
      anonymizedRecords: 0,
      errors: [] as string[],
      details: {} as Record<string, any>
    };

    // Default retention periods (in days)
    const defaultRetentionPeriods = {
      auditLogs: 2555, // 7 years
      userSessions: 30, // 30 days
      analyticsData: 730, // 2 years
      marketingData: 365, // 1 year
      oldTransactions: 2555, // 7 years (legal requirement)
      oldBalances: 2555, // 7 years (legal requirement)
      consentLogs: 2555, // 7 years
      cookieConsent: 365, // 1 year
    };

    const retentionPeriodsToUse = { ...defaultRetentionPeriods, ...retentionPeriods };
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Math.max(...Object.values(retentionPeriodsToUse)));

    // 1. Clean up old audit logs (keep for 7 years)
    try {
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

      const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
      if (apiKey) {
        (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
      }

      const databases = new Databases(client);
      const AUDIT_LOG_COLLECTION_ID = process.env.APPWRITE_AUDIT_LOG_COLLECTION_ID || 'audit_logs_dev';

      if (!dryRun) {
        // Get old audit logs
        const oldAuditLogs = await databases.listDocuments(
          DATABASE_ID,
          AUDIT_LOG_COLLECTION_ID,
          [`timestamp < "${cutoffDate.toISOString()}"`],
          1000 // Process in batches
        );

        for (const log of oldAuditLogs.documents) {
          try {
            await databases.deleteDocument(
              DATABASE_ID,
              AUDIT_LOG_COLLECTION_ID,
              log.$id
            );
            cleanupResults.deletedRecords++;
          } catch (error) {
            cleanupResults.errors.push(`Failed to delete audit log ${log.$id}: ${error}`);
          }
        }
      }

      cleanupResults.details.auditLogs = {
        retentionPeriod: retentionPeriodsToUse.auditLogs,
        cutoffDate: cutoffDate.toISOString()
      };
    } catch (error) {
      cleanupResults.errors.push(`Audit logs cleanup failed: ${error}`);
    }

    // 2. Clean up old cookie consent records
    try {
      const COOKIE_CONSENT_COLLECTION_ID = process.env.APPWRITE_COOKIE_CONSENT_COLLECTION_ID || 'cookie_consent_dev';
      const cookieCutoffDate = new Date();
      cookieCutoffDate.setDate(cookieCutoffDate.getDate() - retentionPeriodsToUse.cookieConsent);

      if (!dryRun) {
        const oldCookieConsents = await databases.listDocuments(
          DATABASE_ID,
          COOKIE_CONSENT_COLLECTION_ID,
          [`timestamp < "${cookieCutoffDate.toISOString()}"`],
          1000
        );

        for (const consent of oldCookieConsents.documents) {
          try {
            await databases.deleteDocument(
              DATABASE_ID,
              COOKIE_CONSENT_COLLECTION_ID,
              consent.$id
            );
            cleanupResults.deletedRecords++;
          } catch (error) {
            cleanupResults.errors.push(`Failed to delete cookie consent ${consent.$id}: ${error}`);
          }
        }
      }

      cleanupResults.details.cookieConsent = {
        retentionPeriod: retentionPeriodsToUse.cookieConsent,
        cutoffDate: cookieCutoffDate.toISOString()
      };
    } catch (error) {
      cleanupResults.errors.push(`Cookie consent cleanup failed: ${error}`);
    }

    // 3. Clean up MongoDB data (if using MongoDB backend)
    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb();

      // Clean up old sessions (if stored in MongoDB)
      try {
        const sessionCutoffDate = new Date();
        sessionCutoffDate.setDate(sessionCutoffDate.getDate() - retentionPeriodsToUse.userSessions);

        if (!dryRun) {
          const sessionResult = await db
            .collection('user_sessions_dev')
            .deleteMany({
              lastActivity: { $lt: sessionCutoffDate }
            });
          
          cleanupResults.deletedRecords += sessionResult.deletedCount || 0;
        }

        cleanupResults.details.userSessions = {
          retentionPeriod: retentionPeriodsToUse.userSessions,
          cutoffDate: sessionCutoffDate.toISOString()
        };
      } catch (error) {
        cleanupResults.errors.push(`User sessions cleanup failed: ${error}`);
      }

      // Clean up old analytics data
      try {
        const analyticsCutoffDate = new Date();
        analyticsCutoffDate.setDate(analyticsCutoffDate.getDate() - retentionPeriodsToUse.analyticsData);

        if (!dryRun) {
          const analyticsResult = await db
            .collection('analytics_dev')
            .deleteMany({
              timestamp: { $lt: analyticsCutoffDate }
            });
          
          cleanupResults.deletedRecords += analyticsResult.deletedCount || 0;
        }

        cleanupResults.details.analyticsData = {
          retentionPeriod: retentionPeriodsToUse.analyticsData,
          cutoffDate: analyticsCutoffDate.toISOString()
        };
      } catch (error) {
        cleanupResults.errors.push(`Analytics data cleanup failed: ${error}`);
      }
    }

    // 4. Log the cleanup operation
    if (!dryRun) {
      try {
        await auditLogger.logSecurityEvent(
          'system',
          'data_retention_cleanup',
          request,
          {
            deletedRecords: cleanupResults.deletedRecords,
            anonymizedRecords: cleanupResults.anonymizedRecords,
            retentionPeriods: retentionPeriodsToUse,
            errors: cleanupResults.errors
          }
        );
      } catch (error) {
        console.error('Failed to log cleanup operation:', error);
      }
    }

    return NextResponse.json({
      ok: true,
      message: dryRun ? 'Dry run completed - no data was deleted' : 'Data retention cleanup completed',
      dryRun,
      results: cleanupResults,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error during data retention cleanup:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to perform data retention cleanup' },
      { status: 500 }
    );
  }
}

// GET endpoint to check retention status
export async function GET(request: Request) {
  try {
    const retentionStatus = {
      currentRetentionPolicies: {
        auditLogs: '7 years',
        userSessions: '30 days',
        analyticsData: '2 years',
        marketingData: '1 year',
        financialRecords: '7 years (legal requirement)',
        consentLogs: '7 years',
        cookieConsent: '1 year'
      },
      lastCleanup: null as string | null,
      nextScheduledCleanup: null as string | null,
      recommendations: [
        'Run cleanup monthly to maintain compliance',
        'Monitor storage usage to optimize costs',
        'Review retention periods annually',
        'Ensure financial records are kept for legal requirements'
      ]
    };

    // Try to get last cleanup date from audit logs
    try {
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

      const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
      if (apiKey) {
        (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
      }

      const databases = new Databases(client);
      const AUDIT_LOG_COLLECTION_ID = process.env.APPWRITE_AUDIT_LOG_COLLECTION_ID || 'audit_logs_dev';

      const lastCleanup = await databases.listDocuments(
        DATABASE_ID,
        AUDIT_LOG_COLLECTION_ID,
        ['action = "data_retention_cleanup"'],
        1,
        undefined,
        undefined,
        undefined,
        'createdAt'
      );

      if (lastCleanup.documents.length > 0) {
        retentionStatus.lastCleanup = lastCleanup.documents[0].timestamp;
      }
    } catch (error) {
      console.warn('Could not fetch last cleanup date:', error);
    }

    return NextResponse.json({
      ok: true,
      retentionStatus
    });

  } catch (error: any) {
    console.error('Error fetching retention status:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch retention status' },
      { status: 500 }
    );
  }
}
