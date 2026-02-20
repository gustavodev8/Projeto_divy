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

interface SectionResponse {
  success: boolean;
  section?: Section;
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

/**
 * Criar nova seção em uma lista
 */
export const createSection = async (name: string, listId: number): Promise<SectionResponse> => {
  try {
    const response = await api.post<any>('/api/sections', {
      name,
      list_id: listId,
      position: 0,
    });

    if (response.data.success) {
      return { success: true, section: response.data.section };
    }

    return { success: false, error: response.data.error || 'Erro ao criar seção' };
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string }>;
    return { success: false, error: axiosError.response?.data?.error || 'Erro de conexão' };
  }
};

/**
 * Renomear uma seção
 */
export const updateSection = async (sectionId: number, name: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await api.put<any>(`/api/sections/${sectionId}`, { name });
    if (response.data.success) {
      return { success: true };
    }
    return { success: false, error: response.data.error || 'Erro ao atualizar seção' };
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string }>;
    return { success: false, error: axiosError.response?.data?.error || 'Erro de conexão' };
  }
};

/**
 * Excluir uma seção
 */
export const deleteSection = async (sectionId: number): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await api.delete<any>(`/api/sections/${sectionId}`);
    if (response.data.success) {
      return { success: true };
    }
    return { success: false, error: response.data.error || 'Erro ao excluir seção' };
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string }>;
    return { success: false, error: axiosError.response?.data?.error || 'Erro de conexão' };
  }
};

export default {
  getSectionsByList,
  createSection,
  updateSection,
  deleteSection,
};
