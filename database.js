const { Pool } = require('pg');
require('dotenv').config();

const isPostgres = !!process.env.DATABASE_URL;
let pool = null;

if (isPostgres) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    pool.on('error', (err) => {
        console.error('❌ Erro inesperado no PostgreSQL:', err);
    });

    console.log('🐘 Conectado ao PostgreSQL');
}

function convertPlaceholders(text) {
    let paramIndex = 1;
    return text.replace(/\?/g, () => `$${paramIndex++}`);
}

async function query(text, params = []) {
    if (!pool) throw new Error('Database not configured');
    
    const pgText = convertPlaceholders(text);
    const result = await pool.query(pgText, params);
    return result.rows;
}

async function get(text, params = []) {
    const rows = await query(text, params);
    return rows[0] || null;
}

async function run(text, params = []) {
    if (!pool) throw new Error('Database not configured');
    
    const pgText = convertPlaceholders(text);
    const result = await pool.query(pgText, params);
    return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
    };
}

async function initializeDatabase() {
    // ... seu código de inicialização
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
    initializeDatabase,
    close,
    isPostgres
};