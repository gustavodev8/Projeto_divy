/* ========================================
   SCRIPT DE EXECUÇÃO DE MIGRAÇÕES
   Executa todas as migrações pendentes
   ======================================== */

require('dotenv').config();

const path = require('path');
const { up: addPlansSystem } = require('./add_plans_system');
const { up: addTrashSystem } = require('./add_trash_system');

// Detectar ambiente
const isPostgres = !!process.env.DATABASE_URL;

async function runMigrations() {
    console.log('====================================');
    console.log('🚀 Executando Migrações do Nura');
    console.log('====================================');
    console.log(`📊 Banco de dados: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    console.log('');

    let db;

    try {
        // Conectar ao banco
        if (isPostgres) {
            const { Pool } = require('pg');
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            // Wrapper para compatibilidade
            db = {
                query: async (text, params) => {
                    const result = await pool.query(text, params);
                    return result.rows;
                },
                pool: pool
            };

            console.log('✅ Conectado ao PostgreSQL');

        } else {
            const Database = require('better-sqlite3');
            const dbPath = path.join(__dirname, '..', 'database', 'nura.db');
            db = new Database(dbPath);
            db.pragma('foreign_keys = ON');
            console.log('✅ Conectado ao SQLite');
        }

        // Executar migrações
        console.log('');
        console.log('--- Migração: Sistema de Planos ---');
        await addPlansSystem(db, isPostgres);

        console.log('');
        console.log('--- Migração: Sistema de Lixeira ---');
        await addTrashSystem(db, isPostgres);

        console.log('');
        console.log('====================================');
        console.log('✅ Todas as migrações executadas!');
        console.log('====================================');

    } catch (error) {
        console.error('❌ Erro ao executar migrações:', error);
        process.exit(1);
    } finally {
        // Fechar conexão
        if (db) {
            if (isPostgres && db.pool) {
                await db.pool.end();
            } else if (!isPostgres) {
                db.close();
            }
        }
    }
}

// Executar
runMigrations();
