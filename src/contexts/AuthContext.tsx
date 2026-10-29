import React, { createContext, useContext } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface AuthContextType {
  userId: Id<'users'> | null;
  isAuthenticated: boolean;
  user: any;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: convexAuthed, isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser, convexAuthed ? {} : 'skip');

  const loading = authLoading || (convexAuthed && user === undefined);

  const value: AuthContextType = {
    userId: (user as any)?._id ?? null,
    isAuthenticated: convexAuthed && !!user,
    user,
    loading,
    logout: () => {
      void signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
