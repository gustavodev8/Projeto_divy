/**
 * DIVY - List Service
 * Serviço para gerenciamento de listas
 */

import { AxiosError } from 'axios';
import api from './api';

export interface List {
  id: number;
  user_id: number;
  name: string;
  emoji: string;
  color: string;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ListsResponse {
  success: boolean;
  lists?: List[];
  error?: string;
}

/**
 * Listar todas as listas do usuário
 */
export const getLists = async (): Promise<ListsResponse> => {
  try {
    console.log('🌐 Fazendo GET /api/lists...');
    const response = await api.get<any>('/api/lists');
    console.log('📡 Resposta listas:', response.data);

    if (response.data.success) {
      const lists = response.data.lists || [];
      console.log('📋 Listas recebidas:', lists.length);
      return {
        success: true,
        lists: lists,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao buscar listas',
    };
  } catch (error) {
    console.error('❌ Erro ao buscar listas:', error);
    const axiosError = error as AxiosError<{ error?: string }>;
    return {
      success: false,
      error: axiosError.response?.data?.error || 'Erro de conexão',
    };
  }
};

export default {
  getLists,
};
