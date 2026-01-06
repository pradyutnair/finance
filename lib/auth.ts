import { Client, Account, Databases, ID } from "appwrite";
import { logger } from "./logger";
import type { AuthUser, AuthUserResult } from "./types";
import { APPWRITE_CONFIG, COLLECTIONS } from "./config";

function assertAuthEnv(): void {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) missing.push("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) missing.push("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. Please set them before using auth.`
    );
  }
}

function assertDatabaseEnv(): void {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID) missing.push("NEXT_PUBLIC_APPWRITE_DATABASE_ID");
  if (!process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID) missing.push("NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID");
  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. Please set them before using database operations.`
    );
  }
}

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export type VerifyJWTResult = {
  valid: boolean;
  user: unknown | null;
  error: string | null;
};

export async function verifyAppwriteJWT(jwt: string | null): Promise<VerifyJWTResult> {
  assertAuthEnv();
  if (!jwt) {
    return { valid: false, user: null, error: "Missing bearer token" };
  }
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId)
      .setJWT(jwt);

    const account = new Account(client);
    const user = await account.get();
    return { valid: true, user, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return { valid: false, user: null, error: message };
  }
}

export class StatusError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireAuthUser(request: Request): Promise<AuthUser> {
  // Try JWT token first
  const token = extractBearerToken(request);
    if (token) {
      const { valid, user, error } = await verifyAppwriteJWT(token);
      if (valid && user) {
        return user as AuthUser;
      }
    }

    // Try session cookies
    try {
      const cookies = request.headers.get('cookie');
      if (!cookies) {
        throw new StatusError("No authentication provided", 401);
      }

      logger.debug('Received cookies for session verification', {
        cookieNames: cookies.split(';').map(c => c.split('=')[0].trim()).filter(name => name.includes('session') || name.includes('a_session'))
      });

      // Parse session cookie - try multiple formats
      let sessionMatch = null;

      // Try Appwrite's standard format: a_session_[projectId]=[sessionToken]
      sessionMatch = cookies.match(/a_session_[^=]+=([^;]+)/);

      if (!sessionMatch) {
        // Try other common formats
        sessionMatch = cookies.match(/appwrite-session=([^;]+)/) ||
                       cookies.match(/session=([^;]+)/) ||
                       cookies.match(/next-auth\.session-token=([^;]+)/);
      }

      if (!sessionMatch) {
        logger.warn('No session cookie found in available cookies', {
          cookieCount: cookies.split(';').length,
          availableCookies: cookies.split(';').map(c => c.split('=')[0].trim())
        });
        throw new StatusError("No session cookie found", 401);
      }

    logger.debug('Found session cookie', { cookieName: sessionMatch[0].split('=')[0] });

    const sessionToken = decodeURIComponent(sessionMatch[1]);
    
    // Verify session with Appwrite
    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId)
      .setSession(sessionToken);

    const account = new Account(client);
    const user = await account.get();
    return user as AuthUser;
  } catch (sessionError: unknown) {
    // If it's already a StatusError, re-throw it
    if (sessionError instanceof StatusError) {
      throw sessionError;
    }
    // Otherwise, throw a new StatusError with 401
    const errorMessage = sessionError instanceof Error ? sessionError.message : 'Authentication failed';
    throw new StatusError(`Invalid session: ${errorMessage}`, 401);
  }
}

// Client-side auth utilities
export function createAppwriteClient() {
  assertAuthEnv();
  return new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);
}

export async function createUserPrivateRecord(userId: string, email?: string, name?: string) {
  assertDatabaseEnv();
  const client = createAppwriteClient();
  const databases = new Databases(client);
  
  logger.debug("Creating user private record", { userId });
  
  try {
    // Check if user record already exists by document ID (which will be the user ID)
    logger.debug("Checking for existing user record");
    try {
      const existingUser = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.usersPrivate,
        userId
      );
      logger.debug("Found existing user record");
      return existingUser;
    } catch (getError: unknown) {
      // Document doesn't exist, continue to create it
      const error = getError as { code?: number };
      if (error.code !== 404) {
        throw getError;
      }
    }
    
    // Create new user record using userId as the document ID
    logger.debug("Creating new user record");
    
    // Use the actual attributes from your collection schema
    const documentData = {
      userId: userId, // Add userId column as specified
      role: "user", // This attribute exists in your collection with default "user"
      ...(email && { email }), // Only add if email exists
      ...(name && { name })    // Only add if name exists
    };
    
    logger.debug("Document data prepared", { hasEmail: !!email, hasName: !!name });
    
    const userRecord = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      COLLECTIONS.usersPrivate,
      userId, // Use userId as document ID instead of ID.unique()
      documentData
    );
    
    logger.info("User record created successfully", { userId });
    return userRecord;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number | string; type?: string };
    logger.error("Error creating user private record", {
      message: err.message,
      code: err.code,
      type: err.type,
      userId
    });
    
    // Provide helpful error messages
    const errorMessage = err.message || '';
    if (errorMessage.includes('Database not found')) {
      throw new Error('Database not found. Please create it in Appwrite Console.');
    } else if (errorMessage.includes('Collection not found')) {
      throw new Error('Collection not found. Please create it in the database.');
    } else if (errorMessage.includes('Failed to fetch')) {
      throw new Error('Network error: Cannot connect to Appwrite. Check your endpoint and project ID.');
    }
    
    throw error;
  }
}
