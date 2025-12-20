const { db } = require('../init.js');

class TaskService {
  
  getUserTasks(userId = 1) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM tasks 
        WHERE user_id = ? 
        ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
          END,
          created_at DESC
      `);
      return stmt.all(userId);
    } catch (error) {
      console.error('❌ Erro ao buscar tarefas:', error);
      return [];
    }
  }
  
  createTask(taskData) {
    try {
      const { name, responsible = 'Eu', dueDate, priority = 'medium', status = 'pendente', userId = 1 } = taskData;
      
      const stmt = db.prepare(`
        INSERT INTO tasks (user_id, name, responsible, due_date, priority, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(userId, name, responsible, dueDate, priority, status);
      
      console.log('✅ Tarefa salva no banco. ID:', result.lastInsertRowid);
      return { success: true, id: result.lastInsertRowid };
      
    } catch (error) {
      console.error('❌ Erro ao criar tarefa:', error);
      return { success: false, error: error.message };
    }
  }
  
  updateTask(taskId, updates) {
    try {
      const allowedFields = ['name', 'responsible', 'due_date', 'priority', 'status'];
      const setClause = [];
      const values = [];
      
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });
      
      if (setClause.length === 0) {
        return { success: false, error: 'Nenhum campo válido para atualizar' };
      }
      
      setClause.push('updated_at = CURRENT_TIMESTAMP');
      values.push(taskId);
      
      const stmt = db.prepare(`UPDATE tasks SET ${setClause.join(', ')} WHERE id = ?`);
      
      stmt.run(...values);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro ao atualizar tarefa:', error);
      return { success: false, error: error.message };
    }
  }
  
  deleteTask(taskId) {
    try {
      const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
      stmt.run(taskId);
      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao deletar tarefa:', error);
      return { success: false, error: error.message };
    }
  }
  
  getTasksByStatus(status, userId = 1) {
    try {
      const stmt = db.prepare('SELECT * FROM tasks WHERE user_id = ? AND status = ? ORDER BY created_at DESC');
      return stmt.all(userId, status);
    } catch (error) {
      console.error('❌ Erro ao buscar tarefas por status:', error);
      return [];
    }
  }
  
  getUserStats(userId = 1) {
    try {
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as concluidas,
          SUM(CASE WHEN status = 'progresso' THEN 1 ELSE 0 END) as em_progresso,
          SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as prioridade_alta
        FROM tasks 
        WHERE user_id = ?
      `);
      return stmt.get(userId);
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return { total: 0, concluidas: 0, em_progresso: 0, pendentes: 0, prioridade_alta: 0 };
    }
  }
}

module.exports = new TaskService();