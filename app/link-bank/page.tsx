'use client';

import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation'; // Removed as not used
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Building2, Shield, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useBankConnection } from '@/hooks/useBankConnection';
import { AuthGuard } from '@/components/auth-guard';
import { DebugAuth } from '@/components/debug-auth';

interface Institution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo?: string;
  max_access_valid_for_days: string;
}

export default function LinkBankPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [filteredInstitutions, setFilteredInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('GB');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  
  // const router = useRouter(); // Removed as not used
  const { bankConnections, hasConnectedBanks, user } = useBankConnection();

  // Available countries
  const countries = [
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
    { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
    { code: 'AT', name: 'Austria', flag: '🇦🇹' },
    { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  ];

  // Fetch institutions when country changes
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        const response = await fetch(`/api/gocardless/institutions?country=${selectedCountry}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch institutions (${response.status})`);
        }
        
        const data = await response.json();
        
        // Add Sandbox Finance for testing if in development
        const institutionsWithSandbox = process.env.NODE_ENV === 'development' 
          ? [{
              id: "SANDBOXFINANCE_SFIN0000",
              name: "🧪 Sandbox Finance (Test Bank)",
              bic: "SFIN0000",
              transaction_total_days: "730",
              countries: ["GB"],
              logo: null,
              max_access_valid_for_days: "90"
            }, ...data]
          : data;
        
        setInstitutions(institutionsWithSandbox);
        setFilteredInstitutions(institutionsWithSandbox);
      } catch (error: unknown) {
        console.error('Error fetching institutions:', error);
        setError(error instanceof Error ? error.message : 'Failed to load banks');
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
        institution.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        institution.bic.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredInstitutions(filtered);
    }
  }, [searchTerm, institutions]);

  const handleInstitutionSelect = async (institution: Institution) => {
    if (!user) {
      setError('Please log in to connect a bank account');
      return;
    }

    setSelectedInstitution(institution);
    setIsConnecting(true);
    setError('');

    try {
      // Create requisition according to GoCardless flow
      const requisitionResponse = await fetch('/api/gocardless/requisitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          institutionId: institution.id,
          redirect: `${window.location.origin}/link-bank/callback`,
          reference: `user_${user.$id}_${Date.now()}`,
          userLanguage: 'en',
        })
      });

      if (!requisitionResponse.ok) {
        const errorData = await requisitionResponse.json();
        throw new Error(errorData.error || 'Failed to create bank connection');
      }

      const requisitionData = await requisitionResponse.json();
      
      // Redirect user to GoCardless consent page
      if (requisitionData.link) {
        window.location.href = requisitionData.link;
      } else {
        throw new Error('No consent link received from GoCardless');
      }
    } catch (error: unknown) {
      console.error('Error connecting to bank:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to bank');
      setIsConnecting(false);
      setSelectedInstitution(null);
    }
  };

  const selectedCountryData = countries.find(c => c.code === selectedCountry);

  return (
    <AuthGuard>
      {process.env.NODE_ENV === 'development'}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {hasConnectedBanks ? 'Add Another Bank' : 'Connect Your Bank'}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {hasConnectedBanks 
                ? 'Connect additional bank accounts to get a complete view of your finances.' 
                : 'Securely connect your bank account to start tracking your finances. Your data is encrypted and protected with bank-level security.'
              }
            </p>
          </div>

          {/* Existing Connections */}
          {hasConnectedBanks && bankConnections.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Connected Banks ({bankConnections.length})
                </CardTitle>
                <CardDescription>
                  Your currently connected bank accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bankConnections.map((connection) => (
                    <div key={connection.$id} className="flex items-center space-x-3 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {connection.institutionName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {connection.institutionName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={connection.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {connection.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Country Selection */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Select Country</CardTitle>
              <CardDescription>
                Choose your country to see available banks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedCountry} onValueChange={setSelectedCountry} disabled={isConnecting}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <div className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Search */}
          {!isLoading && institutions.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search banks by name or BIC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isConnecting}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Connection Status */}
          {isConnecting && selectedInstitution && (
            <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <div className="font-medium">Connecting to {selectedInstitution.name}...</div>
                <div className="text-sm mt-1">You will be redirected to your bank&apos;s secure login page</div>
              </AlertDescription>
            </Alert>
          )}

          {/* Institutions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedCountryData?.flag} Available Banks in {selectedCountryData?.name}
                <Badge variant="outline" className="ml-auto">
                  {filteredInstitutions.length} banks
                </Badge>
              </CardTitle>
              <CardDescription>
                Select a bank to connect your account securely
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredInstitutions.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                    {searchTerm ? 'No banks found' : 'No banks available'}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {searchTerm 
                      ? 'Try adjusting your search terms or selecting a different country.'
                      : 'No banks are available for this country at the moment.'
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {filteredInstitutions.map((institution) => (
                    <Button
                      key={institution.id}
                      onClick={() => handleInstitutionSelect(institution)}
                      disabled={isConnecting}
                      variant="outline"
                      className={`p-6 h-auto text-left justify-start transition-all duration-200 ${
                        isConnecting && selectedInstitution?.id === institution.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50'
                      }`}
                    >
                      <div className="flex items-center space-x-4 w-full">
                        {institution.logo ? (
                          <img
                            src={institution.logo}
                            alt={`${institution.name} logo`}
                            className="w-12 h-12 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 p-2"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <div className={`w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center ${institution.logo ? "hidden" : ""}`}>
                          <span className="text-white font-semibold">
                            {institution.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate mb-1">
                            {institution.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Badge variant="secondary" className="text-xs">
                              {institution.transaction_total_days} days history
                            </Badge>
                          </div>
                        </div>
                        {isConnecting && selectedInstitution?.id === institution.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        ) : (
                          <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card className="mt-8 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                    Bank-Level Security & Privacy
                  </h3>
                  <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                    <li>• Your banking credentials are never stored on our servers</li>
                    <li>• We use bank-grade encryption and comply with PSD2 regulations</li>
                    <li>• You can revoke access at any time through your bank or our platform</li>
                    <li>• All data is encrypted in transit and at rest</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
