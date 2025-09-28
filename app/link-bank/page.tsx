'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Building2, 
  Shield, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Clock,
  Globe2,
  X,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { useBankConnection } from '@/hooks/useBankConnection';
import { AuthGuard } from '@/components/auth-guard';
import { Account } from 'appwrite';
import { createAppwriteClient } from '@/lib/auth';

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
  const [selectedCountry, setSelectedCountry] = useState('NL');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  
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
      // Obtain short-lived Appwrite JWT and send as Authorization for server auth
      let jwtToken: string | null = null;
      try {
        const client = createAppwriteClient();
        const account = new Account(client);
        const jwt = await account.createJWT();
        jwtToken = jwt?.jwt || null;
      } catch (jwtErr) {
        console.warn('Could not create Appwrite JWT; will rely on cookies if present');
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;

      const requisitionResponse = await fetch('/api/gocardless/requisitions', {
        method: 'POST',
        headers,
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

  return (
    <AuthGuard>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Back to Banks */}
        <div className="mb-4">
          <Link href="/banks" className="inline-flex">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Banks
            </Button>
          </Link>
        </div>
        
        {/* Header */}
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            {hasConnectedBanks ? 'Connect Another Bank' : 'Connect Your Bank'}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {hasConnectedBanks 
              ? 'Add additional bank accounts to get a complete view of your finances.' 
              : 'Securely connect your bank account to start tracking your transactions and manage your finances.'
            }
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6 relative">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="pr-8">{error}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-destructive/20"
              onClick={() => setError('')}
            >
              <X className="h-3 w-3" />
            </Button>
          </Alert>
        )}

        {/* Connection Status */}
        {isConnecting && selectedInstitution && (
          <Alert className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription>
              <div className="font-medium text-blue-900 dark:text-blue-100">
                Connecting to {selectedInstitution.name}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                You will be redirected to your bank's secure login page
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Connected Banks */}
        {hasConnectedBanks && bankConnections.length > 0 && (
          <Card className="mb-8 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Connected Banks
                </CardTitle>
                <Badge variant="secondary" className="font-medium">
                  {bankConnections.length} {bankConnections.length === 1 ? 'bank' : 'banks'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bankConnections.map((connection) => (
                  <div key={connection.$id} className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent hover:text-white">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {connection.institutionName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {connection.institutionName}
                      </div>
                      <Badge 
                        variant={connection.status === 'active' ? 'default' : 'secondary'} 
                        className="mt-1 h-5 text-xs"
                      >
                        {connection.status}
                      </Badge>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Globe2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Select value={selectedCountry} onValueChange={setSelectedCountry} disabled={isConnecting}>
                  <SelectTrigger className="w-full sm:w-52">
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
              </div>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                <Input
                  placeholder="Search banks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isConnecting}
                  className="pl-9"
                />
              </div>

              {searchTerm && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setSearchTerm('')}
                  className="gap-2 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Banks List */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Available Banks</CardTitle>
                <CardDescription>
                  Select a bank to connect your account securely
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-medium">
                {filteredInstitutions.length} {filteredInstitutions.length === 1 ? 'bank' : 'banks'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 ">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full max-w-xs" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-4" />
                  </div>
                ))}
              </div>
            ) : filteredInstitutions.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm ? 'No banks found' : 'No banks available'}
                </h3>
                <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                  {searchTerm 
                    ? 'Try adjusting your search terms or selecting a different country.'
                    : 'No banks are available for this country at the moment.'
                  }
                </p>
                {searchTerm && (
                  <Button variant="outline" onClick={() => setSearchTerm('')} className="gap-2">
                    <X className="h-4 w-4" />
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredInstitutions.map((institution) => (
                  <div
                    key={institution.id}
                    className={`group relative rounded-lg border transition-all duration-200 hover:border-primary/50 hover:shadow-sm ${
                      isConnecting && selectedInstitution?.id === institution.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <Button
                      onClick={() => handleInstitutionSelect(institution)}
                      disabled={isConnecting}
                      variant="ghost"
                      className="w-full p-4 h-auto text-left justify-start hover:bg-transparent"
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="relative">
                          {institution.logo ? (
                            <img
                              src={institution.logo}
                              alt={`${institution.name} logo`}
                              className="w-12 h-12 rounded-lg object-contain bg-background p-2 border hover:bg-accent hover:text-white"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center border ${institution.logo ? "hidden" : ""}`}>
                            <span className="font-semibold text-sm text-primary">
                              {institution.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 ">
                          <div className="font-medium text-sm truncate mb-1 text-foreground group-hover:text-white">
                            {institution.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-white">
                            <Clock className="h-3 w-3" />
                            <span>{institution.transaction_total_days} days history</span>
                            <span>•</span>
                            <span>{institution.max_access_valid_for_days} days validity</span>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          {isConnecting && selectedInstitution?.id === institution.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          )}
                        </div>
                      </div>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="mt-8 border-muted shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/50 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Bank-Grade Security</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Your banking credentials are never stored on our servers and we use bank-grade encryption with PSD2 compliance.</p>
                  <p>You can revoke access at any time through your bank or our platform, and all data is encrypted in transit and at rest.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </AuthGuard>
  );
}