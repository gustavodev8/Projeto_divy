/**
 * DIVY - API Service
 * Cliente HTTP para integração com backend
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL da API - usa localhost em dev, produção em build
const API_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://projeto-divy.onrender.com';

console.log('🌐 API URL:', API_URL);

// Criar instância do axios
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token JWT em todas as requisições
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('❌ Erro ao obter token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas
api.interceptors.response.use(
  (response) => response,
  async (error) => {
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
