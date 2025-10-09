'use client';

import { useEffect } from 'react';
import { initializeAuth } from '@/lib/stores/auth-store';
import { initializeCurrency } from '@/lib/stores/currency-store';

/**
 * Client component that initializes Zustand stores on app load
 */
export function StoreInitializer() {
  useEffect(() => {
    // Initialize auth state
    initializeAuth();
    
    // Initialize currency rates
    initializeCurrency();
  }, []);

  return null;
}
