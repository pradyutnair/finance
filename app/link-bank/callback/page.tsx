'use client';

import { useEffect, useState, Suspense } from 'react';
import { Account } from 'appwrite';
import { createAppwriteClient } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClientOnly } from '@/components/ClientOnly';
import { AuthGuard } from '@/components/auth-guard';

function BankCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing bank connection...');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // GoCardless redirects back with parameters
        const ref = searchParams?.get('ref');
        const error = searchParams?.get('error');
        
        console.log('🔍 Callback parameters:', { 
          ref, 
          error, 
          allParams: Object.fromEntries(searchParams?.entries() || []) 
        });
        
        if (error) {
          console.log('⚠️ User cancelled session or error occurred:', error);
          setStatus('error');
          setMessage('Bank connection was cancelled. Redirecting back to try again...');
          
          // Redirect back to bank connection screen after a short delay
          setTimeout(() => {
            router.push('/link-bank');
          }, 2000);
          return;
        }

        if (!ref) {
          throw new Error('No reference found in callback URL');
        }

        setMessage('Verifying bank connection...');

        let response;
        let requisitionId = ref;

        // GoCardless callback handling
        // The 'ref' parameter should contain the requisition ID
        console.log('🔄 Processing GoCardless callback with ref:', ref);
        
        // Attach Appwrite JWT so server can resolve current user
        let jwtToken: string | null = null;
        try {
          const client = createAppwriteClient();
          const account = new Account(client);
          const jwt = await account.createJWT();
          jwtToken = jwt?.jwt || null;
        } catch {}
        const authHeaders: Record<string, string> = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};

        // Try direct requisition lookup with the ref parameter
        response = await fetch(`/api/gocardless/requisitions/${ref}`, {
          method: 'GET',
          headers: authHeaders,
          credentials: 'include',
        });

        // If direct lookup fails, the ref might be our custom reference instead of requisition ID
        // This can happen in certain sandbox scenarios or if the callback URL was constructed differently
        if (!response.ok && response.status === 404) {
          console.log('❌ Direct requisition lookup failed. Trying reference-based lookup...');
          
          try {
            const referenceResponse = await fetch(`/api/gocardless/requisitions/by-reference/${ref}`, {
              method: 'GET',
              headers: authHeaders,
              credentials: 'include',
            });
            
            if (referenceResponse.ok) {
              const referenceData = await referenceResponse.json();
              requisitionId = referenceData.requisitionId;
              console.log('✅ Found requisition by reference lookup:', requisitionId);
              
              // Retry with the actual GoCardless requisition ID
              response = await fetch(`/api/gocardless/requisitions/${requisitionId}`, {
                method: 'GET',
                headers: authHeaders,
                credentials: 'include',
              });
            } else {
              console.log('❌ Reference lookup failed. This may be an invalid or expired callback.');
              throw new Error('Unable to find requisition. The bank connection may have expired or failed.');
            }
          } catch (refError) {
            console.error('❌ Reference lookup error:', refError);
            throw new Error('Failed to process bank connection callback. Please try connecting again.');
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Requisition processing failed:', errorData);
          throw new Error(errorData.error || 'Failed to process bank connection');
        }

        const data = await response.json();
        console.log('📋 Requisition data:', data);
        
        if (data.status === 'LINKED' || data.status === 'LN') {
          setStatus('success');
          setMessage('Bank connected successfully! Finalizing renewal...');

          // Call renew API to update requisitionId mapping in Appwrite dev tables
          try {
            const renewRes = await fetch('/api/gocardless/requisitions/renew', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
              },
              credentials: 'include',
              body: JSON.stringify({
                requisitionId,
                institutionId: data?.requisition?.institution_id,
                institutionName: data?.requisition?.institution_name,
              }),
            });
            if (!renewRes.ok) {
              console.warn('Renew endpoint failed to update requisition mapping');
            }
          } catch (e) {
            console.warn('Renew call error (non-blocking):', e);
          }

          // Clear API caches before navigating to dashboard to ensure fresh data
          try {
            setMessage('Refreshing data...');
            const clearRes = await fetch('/api/clear-cache', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
              },
              credentials: 'include',
            });
            if (!clearRes.ok) {
              console.warn('Clear cache endpoint responded with non-OK status');
            }
          } catch (e) {
            console.warn('Clear cache call error (non-blocking):', e);
          }

          // Wait a moment then redirect to dashboard
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          throw new Error(`Connection status: ${data.status}. Please try connecting again.`);
        }
      } catch (error: unknown) {
        console.error('❌ Bank callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to connect bank account');
        
        // Redirect back to bank connection screen after error
        setTimeout(() => {
          router.push('/link-bank');
        }, 3000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <ClientOnly>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-black via-gray-900 to-black">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl float-animation"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl float-animation" style={{ animationDelay: '-3s' }}></div>
        </div>

        {/* Main content */}
        <div className="relative z-10 w-full max-w-md">
          <div className="glass-card p-8 text-center">
            {status === 'loading' && (
              <>
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-2xl font-bold text-white mb-4">Connecting Your Bank</h2>
                <p className="text-gray-300 mb-4">{message}</p>
                <div className="flex justify-center space-x-1 mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Success!</h2>
                <p className="text-gray-300 mb-4">{message}</p>
                <p className="text-sm text-gray-400">Redirecting to dashboard...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Connection Failed</h2>
                <p className="text-gray-300 mb-4">{message}</p>
                <p className="text-sm text-gray-400">Redirecting back to try again...</p>
              </>
            )}
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}

export default function BankCallbackPage() {
  return (
    <AuthGuard requireAuth={true}>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="glass-card p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }>
        <BankCallbackContent />
      </Suspense>
    </AuthGuard>
  );
}
