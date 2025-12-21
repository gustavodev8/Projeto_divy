const { Pool } = require('pg');
require('dotenv').config();

const isPostgres = !!process.env.DATABASE_URL;
let pool = null;

if (isPostgres) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
        console.error('❌ Erro inesperado no PostgreSQL:', err.message);
        if (err.message.includes('Connection terminated') || err.message.includes('ECONNRESET')) {
            console.log('🔄 Tentando reconectar ao PostgreSQL...');
        }
    });

    pool.on('connect', () => {
        console.log('✅ Cliente conectado ao pool PostgreSQL');
    });

    console.log('🐘 Conectado ao PostgreSQL');
}

function convertPlaceholders(text) {
    let paramIndex = 1;
    return text.replace(/\?/g, () => `$${paramIndex++}`);
}

async function query(text, params = []) {
    if (!pool) throw new Error('Database not configured');

    try {
        const pgText = convertPlaceholders(text);
        const result = await pool.query(pgText, params);
        return result.rows;
    } catch (error) {
        console.error('❌ Erro na query:', error.message);
        console.error('Query:', text);
        console.error('Params:', params);
        throw error;
    }
}

async function get(text, params = []) {
    const rows = await query(text, params);
    return rows[0] || null;
}

async function run(text, params = []) {
    if (!pool) throw new Error('Database not configured');

    try {
        const pgText = convertPlaceholders(text);
        const result = await pool.query(pgText, params);
        return {
            changes: result.rowCount,
            lastInsertRowid: result.rows[0]?.id || null
        };
    } catch (error) {
        console.error('❌ Erro no run:', error.message);
        console.error('Query:', text);
        console.error('Params:', params);
        throw error;
    }
}

function close() {
    if (pool) {
        pool.end();
        console.log('✅ Conexão PostgreSQL fechada');
    }
}

module.exports = {
    query,
    get,
    run,
    close,
    isPostgres
};