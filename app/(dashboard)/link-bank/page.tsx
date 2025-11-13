'use client';

import { AuthGuard } from '@/components/auth-guard';
import { PlaidBankConnectionScreen } from '@/components/link-bank/PlaidBankConnectionScreen';
import { useBankConnection } from '@/hooks/useBankConnection';

export default function LinkBankPage() {
  // Get user ID from the hook - we'll need this for Plaid
  const { user } = useBankConnection();
  const userId = user?.$id || user?.id || 'demo-user';

  const handleConnectionSuccess = () => {
    // Redirect back to banks page after successful connection
    window.location.href = '/banks';
  };

  // Bypass auth guard in development for testing
  if (process.env.NODE_ENV === 'development') {
    return (
      <PlaidBankConnectionScreen
        userId={userId}
        onConnectionSuccess={handleConnectionSuccess}
      />
    );
  }

  return (
    <AuthGuard>
      <PlaidBankConnectionScreen
        userId={userId}
        onConnectionSuccess={handleConnectionSuccess}
      />
    </AuthGuard>
  );
}