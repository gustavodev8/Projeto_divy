/**
 * DIVY - Section Service
 * Serviço para gerenciamento de seções
 */

import { AxiosError } from 'axios';
import api from './api';

export interface Section {
  id: number;
  user_id: number;
  list_id: number;
  name: string;
  emoji?: string;
  is_collapsed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface SectionsResponse {
  success: boolean;
  sections?: Section[];
  error?: string;
}

/**
 * Listar todas as seções de uma lista
 * user_id é enviado automaticamente no header x-user-id pelo interceptor
 */
export const getSectionsByList = async (listId: number): Promise<SectionsResponse> => {
  try {
    console.log(`🌐 Fazendo GET /api/sections?list_id=${listId}...`);
    const response = await api.get<any>(`/api/sections?list_id=${listId}`);
    console.log('📡 Resposta seções:', response.data);

    if (response.data.success) {
      const sections = response.data.sections || [];
      console.log('📋 Seções recebidas:', sections.length);
      return {
        success: true,
        sections: sections,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao buscar seções',
    };
  } catch (error) {
    console.error('❌ Erro ao buscar seções:', error);
    const axiosError = error as AxiosError<{ error?: string }>;
    return {
      success: false,
      error: axiosError.response?.data?.error || 'Erro de conexão',
    };
  }
};

export default {
  getSectionsByList,
};
