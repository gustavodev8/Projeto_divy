/* ========================================
   MIGRAÇÃO: Sistema de Lixeira (Soft Delete)
   Adiciona campo deleted_at para soft delete de tarefas
   ======================================== */

/**
 * Executa a migração para adicionar sistema de lixeira
 * @param {Object} db - Conexão com banco de dados
 * @param {boolean} isPostgres - true se PostgreSQL, false se SQLite
 */
async function up(db, isPostgres) {
    console.log('🗑️ Iniciando migração: Sistema de Lixeira');

    try {
        // ===== 1. Adicionar coluna 'deleted_at' na tabela tasks =====
        console.log('📝 Adicionando coluna deleted_at na tabela tasks...');

        if (isPostgres) {
            // PostgreSQL - verificar se coluna já existe
            const checkDeletedAt = await db.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'deleted_at'
            `);

            if (checkDeletedAt.length === 0) {
                await db.query(`
                    ALTER TABLE tasks
                    ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL
                `);
                console.log('✅ Coluna deleted_at adicionada');
            } else {
                console.log('⏭️ Coluna deleted_at já existe');
            }

            // Criar índice para otimizar consultas
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at)
            `);
            console.log('✅ Índice idx_tasks_deleted_at criado');

            // Criar índice composto para consultas de usuário + deleted
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_tasks_user_deleted ON tasks(user_id, deleted_at)
            `);
            console.log('✅ Índice idx_tasks_user_deleted criado');

        } else {
            // SQLite - verificar se coluna existe
            const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
            const hasDeletedAt = tableInfo.some(col => col.name === 'deleted_at');

            if (!hasDeletedAt) {
                db.prepare("ALTER TABLE tasks ADD COLUMN deleted_at TEXT DEFAULT NULL").run();
                console.log('✅ Coluna deleted_at adicionada');
            } else {
                console.log('⏭️ Coluna deleted_at já existe');
            }

            // Criar índices
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at)`).run();
            console.log('✅ Índice idx_tasks_deleted_at criado');

            db.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_user_deleted ON tasks(user_id, deleted_at)`).run();
            console.log('✅ Índice idx_tasks_user_deleted criado');
        }

        console.log('🎉 Migração do sistema de lixeira concluída com sucesso!');
        return true;

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        throw error;
    }
}

/**
 * Reverte a migração (para rollback)
 */
async function down(db, isPostgres) {
    console.log('🔄 Revertendo migração: Sistema de Lixeira');

    try {
        if (isPostgres) {
            await db.query('DROP INDEX IF EXISTS idx_tasks_deleted_at');
            await db.query('DROP INDEX IF EXISTS idx_tasks_user_deleted');
            await db.query('ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at');
        } else {
            db.prepare('DROP INDEX IF EXISTS idx_tasks_deleted_at').run();
            db.prepare('DROP INDEX IF EXISTS idx_tasks_user_deleted').run();
            // SQLite não suporta DROP COLUMN facilmente
            console.log('⚠️ SQLite: Coluna deleted_at não removida (limitação do SQLite)');
        }

        console.log('✅ Migração revertida');
        return true;

    } catch (error) {
        console.error('❌ Erro ao reverter:', error);
        throw error;
    }
}

module.exports = { up, down };
