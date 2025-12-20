// Migration: Adicionar campo telegram_chat_id na tabela users
const db = require('../../database');

async function addTelegramField() {
    try {
        console.log('🔄 Executando migration: add_telegram_field...');

        // Verifica se a coluna já existe
        const checkColumn = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'telegram_chat_id'
        `);

        if (checkColumn.length > 0) {
            console.log('ℹ️ Campo telegram_chat_id já existe, pulando migration');
            return;
        }

        // Adiciona a coluna telegram_chat_id
        await db.query(`
            ALTER TABLE users
            ADD COLUMN telegram_chat_id VARCHAR(255) UNIQUE
        `);

        console.log('✅ Campo telegram_chat_id adicionado com sucesso!');
        console.log('📋 Descrição: Campo para armazenar o chat_id do Telegram de cada usuário');

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    addTelegramField()
        .then(() => {
            console.log('✅ Migration concluída com sucesso!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration falhou:', error);
            process.exit(1);
        });
}

module.exports = { addTelegramField };
