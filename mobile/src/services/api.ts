/**
 * DIVY - API Service
 * Cliente HTTP para integração com backend
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL da API - usa localhost em dev, produção em build
const API_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://projeto-divy.onrender.com';

console.log('🌐 API URL:', API_URL);

// Criar instância do axios
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token JWT e user_id em todas as requisições
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userJson = await AsyncStorage.getItem('user');

      console.log('🔍 INTERCEPTOR - URL:', config.url);
      console.log('🔑 INTERCEPTOR - Token existe?', !!token);
      console.log('👤 INTERCEPTOR - UserJson existe?', !!userJson);

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('✅ Header Authorization adicionado');
      } else {
        console.log('⚠️ Token não encontrado, header não adicionado');
      }

      // Adicionar user_id para compatibilidade com API legada (/api/tasks)
      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          console.log('👤 INTERCEPTOR - User parseado:', user);
          console.log('🆔 INTERCEPTOR - User.id:', user.id);

          if (user.id && config.headers) {
            config.headers['x-user-id'] = user.id.toString();
            console.log('✅ Header x-user-id adicionado:', user.id);
          } else {
            console.log('⚠️ user.id não existe ou headers não disponível');
          }
        } catch (parseError) {
          console.error('❌ Erro ao parsear user do AsyncStorage:', parseError);
        }
      } else {
        console.log('⚠️ userJson não existe no AsyncStorage');
      }

      console.log('📋 INTERCEPTOR - Headers finais:', config.headers);
    } catch (error) {
      console.error('❌ Erro ao obter token:', error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response) {
      // Logout automático se token inválido
      if (error.response.status === 401) {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
