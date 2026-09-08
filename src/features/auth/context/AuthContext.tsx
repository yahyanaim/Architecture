import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser } from '../api/authApi';
import { apiClient } from '@/lib/axios';

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  acceptInvite: (token: string, password: string, confirmPassword: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authApi.me();
        setUser(userData);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setUser({ id: response.id, name: response.name, email: response.email, role: response.role });
  };

  const register = async (name: string, email: string, password: string, confirmPassword: string) => {
    const response = await authApi.register(name, email, password, confirmPassword);
    setUser({ id: response.id, name: response.name, email: response.email, role: response.role });
  };

  const acceptInvite = async (token: string, password: string, confirmPassword: string, name?: string) => {
    const response = await authApi.acceptInvite(token, password, confirmPassword, name);
    setUser({ id: response.id, name: response.name, email: response.email, role: response.role });
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, acceptInvite, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
