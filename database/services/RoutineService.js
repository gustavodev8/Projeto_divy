const { db } = require('../init.js');

class RoutineService {
  saveRoutine(routineData) {
    try {
      const { description, generated_text, start_time, end_time, model_used = 'gemini-2.0-flash', userId = 1 } = routineData;
      
      const stmt = db.prepare(`
        INSERT INTO routines (user_id, description, generated_text, start_time, end_time, model_used)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(userId, description, generated_text, start_time, end_time, model_used);
      
      return { success: true, id: result.lastInsertRowid };
      
    } catch (error) {
      console.error('❌ Erro ao salvar rotina:', error);
      return { success: false, error: error.message };
    }
  }
  
  getUserRoutines(userId = 1) {
    try {
      const stmt = db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC');
      return stmt.all(userId);
    } catch (error) {
      console.error('❌ Erro ao buscar rotinas:', error);
      return [];
    }
  }
}

module.exports = new RoutineService();