import { Client, Databases } from "appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
const AUDIT_LOG_COLLECTION_ID = process.env.APPWRITE_AUDIT_LOG_COLLECTION_ID || 'audit_logs_dev';

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  sessionId?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export class AuditLogger {
  private client: Client;
  private databases: Databases;

  constructor() {
    this.client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      (this.client as any).headers = { ...(this.client as any).headers, "X-Appwrite-Key": apiKey };
    }

    this.databases = new Databases(this.client);
  }

  async logDataAccess(
    userId: string,
    resource: string,
    resourceId: string,
    request: Request,
    details: Record<string, any> = {}
  ) {
    return this.log({
      userId,
      action: 'data_access',
      resource,
      resourceId,
      details: {
        ...details,
        accessType: 'read'
      },
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(request),
      riskLevel: 'low'
    });
  }

  async logDataModification(
    userId: string,
    resource: string,
    resourceId: string,
    request: Request,
    details: Record<string, any> = {}
  ) {
    return this.log({
      userId,
      action: 'data_modification',
      resource,
      resourceId,
      details: {
        ...details,
        accessType: 'write'
      },
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(request),
      riskLevel: 'medium'
    });
  }

  async logDataExport(
    userId: string,
    format: string,
    request: Request,
    details: Record<string, any> = {}
  ) {
    return this.log({
      userId,
      action: 'data_export',
      resource: 'user_data',
      details: {
        ...details,
        exportFormat: format,
        dataTypes: details.dataTypes || []
      },
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(request),
      riskLevel: 'medium'
    });
  }

  async logDataDeletion(
    userId: string,
    resource: string,
    request: Request,
    details: Record<string, any> = {}
  ) {
    return this.log({
      userId,
      action: 'data_deletion',
      resource,
      details: {
        ...details,
        deletionType: 'user_requested'
      },
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(request),
      riskLevel: 'high'
    });
  }

  async logConsentChange(
    userId: string,
    consentType: string,
    request: Request,
    details: Record<string, any> = {}
  ) {
    return this.log({
      userId,
      action: 'consent_change',
      resource: 'user_consent',
      details: {
        ...details,
        consentType,
        previousConsent: details.previousConsent,
        newConsent: details.newConsent
      },
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(request),
      riskLevel: 'low'
    });
  }

  async logSecurityEvent(
    userId: string,
    event: string,
    request: Request,
    details: Record<string, any> = {}
  ) {
    return this.log({
      userId,
      action: 'security_event',
      resource: 'security',
      details: {
        ...details,
        eventType: event
      },
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(request),
      riskLevel: 'high'
    });
  }

  private async log(entry: AuditLogEntry) {
    try {
      const documentId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.databases.createDocument(
        DATABASE_ID,
        AUDIT_LOG_COLLECTION_ID,
        documentId,
        entry
      );

      // Log high-risk events to console for immediate attention
      if (entry.riskLevel === 'high') {
        console.warn('🚨 HIGH RISK AUDIT EVENT:', {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          timestamp: entry.timestamp,
          details: entry.details
        });
      }

      return documentId;
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break the main flow
      return null;
    }
  }

  private getClientIP(request: Request): string {
    return request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           'unknown';
  }

  private getSessionId(request: Request): string {
    // Extract session ID from headers or generate one
    return request.headers.get('x-session-id') || 
           `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getAuditLogs(
    userId?: string,
    action?: string,
    limit: number = 100
  ) {
    try {
      const queries = [];
      if (userId) queries.push(`userId = "${userId}"`);
      if (action) queries.push(`action = "${action}"`);

      const response = await this.databases.listDocuments(
        DATABASE_ID,
        AUDIT_LOG_COLLECTION_ID,
        queries,
        limit,
        undefined,
        undefined,
        undefined,
        'createdAt'
      );

      return response.documents;
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }
  }

  async getSecurityEvents(limit: number = 50) {
    try {
      const response = await this.databases.listDocuments(
        DATABASE_ID,
        AUDIT_LOG_COLLECTION_ID,
        ['action = "security_event"'],
        limit,
        undefined,
        undefined,
        undefined,
        'createdAt'
      );

      return response.documents;
    } catch (error) {
      console.error('Failed to fetch security events:', error);
      return [];
    }
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
