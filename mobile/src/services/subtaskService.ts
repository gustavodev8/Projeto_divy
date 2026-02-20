/**
 * DIVY - Subtask Service
 * Gerencia subtarefas via API REST
 */

import api from './api';

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at?: string;
  updated_at?: string;
}

// GET /subtasks/:taskId — busca subtarefas de uma tarefa
export const getSubtasks = async (taskId: number): Promise<{
  success: boolean;
  subtasks?: Subtask[];
  error?: string;
}> => {
  try {
    const res = await api.get(`/subtasks/${taskId}`);
    return { success: true, subtasks: res.data ?? [] };
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.error || 'Erro ao buscar subtarefas' };
  }
};

// POST /subtasks — cria nova subtarefa
export const createSubtask = async (
  taskId: number,
  title: string,
  position?: number
): Promise<{ success: boolean; subtask?: Subtask; error?: string; limitReached?: boolean }> => {
  try {
    const res = await api.post('/subtasks', { task_id: taskId, title, position: position ?? 0 });
    return { success: true, subtask: res.data };
  } catch (err: any) {
    const code = err?.response?.data?.code;
    return {
      success: false,
      limitReached: code === 'PLAN_LIMIT_REACHED',
      error: err?.response?.data?.error || 'Erro ao criar subtarefa',
    };
  }
};

// PUT /subtasks/:id — atualiza título, completed ou position
export const updateSubtask = async (
  subtaskId: number,
  updates: Partial<Pick<Subtask, 'title' | 'completed' | 'position'>>
): Promise<{ success: boolean; subtask?: Subtask; error?: string }> => {
  try {
    const res = await api.put(`/subtasks/${subtaskId}`, updates);
    return { success: true, subtask: res.data };
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.error || 'Erro ao atualizar subtarefa' };
  }
};

// DELETE /subtasks/:id — deleta uma subtarefa
export const deleteSubtask = async (
  subtaskId: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    await api.delete(`/subtasks/${subtaskId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.response?.data?.error || 'Erro ao deletar subtarefa' };
  }
};
