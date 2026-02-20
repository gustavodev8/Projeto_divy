/**
 * DIVY - Plan Service
 * Gerencia plano do usuário
 */

import api from './api';

export interface UserPlan {
  id: string;           // 'normal' | 'pro' | 'promax'
  name: string;         // 'Normal' | 'Pro' | 'Pro Max'
  price: number;
  expires_at?: string | null;
  usage?: {
    tasks: number;
    lists: number;
  };
  limits?: {
    tasks: number;
    lists: number;
  };
}

export interface PlanResult {
  success: boolean;
  plan?: UserPlan;
  error?: string;
}

export const getMyPlan = async (): Promise<PlanResult> => {
  try {
    const response = await api.get<any>('/v1/plans/my-plan');
    const data = response.data;

    if (data.success) {
      // A API pode retornar o plano em diferentes formatos
      const planData = data.plan || data.currentPlan || data.data;

      if (planData) {
        return {
          success: true,
          plan: planData,
        };
      }
    }

    return { success: false, error: data.error || 'Plano não encontrado' };
  } catch (error) {
    return { success: false, error: 'Erro de conexão' };
  }
};
