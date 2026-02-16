/**
 * DIVY - Auth Service
 * Serviço de autenticação (Login, Registro, Verificação)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

/**
 * Login do usuário
 */
export const login = async (emailOrUsername, password) => {
  try {
    console.log('🔶 authService.login chamado');
    console.log('📧 emailOrUsername:', emailOrUsername);

    // Detectar se é email (contém @) ou username
    const isEmail = emailOrUsername.includes('@');
    console.log('🔍 É email?', isEmail);

    const payload = {
      ...(isEmail ? { email: emailOrUsername } : { username: emailOrUsername }),
      password,
    };
    console.log('📤 Payload da request:', { ...payload, password: '***' });

    const response = await api.post('/v1/auth/login', payload);
    console.log('📥 Response recebida:', response.data);

    // Backend retorna accessToken, não token
    const token = response.data.accessToken || response.data.token;

    if (response.data.success && token) {
      console.log('✅ Login bem-sucedido, salvando no AsyncStorage');
      // Salvar token e user no AsyncStorage
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));

      return {
        success: true,
        user: response.data.user,
        token: token,
      };
    }

    console.log('⚠️ Response sem success ou token');
    return {
      success: false,
      error: response.data.error || 'Erro ao fazer login',
    };
  } catch (error) {
    console.error('❌ Erro no login (catch):', error);
    console.error('❌ Error.response:', error.response?.data);
    return {
      success: false,
      error: error.response?.data?.error || 'Erro de conexão com o servidor',
    };
  }
};

/**
 * Enviar código de verificação para registro
 */
export const sendVerificationCode = async (name, email, password) => {
  try {
    const response = await api.post('/v1/auth/send-code', {
      name,
      email,
      password,
    });

    return {
      success: response.data.success,
      error: response.data.error,
    };
  } catch (error) {
    console.error('❌ Erro ao enviar código:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao enviar código de verificação',
    };
  }
};

/**
 * Verificar código e completar registro
 */
export const verifyCode = async (email, code) => {
  try {
    const response = await api.post('/v1/auth/verify-code', {
      email,
      code,
    });

    // Backend retorna accessToken, não token
    const token = response.data.accessToken || response.data.token;

    if (response.data.success && token) {
      // Salvar token e user no AsyncStorage
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));

      return {
        success: true,
        user: response.data.user,
        token: token,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Código inválido',
    };
  } catch (error) {
    console.error('❌ Erro ao verificar código:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Erro ao verificar código',
    };
  }
};

/**
 * Logout do usuário
 */
export const logout = async () => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao fazer logout:', error);
    return { success: false, error: 'Erro ao fazer logout' };
  }
};

/**
 * Obter usuário do AsyncStorage
 */
export const getStoredUser = async () => {
  try {
    const userJson = await AsyncStorage.getItem('user');
    const token = await AsyncStorage.getItem('token');

    if (userJson && token) {
      return {
        user: JSON.parse(userJson),
        token,
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Erro ao obter usuário:', error);
    return null;
  }
};

export default {
  login,
  sendVerificationCode,
  verifyCode,
  logout,
  getStoredUser,
};
