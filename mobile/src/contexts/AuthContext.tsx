/**
 * DIVY - Auth Context
 * Gerencia estado global de autenticação
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import authService from '../services/authService';
import { User } from '../types/api';

interface AuthContextData {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, code: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Verificar se usuário está logado ao iniciar app
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<void> => {
    try {
      const storedData = await authService.getStoredUser();
      if (storedData) {
        setUser(storedData.user);
      }
    } catch (error) {
      console.error('❌ Erro ao verificar autenticação:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    console.log('🔷 AuthContext.signIn chamado');
    console.log('📧 Email recebido:', email);

    try {
      const result = await authService.login(email, password);
      console.log('📦 Resultado do authService.login:', result);

      if (result.success && result.user) {
        console.log('✅ Login bem-sucedido, setando user:', result.user);
        setUser(result.user);
      } else {
        console.log('❌ Login falhou:', result.error);
      }

      return result;
    } catch (error) {
      console.error('💥 Erro em signIn:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  };

  const signUp = async (email: string, code: string): Promise<AuthResult> => {
    const result = await authService.verifyCode(email, code);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const signOut = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextData => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
