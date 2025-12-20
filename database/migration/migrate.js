// migration/migrate.js
import TaskService from '../services/TaskService.js';
import { db } from '../database/init.js';

function migrateFromLocalStorage() {
  console.log('🔄 Iniciando migração do localStorage para SQLite...');
  
  try {
    // Ler dados do localStorage (simulação - você pode adaptar)
    const oldTasks = JSON.parse(localStorage.getItem('nura_tasks') || '[]');
    
    let migrated = 0;
    let errors = 0;
    
    oldTasks.forEach(oldTask => {
      try {
        TaskService.createTask({
          name: oldTask.name,
          responsible: oldTask.responsible || 'Eu',
          dueDate: oldTask.dueDate || new Date().toISOString().split('T')[0],
          priority: oldTask.priority || 'medium',
          status: oldTask.status || 'pendente'
        });
        migrated++;
      } catch (error) {
        console.error(`❌ Erro ao migrar tarefa ${oldTask.id}:`, error);
        errors++;
      }
    });
    
    console.log(`✅ Migração concluída! ${migrated} tarefas migradas, ${errors} erros.`);
    
    // Opcional: limpar localStorage após migração
    // localStorage.removeItem('nura_tasks');
    // localStorage.removeItem('nura_task_counter');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  }
}

// Executar migração (chame esta função uma vez)
// migrateFromLocalStorage();