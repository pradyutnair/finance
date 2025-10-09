'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { account, OAuthProvider } from '@/lib/appwrite';
import { Models } from 'appwrite';

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: Models.User<Models.Preferences> | null) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      initialized: false,

      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),

      checkAuth: async () => {
        try {
          const currentUser = await account.get();
          set({ user: currentUser, loading: false, initialized: true });
        } catch (error) {
          set({ user: null, loading: false, initialized: true });
        }
      },

      refresh: async () => {
        try {
          const currentUser = await account.get();
          set({ user: currentUser });
        } catch (error) {
          set({ user: null });
        }
      },

      login: async (email: string, password: string) => {
        try {
          await account.createEmailPasswordSession(email, password);
          const currentUser = await account.get();
          set({ user: currentUser });
          // Navigation will be handled by the component
        } catch (error) {
          throw error;
        }
      },

      loginWithGoogle: async () => {
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
      },

      register: async (email: string, password: string, name: string) => {
        try {
          await account.create('unique()', email, password, name);
          await get().login(email, password);
        } catch (error) {
          throw error;
        }
      },

      logout: async () => {
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

          set({ user: null });
          // Navigation will be handled by the component
        } catch (error) {
          // Even if logout fails, clear local state
          sessionStorage.removeItem('nexpass-app-session');
          set({ user: null });
        }
      },
    }),
    {
      name: 'nexpass-auth-storage',
      partialize: (state) => ({
        // Only persist user data, not loading state
        user: state.user,
      }),
    }
  )
);

// Initialize auth on app load (call this from a component mount)
export const initializeAuth = () => {
  const { initialized, checkAuth } = useAuthStore.getState();
  if (!initialized) {
    checkAuth();
  }
};
