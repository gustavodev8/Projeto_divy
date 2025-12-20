// ===== SERVIÇO DE NOTIFICAÇÕES VIA TELEGRAM =====
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const cron = require('node-cron');

// Configurar bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

// Armazena os intervalos de notificações aleatórias por usuário
const notificationIntervals = new Map();

/**
 * Inicializa o bot do Telegram
 */
function inicializarBot() {
    if (!TELEGRAM_TOKEN) {
        console.log('⚠️ TELEGRAM_BOT_TOKEN não configurado - Bot do Telegram desativado');
        return null;
    }

    try {
        bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
        console.log('✅ Bot do Telegram inicializado com sucesso!');

        configurarComandos();
        iniciarNotificacoesAleatorias();

        return bot;
    } catch (error) {
        console.error('❌ Erro ao inicializar bot do Telegram:', error);
        return null;
    }
}

/**
 * Configura todos os comandos do bot
 */
function configurarComandos() {
    // Comando /start - Primeiro contato
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name;

        const welcomeMessage = `
👋 Olá, ${firstName}! Bem-vindo ao *Nura Task Bot*!

Sou seu assistente de tarefas no Telegram.

🔗 *Como conectar sua conta:*
1. Acesse o sistema Nura no navegador
2. Vá em "Ajustes" ou "Configurações"
3. Cole este código: \`${chatId}\`
4. Pronto! Você receberá lembretes aqui

📋 *Comandos disponíveis:*
/minhastarefas - Ver suas tarefas pendentes
/urgentes - Ver apenas tarefas urgentes
/resumo - Resumo geral das suas tarefas
/ajuda - Ver esta mensagem novamente

🔔 Você receberá notificações aleatórias durante o dia lembrando das suas tarefas!
        `;

        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Comando /ajuda ou /help
    bot.onText(/\/(ajuda|help)/, async (msg) => {
        const chatId = msg.chat.id;

        const helpMessage = `
📚 *COMANDOS DISPONÍVEIS*

/minhastarefas - Lista todas suas tarefas pendentes
/urgentes - Mostra apenas tarefas urgentes
/resumo - Resumo estatístico das suas tarefas
/vincular - Mostra seu código de vinculação
/ajuda - Exibe esta mensagem

💡 *Dicas:*
- Mantenha suas notificações ativadas
- Você receberá lembretes em horários variados
- Gerencie suas tarefas pelo site Nura
        `;

        await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // Comando /vincular - Mostra o chat ID
    bot.onText(/\/vincular/, async (msg) => {
        const chatId = msg.chat.id;

        const linkMessage = `
🔗 *Código de Vinculação*

Seu código: \`${chatId}\`

📝 *Como usar:*
1. Copie o código acima
2. Acesse Nura no navegador
3. Vá em Ajustes/Configurações
4. Cole o código no campo "Telegram"
5. Salve as configurações

✅ Após vincular, você receberá notificações automáticas!
        `;

        await bot.sendMessage(chatId, linkMessage, { parse_mode: 'Markdown' });
    });

    // Comando /minhastarefas - Lista tarefas
    bot.onText(/\/minhastarefas/, async (msg) => {
        const chatId = msg.chat.id;
        await enviarListaTarefas(chatId);
    });

    // Comando /urgentes - Tarefas urgentes
    bot.onText(/\/urgentes/, async (msg) => {
        const chatId = msg.chat.id;
        await enviarTarefasUrgentes(chatId);
    });

    // Comando /resumo - Estatísticas
    bot.onText(/\/resumo/, async (msg) => {
        const chatId = msg.chat.id;
        await enviarResumo(chatId);
    });

    console.log('✅ Comandos do bot configurados');
}

/**
 * Busca usuário pelo chat_id do Telegram
 */
async function buscarUsuarioPorChatId(chatId) {
    try {
        const user = await db.get(
            'SELECT id, name, email FROM users WHERE telegram_chat_id = ?',
            [chatId.toString()]
        );
        return user;
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        return null;
    }
}

/**
 * Envia lista de tarefas para o usuário
 */
async function enviarListaTarefas(chatId) {
    try {
        const user = await buscarUsuarioPorChatId(chatId);

        if (!user) {
            await bot.sendMessage(chatId,
                '❌ Conta não vinculada!\n\nUse /vincular para obter seu código de vinculação.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const tasks = await db.query(
            "SELECT * FROM tasks WHERE user_id = ? AND status != 'completed' ORDER BY priority DESC, created_at ASC",
            [user.id]
        );

        if (tasks.length === 0) {
            await bot.sendMessage(chatId,
                '✅ Parabéns! Você não tem tarefas pendentes! 🎉',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        let message = `📋 *Suas Tarefas (${tasks.length})*\n\n`;

        tasks.forEach((task, index) => {
            const emoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
            message += `${emoji} *${index + 1}.* ${task.title}\n`;
            if (task.description) {
                message += `   _${task.description}_\n`;
            }
            message += '\n';
        });

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Erro ao enviar lista de tarefas:', error);
        await bot.sendMessage(chatId, '❌ Erro ao buscar suas tarefas. Tente novamente.');
    }
}

/**
 * Envia apenas tarefas urgentes
 */
async function enviarTarefasUrgentes(chatId) {
    try {
        const user = await buscarUsuarioPorChatId(chatId);

        if (!user) {
            await bot.sendMessage(chatId,
                '❌ Conta não vinculada! Use /vincular'
            );
            return;
        }

        const tasks = await db.query(
            "SELECT * FROM tasks WHERE user_id = ? AND status != 'completed' AND priority = 'high' ORDER BY created_at ASC",
            [user.id]
        );

        if (tasks.length === 0) {
            await bot.sendMessage(chatId,
                '✅ Você não tem tarefas urgentes no momento!'
            );
            return;
        }

        let message = `🔴 *Tarefas Urgentes (${tasks.length})*\n\n`;

        tasks.forEach((task, index) => {
            message += `*${index + 1}.* ${task.title}\n`;
            if (task.description) {
                message += `   _${task.description}_\n`;
            }
            message += '\n';
        });

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Erro ao enviar tarefas urgentes:', error);
        await bot.sendMessage(chatId, '❌ Erro ao buscar tarefas urgentes.');
    }
}

/**
 * Envia resumo estatístico
 */
async function enviarResumo(chatId) {
    try {
        const user = await buscarUsuarioPorChatId(chatId);

        if (!user) {
            await bot.sendMessage(chatId, '❌ Conta não vinculada! Use /vincular');
            return;
        }

        const tasks = await db.query(
            "SELECT * FROM tasks WHERE user_id = ? AND status != 'completed'",
            [user.id]
        );

        const urgentes = tasks.filter(t => t.priority === 'high').length;
        const medias = tasks.filter(t => t.priority === 'medium').length;
        const baixas = tasks.filter(t => t.priority === 'low').length;

        const message = `
📊 *Resumo de Tarefas*

👤 Usuário: ${user.name}

📋 Total Pendente: *${tasks.length}*
🔴 Urgentes: ${urgentes}
🟡 Médias: ${medias}
🟢 Baixas: ${baixas}

${tasks.length > 0 ? '💪 Continue assim! Foco nas urgentes primeiro!' : '🎉 Tudo em dia!'}
        `;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('Erro ao enviar resumo:', error);
        await bot.sendMessage(chatId, '❌ Erro ao gerar resumo.');
    }
}

/**
 * Envia notificação aleatória motivacional
 */
async function enviarNotificacaoAleatoria(chatId, userName) {
    try {
        const tasks = await db.query(
            `SELECT * FROM tasks
             WHERE user_id = (SELECT id FROM users WHERE telegram_chat_id = ?)
             AND status != 'completed'
             ORDER BY priority DESC`,
            [chatId.toString()]
        );

        if (tasks.length === 0) {
            return; // Não envia se não tem tarefas
        }

        const urgentes = tasks.filter(t => t.priority === 'high').length;

        // Mensagens motivacionais variadas
        const mensagens = [
            `👋 Olá ${userName}!\n\n📋 Você tem *${tasks.length}* tarefa${tasks.length > 1 ? 's' : ''} pendente${tasks.length > 1 ? 's' : ''}!\n${urgentes > 0 ? `🔴 *${urgentes}* urgente${urgentes > 1 ? 's' : ''}!` : ''}\n\n💪 Que tal dar uma olhada?`,

            `⏰ Lembrete, ${userName}!\n\n${urgentes > 0 ? `🔴 Você tem ${urgentes} tarefa${urgentes > 1 ? 's urgentes' : ' urgente'} esperando!\n\n` : ''}📌 Total: ${tasks.length} tarefa${tasks.length > 1 ? 's' : ''}\n\n🚀 Pequenos passos fazem grandes mudanças!`,

            `🎯 Foco, ${userName}!\n\n📊 Status atual:\n${urgentes > 0 ? `🔴 ${urgentes} urgente${urgentes > 1 ? 's' : ''}\n` : ''}📋 ${tasks.length} pendente${tasks.length > 1 ? 's' : ''}\n\n✨ Um passo de cada vez!`,

            `💡 Ei, ${userName}!\n\n${urgentes > 0 ? `🚨 Atenção! ${urgentes} tarefa${urgentes > 1 ? 's urgentes' : ' urgente'} precisa${urgentes === 1 ? '' : 'm'} de você!\n\n` : ''}📝 Que tal marcar uma como concluída agora?`,

            `⭐ Oi ${userName}!\n\n📋 Suas ${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} te espera${tasks.length === 1 ? '' : 'm'}!\n\n🎯 Produtividade é fazer um pouco todo dia!`
        ];

        const mensagemAleatoria = mensagens[Math.floor(Math.random() * mensagens.length)];

        await bot.sendMessage(chatId, mensagemAleatoria, { parse_mode: 'Markdown' });
        console.log(`🔔 Notificação aleatória enviada para ${userName}`);

    } catch (error) {
        console.error('Erro ao enviar notificação aleatória:', error);
    }
}

/**
 * Inicia sistema de notificações aleatórias
 * Envia lembretes em horários variados durante o dia
 */
function iniciarNotificacoesAleatorias() {
    // Executa a cada hora (das 8h às 20h) para decidir se envia notificação
    cron.schedule('0 8-20 * * *', async () => {
        console.log('🔔 Verificando se deve enviar notificações aleatórias...');

        try {
            // Busca usuários com Telegram vinculado
            const users = await db.query(
                'SELECT id, name, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL'
            );

            for (const user of users) {
                // Chance de 40% de enviar notificação a cada hora
                if (Math.random() < 0.4) {
                    // Aguarda tempo aleatório (0 a 50 minutos) antes de enviar
                    const delayMinutos = Math.floor(Math.random() * 50);

                    setTimeout(async () => {
                        await enviarNotificacaoAleatoria(user.telegram_chat_id, user.name);
                    }, delayMinutos * 60 * 1000);

                    console.log(`⏰ Notificação agendada para ${user.name} em ${delayMinutos} minutos`);
                }
            }

        } catch (error) {
            console.error('Erro ao processar notificações aleatórias:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });

    console.log('🔔 Sistema de notificações aleatórias ativado (8h-20h, horário de Brasília)');
}

/**
 * Envia notificação quando uma nova tarefa urgente é criada
 */
async function notificarNovaTarefaUrgente(userId, taskTitle) {
    try {
        const user = await db.get(
            'SELECT name, telegram_chat_id FROM users WHERE id = ?',
            [userId]
        );

        if (!user || !user.telegram_chat_id) {
            return; // Usuário sem Telegram vinculado
        }

        const message = `
🚨 *Nova Tarefa Urgente!*

📋 ${taskTitle}

⚡ Esta tarefa foi marcada como URGENTE!
🎯 Dê prioridade a ela!
        `;

        await bot.sendMessage(user.telegram_chat_id, message, { parse_mode: 'Markdown' });
        console.log(`🚨 Notificação de tarefa urgente enviada para ${user.name}`);

    } catch (error) {
        console.error('Erro ao notificar tarefa urgente:', error);
    }
}

/**
 * Envia resumo matinal (complementar ao email)
 */
async function enviarResumoMatinal(userId, chatId) {
    try {
        const user = await db.get('SELECT name FROM users WHERE id = ?', [userId]);
        const tasks = await db.query(
            "SELECT * FROM tasks WHERE user_id = ? AND status != 'completed' ORDER BY priority DESC",
            [userId]
        );

        if (tasks.length === 0) {
            await bot.sendMessage(chatId,
                `☀️ Bom dia, ${user.name}!\n\n✅ Você não tem tarefas pendentes!\n🎉 Aproveite seu dia!`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const urgentes = tasks.filter(t => t.priority === 'high').length;
        const medias = tasks.filter(t => t.priority === 'medium').length;

        let message = `☀️ *Bom dia, ${user.name}!*\n\n`;
        message += `📊 Seu dia:\n`;
        message += `📋 ${tasks.length} tarefa${tasks.length > 1 ? 's' : ''}\n`;
        if (urgentes > 0) message += `🔴 ${urgentes} urgente${urgentes > 1 ? 's' : ''}\n`;
        if (medias > 0) message += `🟡 ${medias} média${medias > 1 ? 's' : ''}\n`;
        message += `\n💪 Vamos começar bem o dia!`;

        if (urgentes > 0) {
            message += `\n\n🎯 *Priorize estas urgentes:*\n`;
            tasks.filter(t => t.priority === 'high').slice(0, 3).forEach((task, i) => {
                message += `${i + 1}. ${task.title}\n`;
            });
        }

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log(`☀️ Resumo matinal enviado para ${user.name}`);

    } catch (error) {
        console.error('Erro ao enviar resumo matinal:', error);
    }
}

module.exports = {
    inicializarBot,
    enviarNotificacaoAleatoria,
    enviarListaTarefas,
    enviarTarefasUrgentes,
    enviarResumo,
    notificarNovaTarefaUrgente,
    enviarResumoMatinal
};
