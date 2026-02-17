/**
 * DIVY - Task Service
 * Serviço para gerenciamento de tarefas
 */

import { AxiosError } from 'axios';
import api from './api';
import { Task, ApiResponse } from '../types/api';

interface TasksResponse {
  success: boolean;
  tasks?: Task[];
  error?: string;
}

interface TaskResponse {
  success: boolean;
  task?: Task;
  error?: string;
}

interface BasicResponse {
  success: boolean;
  error?: string;
}

type TaskStatus = 'pending' | 'in_progress' | 'completed';
type TaskPriority = 'low' | 'medium' | 'high';

interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string;
  list_id?: number;
  section_id?: number;
}

interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string;
  list_id?: number;
  section_id?: number;
}

/**
 * Listar todas as tarefas do usuário
 */
export const getTasks = async (): Promise<TasksResponse> => {
  try {
    console.log('🌐 Fazendo GET /api/tasks...');
    const response = await api.get<any>('/api/tasks');
    console.log('📡 Resposta completa:', response.data);
    console.log('📊 Status da resposta:', response.status);

    if (response.data.success) {
      console.log('✅ API retornou success=true');
      // A API retorna "tasks" diretamente, não "data"
      const tasks = response.data.tasks || [];
      console.log('📋 Tarefas recebidas:', tasks.length);
      return {
        success: true,
        tasks: tasks,
      };
    }

    console.log('⚠️ API retornou success=false');
    return {
      success: false,
      error: response.data.error || 'Erro ao buscar tarefas',
    };
  } catch (error) {
    console.error('❌ Erro ao buscar tarefas:', error);
    const axiosError = error as AxiosError<{ error?: string }>;
    console.error('📡 Status:', axiosError.response?.status);
    console.error('📡 Data:', axiosError.response?.data);
    return {
      success: false,
      error: axiosError.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Criar nova tarefa
 */
export const createTask = async (
  title: string,
  description: string = '',
  priority: TaskPriority = 'medium',
  options?: { due_date?: string; list_id?: number; section_id?: number }
): Promise<TaskResponse> => {
  try {
    const payload: CreateTaskPayload = {
      title,
      description,
      priority,
      status: 'pending',
      ...(options?.due_date && { due_date: options.due_date }),
      ...(options?.list_id && { list_id: options.list_id }),
      ...(options?.section_id && { section_id: options.section_id }),
    };

    const response = await api.post<ApiResponse<Task>>('/api/tasks', payload);

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
    const axiosError = error as AxiosError<{ error?: string }>;
    return {
      success: false,
      error: axiosError.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Atualizar tarefa
 */
export const updateTask = async (
  id: number,
  updates: UpdateTaskPayload
): Promise<TaskResponse> => {
  try {
    const response = await api.put<ApiResponse<Task>>(`/api/tasks/${id}`, updates);

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
    const axiosError = error as AxiosError<{ error?: string }>;
    return {
      success: false,
      error: axiosError.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Deletar tarefa
 */
export const deleteTask = async (id: number): Promise<BasicResponse> => {
  try {
    const response = await api.delete<ApiResponse>(`/api/tasks/${id}`);

    if (response.data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao deletar tarefa',
    };
  } catch (error) {
    console.error('❌ Erro ao deletar tarefa:', error);
    const axiosError = error as AxiosError<{ error?: string }>;
    return {
      success: false,
      error: axiosError.response?.data?.error || 'Erro de conexão',
    };
  }
};

/**
 * Marcar tarefa como concluída/pendente
 */
export const toggleTaskStatus = async (
  id: number,
  currentStatus: TaskStatus
): Promise<TaskResponse> => {
  const newStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  return updateTask(id, { status: newStatus });
};

/**
 * Buscar tarefas de uma seção específica
 */
export const getTasksBySection = async (sectionId: number): Promise<TasksResponse> => {
  try {
    console.log(`🌐 Fazendo GET /api/tasks (filtradas por section_id=${sectionId})...`);
    const response = await api.get<any>('/api/tasks');

    if (response.data.success) {
      const allTasks = response.data.tasks || [];
      // Filtrar tarefas pela seção
      const sectionTasks = allTasks.filter((task: Task) => task.section_id === sectionId);
      console.log(`📋 Tarefas da seção ${sectionId}:`, sectionTasks.length);
      return {
        success: true,
        tasks: sectionTasks,
      };
    }

    return {
      success: false,
      error: response.data.error || 'Erro ao buscar tarefas',
    };
  } catch (error) {
    console.error('❌ Erro ao buscar tarefas da seção:', error);
    const axiosError = error as AxiosError<{ error?: string }>;
    return {
      success: false,
      error: axiosError.response?.data?.error || 'Erro de conexão',
    };
  }
};

export default {
  getTasks,
  getTasksBySection,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus,
};
