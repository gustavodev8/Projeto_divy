/* ========================================
   MIGRAÇÃO: Sistema de Planos
   Adiciona suporte a planos Normal/Pro/ProMax
   ======================================== */

/**
 * Executa a migração para adicionar sistema de planos
 * @param {Object} db - Conexão com banco de dados
 * @param {boolean} isPostgres - true se PostgreSQL, false se SQLite
 */
async function up(db, isPostgres) {
    console.log('🚀 Iniciando migração: Sistema de Planos');

    try {
        // ===== 1. Adicionar coluna 'plan' na tabela users =====
        console.log('📝 Adicionando coluna plan na tabela users...');

        if (isPostgres) {
            // PostgreSQL - verificar se coluna já existe
            const checkPlan = await db.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'plan'
            `);

            if (checkPlan.length === 0) {
                await db.query(`
                    ALTER TABLE users
                    ADD COLUMN plan VARCHAR(20) DEFAULT 'normal'
                `);
                console.log('✅ Coluna plan adicionada');
            } else {
                console.log('⏭️ Coluna plan já existe');
            }

            // Adicionar plan_expires_at
            const checkExpires = await db.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'plan_expires_at'
            `);

            if (checkExpires.length === 0) {
                await db.query(`
                    ALTER TABLE users
                    ADD COLUMN plan_expires_at TIMESTAMP
                `);
                console.log('✅ Coluna plan_expires_at adicionada');
            } else {
                console.log('⏭️ Coluna plan_expires_at já existe');
            }

        } else {
            // SQLite - verificar se coluna existe
            const tableInfo = db.prepare("PRAGMA table_info(users)").all();
            const hasPlan = tableInfo.some(col => col.name === 'plan');
            const hasExpires = tableInfo.some(col => col.name === 'plan_expires_at');

            if (!hasPlan) {
                db.prepare("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'normal'").run();
                console.log('✅ Coluna plan adicionada');
            } else {
                console.log('⏭️ Coluna plan já existe');
            }

            if (!hasExpires) {
                db.prepare("ALTER TABLE users ADD COLUMN plan_expires_at TEXT").run();
                console.log('✅ Coluna plan_expires_at adicionada');
            } else {
                console.log('⏭️ Coluna plan_expires_at já existe');
            }
        }

        // ===== 2. Criar tabela ai_usage =====
        console.log('📝 Criando tabela ai_usage...');

        if (isPostgres) {
            await db.query(`
                CREATE TABLE IF NOT EXISTS ai_usage (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    type VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Índices para performance
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id)
            `);
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at)
            `);
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_ai_usage_type ON ai_usage(type)
            `);

        } else {
            db.prepare(`
                CREATE TABLE IF NOT EXISTS ai_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `).run();

            // Índices
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id)`).run();
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at)`).run();
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_usage_type ON ai_usage(type)`).run();
        }

        console.log('✅ Tabela ai_usage criada');

        // ===== 3. Criar tabela subscriptions (histórico de assinaturas) =====
        console.log('📝 Criando tabela subscriptions...');

        if (isPostgres) {
            await db.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    plan VARCHAR(20) NOT NULL,
                    status VARCHAR(20) DEFAULT 'active',
                    payment_method VARCHAR(50),
                    payment_id VARCHAR(255),
                    amount DECIMAL(10, 2),
                    currency VARCHAR(3) DEFAULT 'BRL',
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    cancelled_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Índices
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)
            `);
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)
            `);

        } else {
            db.prepare(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    plan TEXT NOT NULL,
                    status TEXT DEFAULT 'active',
                    payment_method TEXT,
                    payment_id TEXT,
                    amount REAL,
                    currency TEXT DEFAULT 'BRL',
                    started_at TEXT DEFAULT (datetime('now')),
                    expires_at TEXT,
                    cancelled_at TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `).run();

            // Índices
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`).run();
            db.prepare(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`).run();
        }

        console.log('✅ Tabela subscriptions criada');

        // ===== 4. Atualizar usuários existentes para plano 'normal' =====
        console.log('📝 Atualizando usuários existentes...');

        if (isPostgres) {
            await db.query(`
                UPDATE users SET plan = 'normal' WHERE plan IS NULL
            `);
        } else {
            db.prepare(`UPDATE users SET plan = 'normal' WHERE plan IS NULL`).run();
        }

        console.log('✅ Usuários atualizados para plano normal');

        console.log('🎉 Migração concluída com sucesso!');
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
    console.log('🔄 Revertendo migração: Sistema de Planos');

    try {
        if (isPostgres) {
            await db.query('DROP TABLE IF EXISTS subscriptions CASCADE');
            await db.query('DROP TABLE IF EXISTS ai_usage CASCADE');
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS plan');
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS plan_expires_at');
        } else {
            db.prepare('DROP TABLE IF EXISTS subscriptions').run();
            db.prepare('DROP TABLE IF EXISTS ai_usage').run();
            // SQLite não suporta DROP COLUMN facilmente, seria necessário recriar a tabela
            console.log('⚠️ SQLite: Colunas plan e plan_expires_at não removidas (limitação do SQLite)');
        }

        console.log('✅ Migração revertida');
        return true;

    } catch (error) {
        console.error('❌ Erro ao reverter:', error);
        throw error;
    }
}

module.exports = { up, down };
