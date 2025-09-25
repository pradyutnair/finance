'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClientOnly } from '@/components/ClientOnly';

export default function BankCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing bank connection...');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the requisition ID from URL parameters
        const ref = searchParams?.get('ref');
        const error = searchParams?.get('error');
        
        console.log('🔍 Callback parameters:', { 
          ref, 
          error, 
          allParams: Object.fromEntries(searchParams?.entries() || []) 
        });
        
        if (error) {
          throw new Error(error);
        }

        if (!ref) {
          throw new Error('No reference found in callback');
        }

        setMessage('Verifying bank connection...');

        let requisitionId = ref;
        
        // First, try to use the ref as a direct requisition ID
        console.log('🔄 Attempting direct requisition lookup with ID:', ref);
        let response = await fetch(`/api/gocardless/requisitions/${ref}`, {
          method: 'GET',
        });

        // If that fails with 404, try to look it up by reference
        if (!response.ok && response.status === 404) {
          console.log('❌ Direct lookup failed, trying reference lookup...');
          
          // Try to find the requisition by our reference
          const referenceResponse = await fetch(`/api/gocardless/requisitions/by-reference/${ref}`, {
            method: 'GET',
          });
          
          if (referenceResponse.ok) {
            const referenceData = await referenceResponse.json();
            requisitionId = referenceData.requisitionId;
            console.log('✅ Found requisition by reference:', requisitionId);
            
            // Now try again with the actual requisition ID
            response = await fetch(`/api/gocardless/requisitions/${requisitionId}`, {
              method: 'GET',
            });
          }
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to process bank connection');
        }

        const data = await response.json();
        console.log('📋 Requisition data:', data);
        
        if (data.status === 'LINKED') {
          setStatus('success');
          setMessage('Bank connected successfully! Fetching your account data...');
          
          // Wait a moment then redirect to dashboard
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          throw new Error(`Connection status: ${data.status}. Please try connecting again.`);
        }
      } catch (error: any) {
        console.error('❌ Bank callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to connect bank account');
        
        // Redirect back to bank connection screen after error
        setTimeout(() => {
          router.push('/dashboard/banks');
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
