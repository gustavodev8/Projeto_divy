// ===== MIGRAÇÃO: ADICIONAR CAMPOS DE IA NA TABELA USER_SETTINGS =====
// Este script adiciona os campos necessários para as configurações de IA

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'nura.db'));

function addAISettings() {
    console.log('🔄 Iniciando migração: Adicionar campos de IA nas configurações...');

    try {
        // Verificar se a tabela user_settings existe
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='user_settings'
        `).get();

        if (!tableExists) {
            // Criar tabela user_settings com todos os campos
            console.log('📝 Criando tabela user_settings...');
            db.exec(`
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE NOT NULL,
                    hide_completed BOOLEAN DEFAULT 0,
                    highlight_urgent BOOLEAN DEFAULT 1,
                    auto_suggestions BOOLEAN DEFAULT 1,
                    detail_level TEXT DEFAULT 'Médio',
                    dark_mode BOOLEAN DEFAULT 0,
                    primary_color TEXT DEFAULT '#49a09d',
                    current_plan TEXT DEFAULT 'pro',
                    plan_renewal_date TEXT DEFAULT '30 de dezembro de 2025',
                    view_mode TEXT DEFAULT 'lista',
                    email_notifications BOOLEAN DEFAULT 1,
                    ai_descriptions_enabled BOOLEAN DEFAULT 1,
                    ai_detail_level TEXT DEFAULT 'medio',
                    ai_optimization_enabled BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            `);
            console.log('✅ Tabela user_settings criada com sucesso!');
        } else {
            // Verificar se os campos de IA já existem
            const columns = db.prepare(`PRAGMA table_info(user_settings)`).all();
            const columnNames = columns.map(col => col.name);

            // Adicionar campo ai_descriptions_enabled se não existir
            if (!columnNames.includes('ai_descriptions_enabled')) {
                console.log('📝 Adicionando campo ai_descriptions_enabled...');
                db.exec(`ALTER TABLE user_settings ADD COLUMN ai_descriptions_enabled BOOLEAN DEFAULT 1`);
                console.log('✅ Campo ai_descriptions_enabled adicionado!');
            }

            // Adicionar campo ai_detail_level se não existir
            if (!columnNames.includes('ai_detail_level')) {
                console.log('📝 Adicionando campo ai_detail_level...');
                db.exec(`ALTER TABLE user_settings ADD COLUMN ai_detail_level TEXT DEFAULT 'medio'`);
                console.log('✅ Campo ai_detail_level adicionado!');
            }

            // Adicionar campo ai_optimization_enabled se não existir
            if (!columnNames.includes('ai_optimization_enabled')) {
                console.log('📝 Adicionando campo ai_optimization_enabled...');
                db.exec(`ALTER TABLE user_settings ADD COLUMN ai_optimization_enabled BOOLEAN DEFAULT 1`);
                console.log('✅ Campo ai_optimization_enabled adicionado!');
            }
        }

        console.log('✅ Migração concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        throw error;
    } finally {
        db.close();
    }
}

// Executar migração se chamado diretamente
if (require.main === module) {
    addAISettings();
}

module.exports = { addAISettings };
