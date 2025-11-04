import { extractBearerToken, verifyAppwriteJWT } from '@/lib/auth';

export async function verifyAuth(request: Request): Promise<any> {
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
      return null;
    }

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
      return null;
    }

    const sessionToken = decodeURIComponent(sessionMatch[1]);

    // Verify session with Appwrite
    const client = new (await import('appwrite')).Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string)
      .setSession(sessionToken);

    const account = new (await import('appwrite')).Account(client);
    const user = await account.get();
    return user;
  } catch (sessionError: any) {
    console.error('Session verification error:', sessionError.message);
    return null;
  }
}