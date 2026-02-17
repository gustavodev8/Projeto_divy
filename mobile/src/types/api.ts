/**
 * DIVY - API Types
 * Tipos compartilhados para requisições e respostas da API
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface AuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken?: string;
  user: User;
  token?: string; // Compatibilidade com resposta antiga
}

export interface User {
  id: number;
  name: string;
  email: string;
  username?: string;
  avatar_url?: string;
  plan?: 'normal' | 'pro' | 'promax';
  created_at?: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  list_id?: number;
  section_id?: number;
  created_at: string;
  updated_at: string;
}

export interface VerificationCodeRequest {
  name: string;
  email: string;
  password: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}
