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
    const response = await api.get<any>(`/api/sections?list_id=${listId}`);

    if (response.data.success) {
      return { success: true, sections: response.data.sections || [] };
    }

    return { success: false, error: response.data.error || 'Erro ao buscar seções' };
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string }>;
    return { success: false, error: axiosError.response?.data?.error || 'Erro de conexão' };
  }
};

export default {
  getSectionsByList,
};
