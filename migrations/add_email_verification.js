/* ========================================
   MIGRATION: Sistema de Verificação de Email
   Cria tabela para armazenar códigos de verificação
   ======================================== */

async function up(db, isPostgres) {
    console.log('📧 Criando tabela verification_codes...');

    if (isPostgres) {
        // PostgreSQL
        await db.query(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                code VARCHAR(6) NOT NULL,
                name VARCHAR(255),
                password_hash VARCHAR(255),
                type VARCHAR(20) DEFAULT 'register',
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                verified BOOLEAN DEFAULT FALSE,
                attempts INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Índices para performance
        await db.query('CREATE INDEX IF NOT EXISTS idx_vc_email ON verification_codes(email)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_vc_code ON verification_codes(code)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_vc_expires ON verification_codes(expires_at)');

        console.log('✅ Tabela verification_codes criada (PostgreSQL)');
    } else {
        // SQLite
        db.exec(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                name TEXT,
                password_hash TEXT,
                type TEXT DEFAULT 'register',
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                verified INTEGER DEFAULT 0,
                attempts INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.exec('CREATE INDEX IF NOT EXISTS idx_vc_email ON verification_codes(email)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_vc_code ON verification_codes(code)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_vc_expires ON verification_codes(expires_at)');

        console.log('✅ Tabela verification_codes criada (SQLite)');
    }
}

async function down(db, isPostgres) {
    console.log('🗑️ Removendo tabela verification_codes...');

    if (isPostgres) {
        await db.query('DROP TABLE IF EXISTS verification_codes');
    } else {
        db.exec('DROP TABLE IF EXISTS verification_codes');
    }

    console.log('✅ Tabela verification_codes removida');
}

module.exports = { up, down };
