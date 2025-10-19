'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { account, OAuthProvider } from '@/lib/appwrite';
import { Models } from 'appwrite';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // Removed session clearing on app restart; preserve Appwrite cookie session

  const checkAuth = async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      setIsEmailVerified(currentUser.emailVerification);
    } catch (error) {
      setUser(null);
      setIsEmailVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      setIsEmailVerified(currentUser.emailVerification);
    } catch (error) {
      setUser(null);
      setIsEmailVerified(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await account.createEmailPasswordSession(email, password);
      const currentUser = await account.get();
      setUser(currentUser);
      setIsEmailVerified(currentUser.emailVerification);

      // Only allow dashboard access if email is verified
      if (!currentUser.emailVerification) {
        router.push('/verify-email');
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      // Use OAuth2 Token flow: Appwrite redirects back with userId & secret
      await account.createOAuth2Token(
        OAuthProvider.Google,
        `${window.location.origin}/auth/callback`,
        `${window.location.origin}/login`
      );
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      // Create account without automatically logging in
      await account.create('unique()', email, password, name);

      // Send verification email
      await account.createVerification(`${window.location.origin}/verify-email-success`);

      // Create session for the user so they can be redirected to verification page
      await account.createEmailPasswordSession(email, password);
      const currentUser = await account.get();
      setUser(currentUser);
      setIsEmailVerified(currentUser.emailVerification);

      router.push('/verify-email');
    } catch (error) {
      throw error;
    }
  };

  const sendVerificationEmail = async () => {
    try {
      await account.createVerification(`${window.location.origin}/verify-email-success`);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Delete current session
      await account.deleteSession('current');

      // Also delete all sessions to be thorough
      try {
        await account.deleteSessions();
      } catch (error) {
        // Ignore errors if no other sessions exist
      }

      // Clear the app session flag so next visit requires fresh login
      sessionStorage.removeItem('nexpass-app-session');

      setUser(null);
      setIsEmailVerified(false);
      router.push('/login');
    } catch (error) {
      // Even if logout fails, clear local state and redirect
      sessionStorage.removeItem('nexpass-app-session');
      setUser(null);
      setIsEmailVerified(false);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, refresh, sendVerificationEmail, isEmailVerified }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
