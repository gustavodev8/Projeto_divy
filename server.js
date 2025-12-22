// ===== IMPORTS E CONFIGURAÇÕES INICIAIS =====
const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database'); // Conexão com banco (SQLite local ou PostgreSQL produção)
const cron = require('node-cron');
const { enviarResumoParaTodos, enviarResumoDiario } = require('./emailService');
const { inicializarBot, notificarNovaTarefaUrgente, getBot, getToken } = require('./telegramService');
const fetch = require('node-fetch'); // Para keep-alive

dotenv.config(); // Carrega variáveis do .env

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARES =====
app.use(cors()); // Permite requisições de outros domínios
app.use(express.json()); // Permite receber JSON no body

// ===== CONFIGURAÇÃO DA IA (GEMINI) =====
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ===== MIGRATION: CORRIGIR SCHEMA DA TABELA TASKS =====
(async () => {
    if (!db.isPostgres) {
        console.log('⏭️ Pulando migration de tasks (não é PostgreSQL)');
        return;
    }

    try {
        console.log('🔄 Verificando schema da tabela tasks...');

        // 1. Adicionar coluna title se não existir
        const titleExists = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'title'
        `);

        if (titleExists.length === 0) {
            console.log('🔄 Adicionando coluna title...');
            await db.query(`ALTER TABLE tasks ADD COLUMN title TEXT`);
            console.log('✅ Coluna title adicionada');
        }

        // 2. Adicionar coluna description se não existir
        const descExists = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'description'
        `);

        if (descExists.length === 0) {
            console.log('🔄 Adicionando coluna description...');
            await db.query(`ALTER TABLE tasks ADD COLUMN description TEXT`);
            console.log('✅ Coluna description adicionada');
        }

        // 3. Copiar dados de name para title (se title estiver vazio)
        await db.query(`
            UPDATE tasks
            SET title = name
            WHERE title IS NULL OR title = ''
        `);

        // 4. Remover constraint NOT NULL de name (se existir)
        try {
            await db.query(`ALTER TABLE tasks ALTER COLUMN name DROP NOT NULL`);
            console.log('✅ Constraint NOT NULL removida da coluna name');
        } catch (err) {
            if (!err.message.includes('does not exist')) {
                console.log('⚠️ Aviso:', err.message);
            }
        }

        // 5. Remover constraint CHECK antiga de status
        try {
            await db.query(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check`);
            console.log('✅ Constraint CHECK antiga removida');
        } catch (err) {
            console.log('⚠️ Aviso ao remover constraint:', err.message);
        }

        // 6. Adicionar nova constraint CHECK com valores atualizados
        try {
            await db.query(`
                ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
                CHECK (status IN ('pending', 'in_progress', 'completed', 'pendente', 'progresso', 'concluido', 'concluída'))
            `);
            console.log('✅ Nova constraint CHECK adicionada com valores novos e antigos');
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.log('⚠️ Aviso ao adicionar constraint:', err.message);
            }
        }

        // 7. Atualizar valores de status para o novo padrão
        await db.query(`
            UPDATE tasks
            SET status = CASE
                WHEN status = 'pendente' THEN 'pending'
                WHEN status = 'progresso' THEN 'in_progress'
                WHEN status = 'concluido' OR status = 'concluída' THEN 'completed'
                ELSE status
            END
            WHERE status IN ('pendente', 'progresso', 'concluido', 'concluída')
        `);

        // 8. Remover constraint CHECK antiga de priority se existir e adicionar nova
        try {
            await db.query(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check`);
            await db.query(`
                ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
                CHECK (priority IN ('low', 'medium', 'high'))
            `);
            console.log('✅ Constraint de priority atualizada');
        } catch (err) {
            console.log('⚠️ Aviso ao atualizar priority constraint:', err.message);
        }

        console.log('✅ Schema da tabela tasks atualizado com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao atualizar schema de tasks:', error.message);
    }
})();

// ===== MIGRATION: ADICIONAR CAMPO TELEGRAM =====
(async () => {
    try {
        // Verifica se a coluna telegram_chat_id já existe
        const checkColumn = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'telegram_chat_id'
        `);

        if (checkColumn.length === 0) {
            console.log('🔄 Adicionando coluna telegram_chat_id na tabela users...');

            await db.query(`
                ALTER TABLE users
                ADD COLUMN telegram_chat_id VARCHAR(255) UNIQUE
            `);

            console.log('✅ Coluna telegram_chat_id adicionada com sucesso!');
        } else {
            console.log('✅ Coluna telegram_chat_id já existe');
        }
    } catch (error) {
        console.error('❌ Erro ao adicionar coluna telegram_chat_id:', error.message);
    }
})();

// ===== MIGRATION: ADICIONAR CAMPOS DE IA =====
(async () => {
    try {
        // Verifica se as colunas de IA já existem
        const checkAIColumns = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'user_settings'
            AND column_name IN ('ai_descriptions_enabled', 'ai_detail_level', 'ai_optimization_enabled', 'weekly_report')
        `);

        if (checkAIColumns.length < 4) {
            console.log('🔄 Adicionando colunas de IA na tabela user_settings...');

            // Adicionar ai_descriptions_enabled
            if (!checkAIColumns.find(c => c.column_name === 'ai_descriptions_enabled')) {
                await db.query(`
                    ALTER TABLE user_settings
                    ADD COLUMN ai_descriptions_enabled BOOLEAN DEFAULT TRUE
                `);
                console.log('✅ Coluna ai_descriptions_enabled adicionada');
            }

            // Adicionar ai_detail_level
            if (!checkAIColumns.find(c => c.column_name === 'ai_detail_level')) {
                await db.query(`
                    ALTER TABLE user_settings
                    ADD COLUMN ai_detail_level VARCHAR(50) DEFAULT 'medio'
                `);
                console.log('✅ Coluna ai_detail_level adicionada');
            }

            // Adicionar ai_optimization_enabled
            if (!checkAIColumns.find(c => c.column_name === 'ai_optimization_enabled')) {
                await db.query(`
                    ALTER TABLE user_settings
                    ADD COLUMN ai_optimization_enabled BOOLEAN DEFAULT TRUE
                `);
                console.log('✅ Coluna ai_optimization_enabled adicionada');
            }

            // Adicionar weekly_report
            if (!checkAIColumns.find(c => c.column_name === 'weekly_report')) {
                await db.query(`
                    ALTER TABLE user_settings
                    ADD COLUMN weekly_report BOOLEAN DEFAULT TRUE
                `);
                console.log('✅ Coluna weekly_report adicionada');
            }

            console.log('✅ Todas as colunas de IA foram adicionadas com sucesso!');
        } else {
            console.log('✅ Colunas de IA já existem');
        }
    } catch (error) {
        console.error('❌ Erro ao adicionar colunas de IA:', error.message);
    }
})();

// ===== MIGRATION: CRIAR TABELA DE LISTAS =====
(async () => {
    if (!db.isPostgres) {
        console.log('⏭️ Pulando migration de lists (não é PostgreSQL)');
        return;
    }

    try {
        console.log('🔄 Verificando tabela lists...');

        // Verificar se a tabela existe
        const tableExists = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'lists'
            );
        `);

        if (!tableExists[0].exists) {
            console.log('🔄 Criando tabela lists...');

            await db.query(`
                CREATE TABLE lists (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    emoji VARCHAR(10) DEFAULT '📋',
                    color VARCHAR(7) DEFAULT '#146551',
                    is_default BOOLEAN DEFAULT FALSE,
                    position INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            `);

            console.log('✅ Tabela lists criada');

            // Criar índice para performance
            await db.query(`
                CREATE INDEX idx_lists_user_id ON lists(user_id);
            `);

            console.log('✅ Índice criado para lists');
        } else {
            console.log('✅ Tabela lists já existe');
        }

        // Adicionar coluna list_id na tabela tasks se não existir
        const listIdExists = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'list_id'
        `);

        if (listIdExists.length === 0) {
            console.log('🔄 Adicionando coluna list_id na tabela tasks...');

            await db.query(`
                ALTER TABLE tasks
                ADD COLUMN list_id INTEGER,
                ADD CONSTRAINT fk_tasks_list FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL;
            `);

            console.log('✅ Coluna list_id adicionada à tabela tasks');
        }

    } catch (error) {
        console.error('❌ Erro ao criar tabela lists:', error.message);
    }
})();

// ===== MIGRATION: CRIAR TABELA DE SEÇÕES =====
(async () => {
    if (!db.isPostgres) {
        console.log('⏭️ Pulando migration de sections (não é PostgreSQL)');
        return;
    }

    try {
        console.log('🔄 Verificando tabela sections...');

        const tableExists = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'sections'
            );
        `);

        if (!tableExists[0].exists) {
            console.log('🔄 Criando tabela sections...');

            await db.query(`
                CREATE TABLE sections (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    emoji VARCHAR(10) DEFAULT '📁',
                    position INTEGER DEFAULT 0,
                    is_collapsed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            `);

            await db.query(`CREATE INDEX idx_sections_user_id ON sections(user_id);`);
            console.log('✅ Tabela sections criada');
        }

        // Adicionar coluna section_id na tabela tasks
        const sectionIdExists = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'section_id'
        `);

        if (sectionIdExists.length === 0) {
            console.log('🔄 Adicionando coluna section_id na tabela tasks...');
            await db.query(`
                ALTER TABLE tasks
                ADD COLUMN section_id INTEGER,
                ADD CONSTRAINT fk_tasks_section FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL;
            `);
            console.log('✅ Coluna section_id adicionada');
        }

        // Adicionar coluna position na tabela tasks
        const positionExists = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'position'
        `);

        if (positionExists.length === 0) {
            await db.query(`ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0`);
            console.log('✅ Coluna position adicionada às tasks');
        }

    } catch (error) {
        console.error('❌ Erro ao criar tabela sections:', error.message);
    }
})();

// ===== INICIALIZAR BOT DO TELEGRAM =====
inicializarBot(); // Inicia o bot do Telegram com todos os comandos e notificações

// ===== SERVIR ARQUIVOS ESTÁTICOS (HTML, CSS, JS, IMAGENS) =====
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/scripts', express.static(path.join(__dirname, 'public/scripts')));
app.use('/imgs', express.static(path.join(__dirname, 'public/imgs')));

// ===== ROTA RAIZ - REDIRECIONA PARA LOGIN =====
app.get("/", (req, res) => {
    res.redirect('/login');
});

// ===== ROTA DE STATUS DO SISTEMA =====
app.get("/api/status", async (req, res) => {
    try {
        const row = await db.get("SELECT COUNT(*) as count FROM tasks");
        
        res.json({ 
            status: "✅ Servidor Nura ONLINE!", 
            message: "Sistema funcionando perfeitamente!",
            gemini: GEMINI_API_KEY ? "✅ Configurada" : "❌ Faltando API Key",
            tarefas: row ? row.count : 0,
            database: db.isPostgres ? "🐘 PostgreSQL" : "💾 SQLite",
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({ 
            status: "✅ Servidor Nura ONLINE!", 
            message: "Sistema funcionando (erro no BD)",
            gemini: GEMINI_API_KEY ? "✅ Configurada" : "❌ Faltando API Key",
            timestamp: new Date().toISOString()
        });
    }
});

// ===== ROTAS PARA SERVIR PÁGINAS HTML =====

// Login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Login.html'));
});
app.get('/Tela_Login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Login.html'));
});

// Tela Inicial
app.get('/inicial', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Inicial.html'));
});
app.get('/Tela_Inicial.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Inicial.html'));
});

// Gerenciamento de Tarefas
app.get('/gerenciamento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Gerenciamento.html'));
});
app.get('/Tela_Gerenciamento.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Gerenciamento.html'));
});

// Criar Conta
app.get('/criar-conta', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_CriaConta.html'));
});
app.get('/Tela_CriaConta.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_CriaConta.html'));
});

// Ajustes/Configurações
app.get('/ajustes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Ajustes.html'));
});
app.get('/Tela_Ajustes.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_Ajustes.html'));
});

// Teste de Email (página de teste)
app.get('/teste-email', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_TesteEmail.html'));
});
app.get('/Tela_TesteEmail.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/Tela_TesteEmail.html'));
});

// ===== API - GERENCIAMENTO DE TAREFAS =====

// GET - Listar todas as tarefas do usuário
app.get('/api/tasks', async (req, res) => {
    try {
        const userId = req.query.user_id || req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }

        const rows = await db.query(
            "SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC",
            [userId]
        );

        console.log(`📥 ${rows.length} tarefas carregadas para usuário ${userId}`);

        res.json({
            success: true,
            tasks: rows,
            total: rows.length
        });
    } catch (err) {
        console.error('❌ Erro ao buscar tarefas:', err);
        console.error('Detalhes:', err.message);

        let errorMessage = err.message;

        if (err.message.includes('Connection terminated')) {
            errorMessage = 'Connection terminated unexpectedly';
        } else if (err.message.includes('ECONNREFUSED')) {
            errorMessage = 'Banco de dados indisponível';
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// GET - Buscar uma tarefa específica
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.user_id || req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Usuário não identificado' 
            });
        }
        
        const task = await db.get(
            "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
            [id, userId]
        );
        
        if (task) {
            res.json({ 
                success: true, 
                task: task 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'Tarefa não encontrada' 
            });
        }
    } catch (err) {
        console.error('❌ Erro ao buscar tarefa:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// POST - Criar nova tarefa
app.post('/api/tasks', async (req, res) => {
    console.log('📥 Dados recebidos:', req.body);
    
    const title = req.body.title || req.body.name;
    const description = req.body.description || '';
    const status = req.body.status || 'pending';
    const priority = req.body.priority || 'medium';
    const user_id = req.body.user_id;

    if (!user_id) {
        return res.status(401).json({ 
            success: false, 
            error: 'Usuário não identificado' 
        });
    }

    if (!title) {
        return res.status(400).json({ 
            success: false, 
            error: 'Título da tarefa é obrigatório'
        });
    }

    try {
        let info;

        if (db.isPostgres) {
            // PostgreSQL retorna o ID diretamente
            const result = await db.query(
                `INSERT INTO tasks (user_id, title, description, status, priority)
                 VALUES (?, ?, ?, ?, ?) RETURNING id`,
                [user_id, title, description, status, priority]
            );
            info = { lastInsertRowid: result[0].id };
        } else {
            // SQLite usa lastInsertRowid
            info = await db.run(
                `INSERT INTO tasks (user_id, title, description, status, priority)
                 VALUES (?, ?, ?, ?, ?)`,
                [user_id, title, description, status, priority]
            );
        }

        console.log(`✅ Tarefa criada para usuário ${user_id}:`, title);

        // Se a tarefa for urgente, notifica via Telegram
        if (priority === 'high') {
            notificarNovaTarefaUrgente(user_id, title).catch(err => {
                console.log('⚠️ Não foi possível enviar notificação do Telegram:', err.message);
            });
        }

        res.json({
            success: true,
            message: 'Tarefa criada com sucesso!',
            taskId: info.lastInsertRowid
        });
    } catch (err) {
        console.error('❌ Erro ao criar tarefa:', err);
        console.error('Detalhes:', err.message);
        console.error('Stack:', err.stack);

        let errorMessage = 'Erro ao salvar tarefa no banco';

        if (err.message.includes('Connection terminated')) {
            errorMessage = 'Erro de conexão com o banco. Tente novamente em instantes.';
        } else if (err.message.includes('ECONNREFUSED')) {
            errorMessage = 'Banco de dados indisponível';
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// PUT - Atualizar tarefa existente
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, user_id } = req.body;
        
        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }
        
        console.log(`🔄 Atualizando tarefa ${id} do usuário ${user_id}`);
        
        // Verifica se a tarefa pertence ao usuário
        const taskExists = await db.get(
            "SELECT id FROM tasks WHERE id = ? AND user_id = ?",
            [id, user_id]
        );
        
        if (!taskExists) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }
        
        // Monta SQL dinâmico baseado nos campos enviados
        const updates = [];
        const values = [];
        
        if (title !== undefined) {
            updates.push('title = ?');
            values.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }
        if (priority !== undefined) {
            updates.push('priority = ?');
            values.push(priority);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum campo para atualizar'
            });
        }
        
        values.push(id);
        values.push(user_id);
        
        const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
        const result = await db.run(sql, values);
        
        console.log('✅ Tarefa atualizada!');
        
        res.json({
            success: true,
            message: 'Tarefa atualizada com sucesso!',
            changes: result.changes
        });
        
    } catch (err) {
        console.error('❌ Erro ao atualizar tarefa:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar tarefa no banco'
        });
    }
});

// DELETE - Excluir tarefa
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.user_id || req.headers['x-user-id'];
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }
        
        console.log(`🗑️ Excluindo tarefa ${id} do usuário ${userId}...`);
        
        // Busca o título antes de excluir (para log)
        const task = await db.get(
            "SELECT title FROM tasks WHERE id = ? AND user_id = ?",
            [id, userId]
        );
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Tarefa não encontrada'
            });
        }
        
        const result = await db.run(
            "DELETE FROM tasks WHERE id = ? AND user_id = ?",
            [id, userId]
        );
        
        console.log(`✅ Tarefa "${task.title}" excluída!`);
        
        res.json({
            success: true,
            message: 'Tarefa excluída com sucesso!',
            changes: result.changes
        });
        
    } catch (err) {
        console.error('❌ Erro ao excluir tarefa:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao excluir tarefa do banco'
        });
    }
});

// ===== API - GERENCIAMENTO DE LISTAS =====

// GET - Listar todas as listas do usuário
app.get('/api/lists', async (req, res) => {
    try {
        const userId = req.query.user_id || req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }

        const lists = await db.query(
            "SELECT * FROM lists WHERE user_id = ? ORDER BY position ASC, created_at ASC",
            [userId]
        );

        console.log(`📋 ${lists.length} listas carregadas para usuário ${userId}`);

        res.json({
            success: true,
            lists: lists,
            total: lists.length
        });

    } catch (err) {
        console.error('❌ Erro ao buscar listas:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// POST - Criar nova lista
app.post('/api/lists', async (req, res) => {
    try {
        const { name, emoji, color } = req.body;
        const userId = req.body.user_id || req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Nome da lista é obrigatório'
            });
        }

        // Buscar última posição
        const lastPosition = await db.get(
            "SELECT MAX(position) as max_pos FROM lists WHERE user_id = ?",
            [userId]
        );

        const newPosition = (lastPosition?.max_pos || 0) + 1;

        let info;

        if (db.isPostgres) {
            const result = await db.query(
                `INSERT INTO lists (user_id, name, emoji, color, position)
                 VALUES (?, ?, ?, ?, ?) RETURNING id`,
                [userId, name, emoji || '📋', color || '#146551', newPosition]
            );
            info = { lastInsertRowid: result[0].id };
        } else {
            info = await db.run(
                `INSERT INTO lists (user_id, name, emoji, color, position)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, name, emoji || '📋', color || '#146551', newPosition]
            );
        }

        console.log(`✅ Lista "${name}" criada para usuário ${userId}`);

        res.json({
            success: true,
            message: 'Lista criada com sucesso!',
            listId: info.lastInsertRowid
        });

    } catch (err) {
        console.error('❌ Erro ao criar lista:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar lista'
        });
    }
});

// PUT - Atualizar lista
app.put('/api/lists/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, emoji, color, position } = req.body;
        const userId = req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (emoji !== undefined) {
            updates.push('emoji = ?');
            values.push(emoji);
        }
        if (color !== undefined) {
            updates.push('color = ?');
            values.push(color);
        }
        if (position !== undefined) {
            updates.push('position = ?');
            values.push(position);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum campo para atualizar'
            });
        }

        values.push(id);
        values.push(userId);

        const sql = `UPDATE lists SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
        await db.run(sql, values);

        console.log(`✅ Lista ${id} atualizada`);

        res.json({
            success: true,
            message: 'Lista atualizada com sucesso!'
        });

    } catch (err) {
        console.error('❌ Erro ao atualizar lista:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar lista'
        });
    }
});

// DELETE - Excluir lista
app.delete('/api/lists/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }

        // Verificar se a lista existe
        const list = await db.get(
            "SELECT * FROM lists WHERE id = ? AND user_id = ?",
            [id, userId]
        );

        if (!list) {
            return res.status(404).json({
                success: false,
                error: 'Lista não encontrada'
            });
        }

        // Não permitir excluir lista padrão
        if (list.is_default) {
            return res.status(400).json({
                success: false,
                error: 'Não é possível excluir a lista padrão'
            });
        }

        // Remover list_id das tarefas associadas
        await db.run(
            "UPDATE tasks SET list_id = NULL WHERE list_id = ?",
            [id]
        );

        // Excluir lista
        await db.run(
            "DELETE FROM lists WHERE id = ? AND user_id = ?",
            [id, userId]
        );

        console.log(`✅ Lista "${list.name}" excluída`);

        res.json({
            success: true,
            message: 'Lista excluída com sucesso!'
        });

    } catch (err) {
        console.error('❌ Erro ao excluir lista:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao excluir lista'
        });
    }
});

// GET - Buscar tarefas de uma lista específica
app.get('/api/lists/:id/tasks', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.user_id || req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não identificado'
            });
        }

        const tasks = await db.query(
            "SELECT * FROM tasks WHERE list_id = ? AND user_id = ? ORDER BY created_at DESC",
            [id, userId]
        );

        console.log(`📋 ${tasks.length} tarefas da lista ${id}`);

        res.json({
            success: true,
            tasks: tasks,
            total: tasks.length
        });

    } catch (err) {
        console.error('❌ Erro ao buscar tarefas da lista:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ===== API - GERENCIAMENTO DE SEÇÕES =====

// GET - Listar seções do usuário
app.get('/api/sections', async (req, res) => {
    try {
        const userId = req.query.user_id || req.headers['x-user-id'];
        if (!userId) return res.status(401).json({ success: false, error: 'Usuário não identificado' });

        const sections = await db.query(
            "SELECT * FROM sections WHERE user_id = ? ORDER BY position ASC",
            [userId]
        );

        res.json({ success: true, sections });
    } catch (err) {
        console.error('❌ Erro ao buscar seções:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST - Criar seção
app.post('/api/sections', async (req, res) => {
    try {
        const { name, emoji } = req.body;
        const userId = req.body.user_id || req.headers['x-user-id'];

        if (!userId) return res.status(401).json({ success: false, error: 'Usuário não identificado' });
        if (!name) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });

        const lastPos = await db.get("SELECT MAX(position) as max_pos FROM sections WHERE user_id = ?", [userId]);
        const position = (lastPos?.max_pos || 0) + 1;

        const result = await db.query(
            `INSERT INTO sections (user_id, name, emoji, position) VALUES (?, ?, ?, ?) RETURNING id`,
            [userId, name, emoji || '📁', position]
        );

        console.log(`✅ Seção "${name}" criada`);
        res.json({ success: true, sectionId: result[0].id });
    } catch (err) {
        console.error('❌ Erro ao criar seção:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT - Atualizar seção
app.put('/api/sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, emoji, position, is_collapsed } = req.body;
        const userId = req.body.user_id || req.headers['x-user-id'];

        if (!userId) return res.status(401).json({ success: false, error: 'Usuário não identificado' });

        const updates = [];
        const values = [];

        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (emoji !== undefined) { updates.push('emoji = ?'); values.push(emoji); }
        if (position !== undefined) { updates.push('position = ?'); values.push(position); }
        if (is_collapsed !== undefined) { updates.push('is_collapsed = ?'); values.push(is_collapsed); }

        if (updates.length === 0) return res.status(400).json({ success: false, error: 'Nada para atualizar' });

        values.push(id, userId);
        await db.run(`UPDATE sections SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, values);

        res.json({ success: true, message: 'Seção atualizada' });
    } catch (err) {
        console.error('❌ Erro ao atualizar seção:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE - Excluir seção
app.delete('/api/sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.query.user_id || req.headers['x-user-id'];

        if (!userId) return res.status(401).json({ success: false, error: 'Usuário não identificado' });

        // Move tarefas da seção para "sem seção"
        await db.run("UPDATE tasks SET section_id = NULL WHERE section_id = ?", [id]);
        await db.run("DELETE FROM sections WHERE id = ? AND user_id = ?", [id, userId]);

        res.json({ success: true, message: 'Seção excluída' });
    } catch (err) {
        console.error('❌ Erro ao excluir seção:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT - Mover tarefa para seção
app.put('/api/tasks/:id/move', async (req, res) => {
    try {
        const { id } = req.params;
        const { section_id, position } = req.body;
        const userId = req.body.user_id || req.headers['x-user-id'];

        if (!userId) return res.status(401).json({ success: false, error: 'Usuário não identificado' });

        await db.run(
            "UPDATE tasks SET section_id = ?, position = ? WHERE id = ? AND user_id = ?",
            [section_id, position || 0, id, userId]
        );

        console.log(`✅ Tarefa ${id} movida para seção ${section_id}`);
        res.json({ success: true, message: 'Tarefa movida' });
    } catch (err) {
        console.error('❌ Erro ao mover tarefa:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ===== API - GERENCIAMENTO DE USUÁRIOS =====

// PUT - Atualizar email de um usuário
app.put('/api/users/:userId/email', async (req, res) => {
    try {
        const { userId } = req.params;
        const { email } = req.body;
        const headerUserId = req.headers['x-user-id'];
        
        // Verifica se o usuário está atualizando seu próprio email (ou é admin)
        if (userId !== headerUserId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                error: 'Email inválido'
            });
        }
        
        // Verifica se o email já está em uso
        const existingUser = await db.get(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Este email já está em uso'
            });
        }
        
        // Atualiza o email
        const result = await db.run(
            'UPDATE users SET email = ? WHERE id = ?',
            [email, userId]
        );
        
        console.log(`✅ Email do usuário ${userId} atualizado para ${email}`);
        
        res.json({
            success: true,
            message: 'Email atualizado com sucesso'
        });
        
    } catch (err) {
        console.error('❌ Erro ao atualizar email:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar email'
        });
    }
});

// GET - Listar todos os usuários (útil para debug)
app.get('/api/users', async (req, res) => {
    try {
        const users = await db.query('SELECT id, name, email, telegram_chat_id FROM users');
        res.json({
            success: true,
            users
        });
    } catch (err) {
        console.error('❌ Erro ao listar usuários:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao listar usuários'
        });
    }
});

// PUT - Vincular Telegram ao usuário
app.put('/api/users/:userId/telegram', async (req, res) => {
    try {
        const { userId } = req.params;
        const { telegram_chat_id } = req.body;
        const headerUserId = req.headers['x-user-id'];

        // Verifica se o usuário está atualizando seu próprio Telegram
        if (userId !== headerUserId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        if (!telegram_chat_id) {
            return res.status(400).json({
                success: false,
                error: 'telegram_chat_id é obrigatório'
            });
        }

        // Verifica se o chat_id já está em uso por outro usuário
        const existingUser = await db.get(
            'SELECT id FROM users WHERE telegram_chat_id = ? AND id != ?',
            [telegram_chat_id, userId]
        );

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Este Telegram já está vinculado a outra conta'
            });
        }

        // Atualiza o telegram_chat_id
        const result = await db.run(
            'UPDATE users SET telegram_chat_id = ? WHERE id = ?',
            [telegram_chat_id, userId]
        );

        console.log(`✅ Telegram vinculado ao usuário ${userId}: ${telegram_chat_id}`);

        res.json({
            success: true,
            message: 'Telegram vinculado com sucesso!'
        });

    } catch (err) {
        console.error('❌ Erro ao vincular Telegram:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao vincular Telegram'
        });
    }
});

// DELETE - Desvincular Telegram do usuário
app.delete('/api/users/:userId/telegram', async (req, res) => {
    try {
        const { userId } = req.params;
        const headerUserId = req.headers['x-user-id'];

        if (userId !== headerUserId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        const result = await db.run(
            'UPDATE users SET telegram_chat_id = NULL WHERE id = ?',
            [userId]
        );

        console.log(`✅ Telegram desvinculado do usuário ${userId}`);

        res.json({
            success: true,
            message: 'Telegram desvinculado com sucesso'
        });

    } catch (err) {
        console.error('❌ Erro ao desvincular Telegram:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao desvincular Telegram'
        });
    }
});

// ===== WEBHOOK DO TELEGRAM =====
// Rota para receber updates do Telegram (produção)
app.post(`/telegram-webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
    const bot = getBot();
    if (bot) {
        bot.processUpdate(req.body);
    }
    res.sendStatus(200);
});

// ===== API - AUTENTICAÇÃO =====

// POST - Login do usuário
app.post("/api/login", async (req, res) => {
    console.log("🔐 Tentativa de login:", req.body);
    
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            error: "Usuário e senha são obrigatórios"
        });
    }
    
    try {
        // Busca por nome OU email
        const user = await db.get(
            `SELECT id, name, email FROM users 
             WHERE (name = ? OR email = ?) AND password = ?`,
            [username, username, password]
        );
        
        if (user) {
            console.log('✅ Login bem-sucedido:', user.name);
            res.json({
                success: true,
                message: "Login realizado com sucesso!",
                user: {
                    id: user.id,
                    username: user.name,
                    email: user.email
                }
            });
        } else {
            console.log('❌ Credenciais inválidas');
            res.status(401).json({
                success: false,
                error: "Usuário ou senha incorretos"
            });
        }
        
    } catch (err) {
        console.error('❌ Erro no login:', err);
        res.status(500).json({
            success: false,
            error: "Erro no servidor"
        });
    }
});

// ===== API - ENVIO DE EMAILS =====

// POST - Enviar resumo de teste para um usuário específico
app.post('/api/enviar-resumo-teste', async (req, res) => {
    try {
        const { user_id } = req.body;
        
        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: 'user_id é obrigatório'
            });
        }

        const user = await db.get(
            'SELECT id, name, email FROM users WHERE id = ?',
            [user_id]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        console.log(`📧 Enviando resumo de teste para ${user.name} (${user.email})...`);

        const result = await enviarResumoDiario(user.id, user.email, user.name);

        res.json({
            success: true,
            message: 'Email enviado com sucesso!',
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            ...result
        });

    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST - Enviar resumo para TODOS os usuários (usar com cuidado!)
app.post('/api/enviar-resumo-todos', async (req, res) => {
    try {
        console.log('📬 Solicitação para enviar resumo para todos os usuários...');
        
        const result = await enviarResumoParaTodos();

        res.json({
            success: true,
            message: 'Processo de envio concluído!',
            ...result
        });

    } catch (error) {
        console.error('❌ Erro ao enviar emails:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== API - GERAÇÃO DE ROTINA COM IA (GEMINI) =====

// POST - Gerar rotina inteligente baseada em descrição
app.post("/api/gerar-rotina", async (req, res) => {
    console.log("📥 Recebendo requisição para gerar rotina");
    console.log("📝 Body:", req.body);
    
    try {
        const { descricao, horaInicio = "08:00", horaFim = "18:00" } = req.body;

        if (!descricao) {
            console.log("❌ Descrição não fornecida");
            return res.status(400).json({ 
                success: false,
                error: "Descrição do dia é obrigatória" 
            });
        }

        if (!GEMINI_API_KEY) {
            console.log("❌ API Key não configurada");
            return res.status(500).json({ 
                success: false,
                error: "Chave da API Gemini não configurada no servidor" 
            });
        }

        console.log("🧠 Gerando rotina com Gemini para:", descricao);
        console.log("⏰ Período:", horaInicio, "às", horaFim);

        // Monta prompt para a IA
        const prompt = `
Com base nesta descrição: "${descricao}"

Entre os Horários: ${horaInicio} às ${horaFim}

Crie uma rotina organizada em português com horários específicos, intervalos (se for necessário)
uma rotina focada em produtividade e bem-estar.

Use emojis para destacar cada atividade.

caso a descrição seja escrita formalmente, adapte para um tom mais casual e profissional.
caso a descrição seja escrita de forma informal, adapte para um tom mais informal e amigável.

Evite longas explicações - vá direto ao ponto com atividades claras e objetivas neste exemplo de Formato:

🕗 08:00-09:00 → Atividade
🕘 09:00-09:15 → Intervalo

Apenas a rotina formatada, sem explicações.
`;

        // Usa Gemini 2.5 Flash (mais rápido e eficiente)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        console.log("⏳ Aguardando resposta do Gemini 2.5 Flash...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rotina = response.text();

        console.log("✅ Rotina gerada com sucesso!");
        console.log("📄 Tamanho da resposta:", rotina.length, "caracteres");

        res.json({ 
            success: true, 
            rotina,
            modeloUsado: "gemini-2.5-flash",
            descricaoOriginal: descricao,
            periodo: `${horaInicio} - ${horaFim}`,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error("💥 ERRO DETALHADO ao gerar rotina:");
        console.error("Tipo:", err.name);
        console.error("Mensagem:", err.message);
        console.error("Stack:", err.stack);
        
        let errorMessage = "Erro ao gerar rotina";
        
        // Identifica tipo de erro
        if (err.message?.includes("API key")) {
            errorMessage = "API Key do Gemini inválida ou não configurada";
        } else if (err.message?.includes("quota")) {
            errorMessage = "Limite de requisições da API Gemini excedido";
        } else if (err.message?.includes("model")) {
            errorMessage = "Modelo do Gemini não disponível";
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMessage,
            details: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== API - GERAR DESCRIÇÃO AUTOMÁTICA POR IA =====
app.post('/api/ai/generate-description', async (req, res) => {
    try {
        const { taskTitle, detailLevel = 'medio' } = req.body;

        if (!taskTitle || taskTitle.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Título da tarefa é obrigatório'
            });
        }

        console.log(`🤖 Gerando descrição IA para tarefa: "${taskTitle}" (Nível: ${detailLevel})`);

        // Define o nível de detalhamento
        let detailPrompt = '';
        switch(detailLevel) {
            case 'baixo':
                detailPrompt = 'Crie uma descrição MUITO BREVE (máximo 20 palavras) e direta.';
                break;
            case 'medio':
                detailPrompt = 'Crie uma descrição equilibrada (30-50 palavras) com contexto relevante.';
                break;
            case 'alto':
                detailPrompt = 'Crie uma descrição DETALHADA (60-100 palavras) com passos, contexto e objetivos.';
                break;
            default:
                detailPrompt = 'Crie uma descrição equilibrada (30-50 palavras) com contexto relevante.';
        }

        const prompt = `Você é um assistente de produtividade inteligente.

Tarefa: "${taskTitle}"

${detailPrompt}

A descrição deve:
- Explicar brevemente o que envolve essa tarefa
- Mencionar o objetivo ou resultado esperado
- Se aplicável, sugerir passos básicos ou considerações
- Ser profissional e clara
- Não usar emojis ou formatação especial

Responda APENAS com a descrição, sem introduções ou explicações adicionais.`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        console.log("⏳ Aguardando resposta do Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const description = response.text().trim();

        console.log("✅ Descrição gerada com sucesso!");

        res.json({
            success: true,
            description,
            taskTitle,
            detailLevel,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error("💥 ERRO ao gerar descrição:", err.message);

        let errorMessage = "Erro ao gerar descrição automática";

        if (err.message?.includes("API key")) {
            errorMessage = "API Key do Gemini inválida";
        } else if (err.message?.includes("quota")) {
            errorMessage = "Limite de requisições excedido";
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            details: err.message
        });
    }
});

// ===== API - CONFIGURAÇÕES DO USUÁRIO =====

// GET - Carregar configurações do usuário
app.get('/api/settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const headerUserId = req.headers['x-user-id'];
        
        // Verifica se o usuário está acessando suas próprias configurações
        if (userId !== headerUserId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }
        
        const settings = await db.get(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [userId]
        );
        
        if (settings) {
            // Formata nomes das colunas para camelCase
            const formattedSettings = {
                hideCompleted: settings.hide_completed,
                highlightUrgent: settings.highlight_urgent,
                autoSuggestions: settings.auto_suggestions,
                detailLevel: settings.detail_level,
                darkMode: settings.dark_mode,
                primaryColor: settings.primary_color,
                currentPlan: settings.current_plan,
                planRenewalDate: settings.plan_renewal_date,
                viewMode: settings.view_mode || 'lista',
                emailNotifications: settings.email_notifications !== false,
                weeklyReport: settings.weekly_report !== false,
                aiDescriptionsEnabled: settings.ai_descriptions_enabled !== false,
                aiDetailLevel: settings.ai_detail_level || 'medio',
                aiOptimizationEnabled: settings.ai_optimization_enabled !== false
            };
            
            res.json({
                success: true,
                settings: formattedSettings
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Configurações não encontradas'
            });
        }
    } catch (err) {
        console.error('❌ Erro ao carregar configurações:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar configurações'
        });
    }
});

// POST - Salvar ou atualizar TODAS as configurações
app.post('/api/settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { settings } = req.body;
        const headerUserId = req.headers['x-user-id'];

        console.log('📥 POST /api/settings/' + userId);
        console.log('Settings recebidos:', JSON.stringify(settings, null, 2));

        if (userId !== headerUserId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Configurações inválidas'
            });
        }

        // Verifica se já existe configuração para este usuário
        const existing = await db.get(
            'SELECT id FROM user_settings WHERE user_id = ?',
            [userId]
        );

        console.log('Registro existente:', existing ? 'Sim' : 'Não');
        
        if (existing) {
            // Atualiza configurações existentes
            // Converter booleanos para 0 ou 1 para SQLite
            const result = await db.run(
                `UPDATE user_settings SET
                    hide_completed = ?,
                    highlight_urgent = ?,
                    auto_suggestions = ?,
                    detail_level = ?,
                    dark_mode = ?,
                    primary_color = ?,
                    current_plan = ?,
                    plan_renewal_date = ?,
                    view_mode = ?,
                    email_notifications = ?,
                    weekly_report = ?,
                    ai_descriptions_enabled = ?,
                    ai_detail_level = ?,
                    ai_optimization_enabled = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?`,
                [
                    settings.hideCompleted ? 1 : 0,
                    settings.highlightUrgent !== false ? 1 : 0,
                    settings.autoSuggestions !== false ? 1 : 0,
                    settings.detailLevel || 'Médio',
                    settings.darkMode ? 1 : 0,
                    settings.primaryColor || '#49a09d',
                    settings.currentPlan || 'pro',
                    settings.planRenewalDate || '30 de dezembro de 2025',
                    settings.viewMode || 'lista',
                    settings.emailNotifications !== false ? 1 : 0,
                    settings.weeklyReport !== false ? 1 : 0,
                    settings.aiDescriptionsEnabled !== false ? 1 : 0,
                    settings.aiDetailLevel || 'medio',
                    settings.aiOptimizationEnabled !== false ? 1 : 0,
                    userId
                ]
            );

            console.log(`✅ Configurações atualizadas para usuário ${userId}`);
        } else {
            // Cria novas configurações
            // Converter booleanos para 0 ou 1 para SQLite
            const result = await db.run(
                `INSERT INTO user_settings
                (user_id, hide_completed, highlight_urgent, auto_suggestions, detail_level, dark_mode, primary_color, current_plan, plan_renewal_date, view_mode, email_notifications, weekly_report, ai_descriptions_enabled, ai_detail_level, ai_optimization_enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    settings.hideCompleted ? 1 : 0,
                    settings.highlightUrgent !== false ? 1 : 0,
                    settings.autoSuggestions !== false ? 1 : 0,
                    settings.detailLevel || 'Médio',
                    settings.darkMode ? 1 : 0,
                    settings.primaryColor || '#49a09d',
                    settings.currentPlan || 'pro',
                    settings.planRenewalDate || '30 de dezembro de 2025',
                    settings.viewMode || 'lista',
                    settings.emailNotifications !== false ? 1 : 0,
                    settings.weeklyReport !== false ? 1 : 0,
                    settings.aiDescriptionsEnabled !== false ? 1 : 0,
                    settings.aiDetailLevel || 'medio',
                    settings.aiOptimizationEnabled !== false ? 1 : 0
                ]
            );

            console.log(`✅ Configurações criadas para usuário ${userId}`);
        }
        
        res.json({
            success: true,
            message: 'Configurações salvas com sucesso'
        });
        
    } catch (err) {
        console.error('❌ Erro ao salvar configurações:', err);
        console.error('Detalhes do erro:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({
            success: false,
            error: 'Erro ao salvar configurações',
            details: err.message
        });
    }
});

// PUT - Atualizar UMA configuração específica
app.put('/api/settings/:userId/:setting', async (req, res) => {
    try {
        const { userId, setting } = req.params;
        const { value } = req.body;
        const headerUserId = req.headers['x-user-id'];
        
        if (userId !== headerUserId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }
        
        // Mapeia nomes frontend (camelCase) para backend (snake_case)
        const settingMap = {
            hideCompleted: 'hide_completed',
            highlightUrgent: 'highlight_urgent',
            autoSuggestions: 'auto_suggestions',
            detailLevel: 'detail_level',
            darkMode: 'dark_mode',
            primaryColor: 'primary_color',
            currentPlan: 'current_plan',
            planRenewalDate: 'plan_renewal_date',
            viewMode: 'view_mode',
            emailNotifications: 'email_notifications' // ✅ ADICIONADO
        };
        
        const dbSetting = settingMap[setting];
        
        if (!dbSetting) {
            return res.status(400).json({
                success: false,
                error: 'Configuração inválida'
            });
        }
        
        const sql = `UPDATE user_settings SET ${dbSetting} = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`;
        
        const result = await db.run(sql, [value, userId]);
        
        if (result.changes > 0) {
            console.log(`✅ ${setting} atualizado para ${value}`);
            res.json({
                success: true,
                message: `${setting} atualizado`
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
    } catch (err) {
        console.error('❌ Erro ao atualizar configuração:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar configuração'
        });
    }
});

// ===== CRON JOB - ENVIO AUTOMÁTICO DE EMAILS =====

// Agenda envio diário às 07:58 (horário de Brasília)
cron.schedule('58 7 * * *', async () => {
    console.log('\n⏰ ========================================');
    console.log('⏰ Executando envio de resumos diários');
    console.log('⏰ Horário: 07:58 (Brasília)');
    console.log('⏰ ========================================\n');
    
    try {
        await enviarResumoParaTodos();
    } catch (error) {
        console.error('❌ Erro no cron job:', error);
    }
}, {
    timezone: "America/Sao_Paulo"
});

console.log('⏰ Cron job configurado: Resumos diários às 07:58 (Horário de Brasília)');

// ===== CRON JOB - RELATÓRIOS SEMANAIS =====
// Toda segunda-feira às 08:00 (Horário de Brasília)
const weeklyReportService = require('./weeklyReportService');

cron.schedule('0 8 * * 1', async () => {
    console.log('📊 ========================================');
    console.log('📊 INICIANDO ENVIO DE RELATÓRIOS SEMANAIS');
    console.log('📊 ========================================');

    try {
        const result = await weeklyReportService.sendWeeklyReportsToAll();
        console.log(`✅ Relatórios enviados: ${result.sent}/${result.total}`);
    } catch (error) {
        console.error('❌ Erro no cron job de relatórios semanais:', error);
    }
}, {
    timezone: "America/Sao_Paulo"
});

console.log('⏰ Cron job configurado: Relatórios semanais às segundas 08:00 (Horário de Brasília)');
console.log('📧 Serviço de email: SendGrid');
console.log(`📨 Email remetente: ${process.env.SENDGRID_FROM_EMAIL || 'NÃO CONFIGURADO'}`);

// ===== API - RELATÓRIO SEMANAL COM IA =====

// GET - Debug: Verificar configuração de email
app.get('/api/weekly-report/debug/config', async (req, res) => {
    res.json({
        sendgrid_configured: !!process.env.SENDGRID_API_KEY,
        sendgrid_from_email: process.env.SENDGRID_FROM_EMAIL || 'NÃO CONFIGURADO',
        gemini_configured: !!process.env.GEMINI_API_KEY,
        database: db.isPostgres ? 'PostgreSQL' : 'SQLite'
    });
});

// GET - Gerar relatório semanal para um usuário específico
app.get('/api/weekly-report/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const headerUserId = req.headers['x-user-id'];

        if (userId !== headerUserId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        console.log(`📊 Gerando relatório semanal para usuário ${userId}...`);

        const report = await weeklyReportService.generateWeeklyReport(userId);

        if (report.success) {
            res.json(report);
        } else {
            res.status(500).json(report);
        }

    } catch (err) {
        console.error('❌ Erro ao gerar relatório:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar relatório semanal',
            details: err.message
        });
    }
});

// POST - Enviar relatórios semanais para todos os usuários
app.post('/api/weekly-report/send-all', async (req, res) => {
    try {
        console.log('📧 Iniciando envio de relatórios semanais para todos...');

        const result = await weeklyReportService.sendWeeklyReportsToAll();

        res.json(result);

    } catch (err) {
        console.error('❌ Erro ao enviar relatórios:', err);
        res.status(500).json({
            success: false,
            error: 'Erro ao enviar relatórios semanais',
            details: err.message
        });
    }
});

// ===== KEEP-ALIVE - Previne servidor de "dormir" no plano free =====
// Faz uma requisição a cada 14 minutos para manter o servidor ativo
setInterval(() => {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.RENDER_EXTERNAL_URL || `localhost:${PORT}`;
    
    fetch(`${protocol}://${host}/api/status`)
        .then(() => console.log('🔄 Keep-alive: Servidor ativo'))
        .catch(err => console.log('⚠️ Keep-alive falhou:', err.message));
}, 14 * 60 * 1000); // 14 minutos

console.log('🔄 Keep-alive ativado: Servidor não vai dormir');

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
    console.log(`\n🎉 ========================================`);
    console.log(`🎉 SERVIDOR NURA FUNCIONANDO!`);
    console.log(`🎉 ========================================`);
    console.log(`📍 URL Base: http://localhost:${PORT}`);
    console.log(`🔐 Login: http://localhost:${PORT}/login`);
    console.log(`🏠 Inicial: http://localhost:${PORT}/inicial`);
    console.log(`📊 Gerenciamento: http://localhost:${PORT}/gerenciamento`);
    console.log(`⚙️  Ajustes: http://localhost:${PORT}/ajustes`);
    console.log(`\n🔧 Configurações:`);
    console.log(`   🤖 Gemini: ${GEMINI_API_KEY ? "✅ Configurada" : "❌ Faltando"}`);
    console.log(`   💾 Banco: ${db.isPostgres ? "🐘 PostgreSQL (Produção)" : "💾 SQLite (Local)"}`);
    console.log(`   📧 SendGrid: ${process.env.SENDGRID_API_KEY ? "✅ Configurada" : "❌ Faltando"}`);
    console.log(`\n🔑 Login padrão: admin / admin123`);
    console.log(`\n✅ Rotas de API disponíveis:`);
    console.log(`   📊 Status:`);
    console.log(`      GET    /api/status              - Status do sistema`);
    console.log(`   📋 Tarefas:`);
    console.log(`      GET    /api/tasks               - Listar tarefas (por usuário)`);
    console.log(`      GET    /api/tasks/:id           - Buscar tarefa específica`);
    console.log(`      POST   /api/tasks               - Criar tarefa`);
    console.log(`      PUT    /api/tasks/:id           - Atualizar tarefa`);
    console.log(`      DELETE /api/tasks/:id           - Excluir tarefa`);
    console.log(`   🔐 Autenticação:`);
    console.log(`      POST   /api/login               - Login do usuário`);
    console.log(`   🤖 IA:`);
    console.log(`      POST   /api/gerar-rotina        - Gerar rotina com Gemini`);
    console.log(`   📧 Email:`);
    console.log(`      POST   /api/enviar-resumo-teste - Enviar resumo para 1 usuário`);
    console.log(`      POST   /api/enviar-resumo-todos - Enviar resumo para todos`);
    console.log(`   ⚙️  Configurações:`);
    console.log(`      GET    /api/settings/:userId    - Carregar configurações`);
    console.log(`      POST   /api/settings/:userId    - Salvar configurações`);
    console.log(`      PUT    /api/settings/:userId/:setting - Atualizar configuração`);
    console.log(`\n👥 Sistema multiusuário ATIVO!`);
    console.log(`========================================\n`);
});