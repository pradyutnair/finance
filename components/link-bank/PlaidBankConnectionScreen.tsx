'use client';

import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { SandboxTestButton } from './SandboxTestButton';
import { useBankConnection } from '@/hooks/useBankConnection';
import { formatBankName } from '@/lib/bank-name-mapping';

interface Institution {
  institution_id: string;
  name: string;
  logo?: string;
  primary_color?: string;
  url?: string;
}

interface PlaidBankConnectionScreenProps {
  userId: string;
  onConnectionSuccess?: () => void;
}

export function PlaidBankConnectionScreen({ userId, onConnectionSuccess }: PlaidBankConnectionScreenProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [filteredInstitutions, setFilteredInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('GB'); // Default to UK for European banks
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Get existing bank connections
  const { bankConnections, hasConnectedBanks } = useBankConnection();

  // Fetch institutions on component mount
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/plaid/institutions?country=${selectedCountry}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Institutions API Error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });

          let userMessage = 'Failed to load banks';
          if (response.status === 401) {
            userMessage = 'Authentication required. Please log in again.';
          } else if (response.status === 429) {
            userMessage = 'Too many requests. Please wait a moment before trying again.';
          } else if (response.status >= 500) {
            userMessage = 'Server error. Please try again in a few minutes.';
          } else if (errorData.error) {
            userMessage = errorData.error;
          }

          throw new Error(userMessage);
        }

        const data = await response.json();

        // Transform Plaid institutions to match GoCardless format for UI consistency
        let transformedInstitutions = data.institutions.map((inst: any) => ({
          institution_id: inst.institution_id,
          name: inst.name,
          logo: inst.logo,
          primary_color: inst.primary_color,
          url: inst.url,
        }));

        // Add European sandbox test institutions
        if (process.env.NODE_ENV === 'development') {
          const sandboxInstitutions = [
            {
              institution_id: "sandbox_flexible_platypus",
              name: "🧪 Flexible Platypus Open Banking (UK Bank)",
              logo: null,
              primary_color: "#4285F4",
              url: null,
            },
            {
              institution_id: "sandbox_royal_bank_plaid",
              name: "🧪 Royal Bank of Plaid (UK Bank)",
              logo: null,
              primary_color: "#34A853",
              url: null,
            },
          ];

          // Add sandbox institutions at the top for easy testing
          transformedInstitutions = [...sandboxInstitutions, ...transformedInstitutions];
        }

        setInstitutions(transformedInstitutions);
        setFilteredInstitutions(transformedInstitutions);
      } catch (error: any) {
        console.error('Error fetching institutions:', error);
        setError(error.message || 'Failed to load banks');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstitutions();
  }, [selectedCountry]);

  // Filter institutions based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredInstitutions(institutions);
    } else {
      const filtered = institutions.filter(institution =>
        institution.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredInstitutions(filtered);
    }
  }, [searchTerm, institutions]);

  // Generate link token when user wants to connect
  const generateLinkToken = async () => {
    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          countryCodes: [selectedCountry],
          products: ['transactions', 'auth'],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to generate link token';

        // Provide specific error messages
        if (response.status === 401) {
          throw new Error('You must be logged in to connect a bank account. Please log in and try again.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again in a few minutes.');
        } else {
          throw new Error(errorMessage);
        }
      }

      const data = await response.json();
      return data.link_token;
    } catch (error: any) {
      console.error('Error generating link token:', error);

      // Provide user-friendly error messages for network issues
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        throw new Error('Network error. Please check your connection and try again.');
      }

      throw error;
    }
  };

  // Plaid Link hook configuration
  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: async (public_token, metadata) => {
      try {
        console.log('Plaid Link success:', { public_token, metadata });

        // Exchange public token and sync data
        const response = await fetch('/api/plaid/exchange-public-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            publicToken: public_token,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || 'Failed to complete connection';

          // Provide more specific error messages
          if (response.status === 401) {
            throw new Error('Authentication failed. Please log in again and try connecting your bank.');
          } else if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
          } else if (response.status >= 500) {
            throw new Error('Server error occurred. Please try again in a few minutes.');
          } else {
            throw new Error(errorMessage);
          }
        }

        const result = await response.json();
        console.log('Connection completed:', result);

        setIsConnecting(false);
        setLinkToken(null);
        setError(''); // Clear any previous errors
        setSuccess('Bank account connected successfully! Redirecting...');

        // Trigger success callback after a short delay to show success message
        setTimeout(() => {
          onConnectionSuccess?.();
        }, 1500);
      } catch (error: any) {
        console.error('Error completing Plaid connection:', error);

        // Provide user-friendly error messages
        let userMessage = error.message || 'Failed to complete bank connection';

        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          userMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message?.includes('timeout')) {
          userMessage = 'Connection timed out. Please try again.';
        }

        setError(userMessage);
        setIsConnecting(false);
        setLinkToken(null);
      }
    },
    onLoad: () => {
      console.log('Plaid Link loaded');
    },
    onExit: (err, metadata) => {
      console.log('Plaid Link exited:', { err, metadata });
      setIsConnecting(false);
      setLinkToken(null);

      if (err) {
        setError(err.display_message || 'Connection was cancelled');
      }
    },
    onEvent: (eventName, metadata) => {
      console.log('Plaid Link event:', eventName, metadata);
    },
  });

  // Use useEffect to handle opening Plaid Link when token and ready are both true
  useEffect(() => {
    if (linkToken && ready && isConnecting) {
      open();
    }
  }, [linkToken, ready, isConnecting, open]);

  const handleInstitutionSelect = async (institution: Institution) => {
    if (isConnecting) return;

    setIsConnecting(true);
    setError('');

    try {
      // Generate link token for this institution
      const token = await generateLinkToken();
      setLinkToken(token);
      // The useEffect will handle opening the link when both token and ready are true
    } catch (error: any) {
      console.error('Error initiating bank connection:', error);
      setError(error.message || 'Failed to connect to bank');
      setIsConnecting(false);
    }
  };

  const countries = [
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'ES', name: 'Spain' },
    { code: 'IE', name: 'Ireland' },
    { code: 'NL', name: 'Netherlands' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl float-animation"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl float-animation" style={{ animationDelay: '-3s' }}></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            {hasConnectedBanks ? 'Manage Bank Connections' : 'Connect Your Bank Account'}
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            {hasConnectedBanks
              ? 'View your connected banks or add additional bank connections.'
              : 'Securely connect your bank account to start tracking your finances. Your data is encrypted and protected.'
            }
          </p>
        </div>

        {/* Existing Bank Connections */}
        {hasConnectedBanks && bankConnections.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Connected Banks ({bankConnections.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankConnections.map((connection) => (
                <div key={connection.$id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {formatBankName(connection.institutionId).charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {formatBankName(connection.institutionId)}
                      </h3>
                      <p className="text-gray-400 text-sm capitalize">
                        Status: {connection.status}
                      </p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-gray-300 text-sm">
                Want to connect another bank? Select from the institutions below.
              </p>
            </div>
          </div>
        )}

        {/* Country Selector */}
        <div className="glass-card p-6 mb-6">
          <label htmlFor="country" className="block text-sm font-medium text-white mb-2">
            Select Country
          </label>
          <select
            id="country"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            disabled={isConnecting}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code} className="bg-gray-800 text-white">
                {country.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Bar */}
        {!isLoading && institutions.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <label htmlFor="search" className="block text-sm font-medium text-white mb-2">
              Search Banks
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by bank name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isConnecting}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="glass-card p-4 mb-6 border-red-500/50 bg-red-500/10">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <span className="text-red-400 font-medium">Connection Failed</span>
                <p className="text-red-300 mt-1 text-sm leading-relaxed">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="mt-2 text-red-400 hover:text-red-300 text-sm underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="glass-card p-4 mb-6 border-green-500/50 bg-green-500/10">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400 font-medium">Success</span>
            </div>
            <p className="text-green-300 mt-2">{success}</p>
          </div>
        )}

        {/* Sandbox Testing Component */}
        {process.env.NODE_ENV === 'development' && (
          <SandboxTestButton userId={userId} />
        )}

        {/* Connection Status */}
        {isConnecting && (
          <div className="glass-card p-6 mb-6 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white font-medium">Connecting to your bank via Plaid...</p>
            <p className="text-gray-400 text-sm mt-2">You will be prompted to securely connect your account</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="glass-card p-8 text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading banks...</p>
            </div>
          )}

          {/* Institutions List */}
          {!isLoading && (
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Available Banks ({filteredInstitutions.length})
              </h2>

              {filteredInstitutions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">
                    {searchTerm ? 'No banks found matching your search.' : 'No banks available for this country.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {filteredInstitutions.map((institution) => (
                    <button
                      key={institution.institution_id}
                      onClick={() => handleInstitutionSelect(institution)}
                      disabled={isConnecting}
                      className={`p-4 rounded-lg border transition-all duration-200 text-left ${
                        isConnecting
                          ? 'bg-gray-800/50 border-gray-700 cursor-not-allowed opacity-50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {institution.logo ? (
                          <img
                            src={institution.logo}
                            alt={`${institution.name} logo`}
                            className="w-10 h-10 rounded-lg object-contain bg-white/10 p-1"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center ${institution.logo ? "hidden" : ""}`}>
                          <span className="text-white font-semibold text-sm">
                            {institution.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">
                            {institution.name}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            Connect via Plaid
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 glass-card p-6">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="text-white font-medium mb-2">Secure & Private</h3>
              <p className="text-gray-300 text-sm">
                Your banking credentials are never stored on our servers. We use bank-grade encryption
                and Plaid's secure platform to ensure your data is always protected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}