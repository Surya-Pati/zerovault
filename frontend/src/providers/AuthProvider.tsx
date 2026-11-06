"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';

type Role = 'RESEARCHER' | 'BUYER' | 'ADMIN';

export interface User {
  id: string;
  wallet_address: string;
  role: Role;
  verified_buyer: boolean;
  profile_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children, hasSession }: { children: React.ReactNode, hasSession?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    // Only attempt to fetch if we have reason to believe a session exists
    const hasClientSession = typeof document !== 'undefined' && document.cookie.includes('is_logged_in=1');
    if (!hasSession && !hasClientSession) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetchApi('/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'GET' });
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
