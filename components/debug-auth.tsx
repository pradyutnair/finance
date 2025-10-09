'use client';

import { useAuth } from '@/lib/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DebugAuth() {
  const { user, loading } = useAuth();

  const checkCookies = () => {
    const cookies = document.cookie;
    console.log('🍪 All cookies:', cookies);
    
    // Check for Appwrite session cookies
    const sessionCookies = cookies.split(';').filter(cookie => 
      cookie.includes('session') || cookie.includes('a_session')
    );
    console.log('📝 Session cookies:', sessionCookies);
  };

  const testAPICall = async () => {
    try {
      const response = await fetch('/api/gocardless/institutions?country=GB', {
        credentials: 'include'
      });
      console.log('🔍 API Response Status:', response.status);
      if (response.ok) {
        console.log('✅ API call successful');
      } else {
        const error = await response.json();
        console.log('❌ API call failed:', error);
      }
    } catch (error) {
      console.log('💥 API call error:', error);
    }
  };

  if (loading) return <div>Loading auth debug...</div>;

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>🔍 Auth Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <strong>User Status:</strong> {user ? '✅ Logged In' : '❌ Not Logged In'}
        </div>
        {user && (
          <div>
            <strong>User ID:</strong> {user.$id}<br/>
            <strong>Email:</strong> {user.email}
          </div>
        )}
        <div className="space-x-2">
          <button 
            onClick={checkCookies}
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            Check Cookies
          </button>
          <button 
            onClick={testAPICall}
            className="px-3 py-1 bg-green-500 text-white rounded"
          >
            Test API Call
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
