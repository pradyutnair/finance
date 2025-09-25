import { Client, Account, Databases, ID } from "appwrite";

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
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string)
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

export async function requireAuthUser(request: Request): Promise<unknown> {
  // Try JWT token first
  const token = extractBearerToken(request);
  if (token) {
    const { valid, user, error } = await verifyAppwriteJWT(token);
    if (valid) {
      return user;
    }
  }

  // Try session cookies
  try {
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      throw new StatusError("No authentication provided", 401);
    }

    console.log('🍪 Received cookies:', cookies);

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
      console.error('❌ No session cookie found in available cookies:', cookies);
      console.error('🔍 Looking for patterns: a_session_*, appwrite-session, session');
      throw new StatusError("No session cookie found", 401);
    }

    console.log('✅ Found session cookie:', sessionMatch[0].split('=')[0]);

    const sessionToken = decodeURIComponent(sessionMatch[1]);
    
    // Verify session with Appwrite
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string)
      .setSession(sessionToken);

    const account = new Account(client);
    const user = await account.get();
    return user;
  } catch (sessionError: any) {
    console.error('Session verification error:', sessionError.message);
    throw new StatusError(`Invalid session: ${sessionError.message}`, 401);
  }
}

// Client-side auth utilities
export function createAppwriteClient() {
  assertAuthEnv();
  return new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
}

export async function createUserPrivateRecord(userId: string, email?: string, name?: string) {
  assertDatabaseEnv();
  const client = createAppwriteClient();
  const databases = new Databases(client);
  
  console.log("🔍 Creating user private record...");
  console.log("Database ID:", process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID);
  console.log("Collection ID:", process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID);
  console.log("User ID:", userId);
  
  try {
    // Check if user record already exists by document ID (which will be the user ID)
    console.log("📋 Checking for existing user record...");
    try {
      const existingUser = await databases.getDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string,
        process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID as string,
        userId
      );
      console.log("✅ Found existing user record");
      return existingUser;
    } catch (getError: any) {
      // Document doesn't exist, continue to create it
      if (getError.code !== 404) {
        throw getError;
      }
    }
    
    // Create new user record using userId as the document ID
    console.log("🆕 Creating new user record...");
    
    // Use the actual attributes from your collection schema
    const documentData = {
      userId: userId, // Add userId column as specified
      role: "user", // This attribute exists in your collection with default "user"
      ...(email && { email }), // Only add if email exists
      ...(name && { name })    // Only add if name exists
    };
    
    console.log("📝 Document data:", documentData);
    
    const userRecord = await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string,
      process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID as string,
      userId, // Use userId as document ID instead of ID.unique()
      documentData
    );
    
    console.log("✅ User record created successfully");
    return userRecord;
  } catch (error: any) {
    console.error("❌ Error creating user private record:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type
    });
    
    // Provide helpful error messages
    if (error.message?.includes('Database not found')) {
      throw new Error('Database "finance" not found. Please create it in Appwrite Console.');
    } else if (error.message?.includes('Collection not found')) {
      throw new Error('Collection "users_private" not found. Please create it in the "finance" database.');
    } else if (error.message?.includes('Failed to fetch')) {
      throw new Error('Network error: Cannot connect to Appwrite. Check your endpoint and project ID.');
    }
    
    throw error;
  }
}
