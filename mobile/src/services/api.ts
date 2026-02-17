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

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          if (user.id && config.headers) {
            config.headers['x-user-id'] = user.id.toString();
          }
        } catch (parseError) {
          console.error('❌ Erro ao parsear user:', parseError);
        }
      }
    } catch (error) {
      console.error('❌ Erro no interceptor:', error);
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
