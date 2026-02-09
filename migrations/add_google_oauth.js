/* ========================================
   MIGRATION: Adicionar campos para Google OAuth
   ======================================== */

const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        console.log('🔄 Iniciando migration: Google OAuth...');

        // Adicionar coluna google_id
        try {
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE
            `);
            console.log('✅ Coluna google_id adicionada');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️ Coluna google_id já existe');
            } else {
                throw e;
            }
        }

        // Adicionar coluna avatar_url
        try {
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT
            `);
            console.log('✅ Coluna avatar_url adicionada');
        } catch (e) {
            if (e.code === '42701') {
                console.log('ℹ️ Coluna avatar_url já existe');
            } else {
                throw e;
            }
        }

        // Tornar password opcional (para usuários que logam só com Google)
        try {
            await pool.query(`
                ALTER TABLE users ALTER COLUMN password DROP NOT NULL
            `);
            console.log('✅ Coluna password agora é opcional');
        } catch (e) {
            console.log('ℹ️ Coluna password já é opcional ou erro:', e.message);
        }

        console.log('✅ Migration Google OAuth concluída!');

    } catch (error) {
        console.error('❌ Erro na migration:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { runMigration };
