/**
 * DIVY - Task Service
 * Serviço para gerenciamento de tarefas
 */

import api from './api';

/**
 * Listar todas as tarefas do usuário
 */
export const getTasks = async () => {
  try {
    const response = await api.get('/v1/tarefas');

    if (response.data.success) {
      return {
        success: true,
        tasks: response.data.data || [],
      };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao buscar tarefas',
    };
  } catch (error) {
    console.error('❌ Erro ao buscar tarefas:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Criar nova tarefa
 */
export const createTask = async (title, description = '', priority = 'medium') => {
  try {
    const response = await api.post('/v1/tarefas', {
      title,
      description,
      priority,
      status: 'pending',
    });

    if (response.data.success) {
      return {
        success: true,
        task: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao criar tarefa',
    };
  } catch (error) {
    console.error('❌ Erro ao criar tarefa:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Atualizar tarefa
 */
export const updateTask = async (id, updates) => {
  try {
    const response = await api.put(`/v1/tarefas/${id}`, updates);

    if (response.data.success) {
      return {
        success: true,
        task: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao atualizar tarefa',
    };
  } catch (error) {
    console.error('❌ Erro ao atualizar tarefa:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Deletar tarefa
 */
export const deleteTask = async (id) => {
  try {
    const response = await api.delete(`/v1/tarefas/${id}`);

    if (response.data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao deletar tarefa',
    };
  } catch (error) {
    console.error('❌ Erro ao deletar tarefa:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Marcar tarefa como concluída/pendente
 */
export const toggleTaskStatus = async (id, currentStatus) => {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  return updateTask(id, { status: newStatus });
};

export default {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus,
};
