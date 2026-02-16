/**
 * DIVY - Auth Context
 * Gerencia estado global de autenticação
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verificar se usuário está logado ao iniciar app
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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

  const signIn = async (email, password) => {
    console.log('🔷 AuthContext.signIn chamado');
    console.log('📧 Email recebido:', email);

    try {
      const result = await authService.login(email, password);
      console.log('📦 Resultado do authService.login:', result);

      if (result.success) {
        console.log('✅ Login bem-sucedido, setando user:', result.user);
        setUser(result.user);
      } else {
        console.log('❌ Login falhou:', result.error);
      }

      return result;
    } catch (error) {
      console.error('💥 Erro em signIn:', error);
      return { success: false, error: error.message };
    }
  };

  const signUp = async (email, code) => {
    const result = await authService.verifyCode(email, code);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  };

  const signOut = async () => {
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
