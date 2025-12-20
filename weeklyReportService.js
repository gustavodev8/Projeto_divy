// ===== SERVIÇO DE RELATÓRIO SEMANAL COM IA =====
// Analisa produtividade da semana e gera insights com Gemini AI

const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Busca tarefas da última semana para um usuário
 */
async function getWeeklyTasks(userId) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    console.log(`🔍 Buscando tarefas para userId=${userId} desde ${oneWeekAgoStr}`);

    const tasks = await db.query(
        `SELECT * FROM tasks
         WHERE user_id = $1
         AND created_at >= $2
         ORDER BY created_at DESC`,
        [userId, oneWeekAgoStr]
    );

    console.log(`📊 Encontradas ${tasks.length} tarefas`);

    if (tasks.length > 0) {
        console.log('🔍 Primeira tarefa de exemplo:', {
            name: tasks[0].name,
            status: tasks[0].status,
            priority: tasks[0].priority,
            created_at: tasks[0].created_at
        });
    }

    return tasks;
}

/**
 * Calcula estatísticas da semana
 */
function calculateWeeklyStats(tasks) {
    console.log('📊 Calculando estatísticas...');
    console.log(`   Total de tarefas recebidas: ${tasks.length}`);

    const total = tasks.length;

    // Aceitar status em português E inglês
    const completed = tasks.filter(t =>
        t.status === 'concluido' || t.status === 'completed' || t.status === 'done'
    ).length;

    const inProgress = tasks.filter(t =>
        t.status === 'progresso' || t.status === 'in_progress' || t.status === 'in-progress'
    ).length;

    const pending = tasks.filter(t =>
        t.status === 'pendente' || t.status === 'pending' || t.status === 'todo'
    ).length;

    console.log(`   Status - Concluídas: ${completed}, Progresso: ${inProgress}, Pendentes: ${pending}`);

    // Debug: verificar quais valores de status e priority existem
    const statusValues = [...new Set(tasks.map(t => t.status))];
    console.log(`   ⚠️ Valores de STATUS encontrados no banco: "${statusValues.join('", "')}"`);

    const priorityValues = [...new Set(tasks.map(t => t.priority))];
    console.log(`   Valores de priority encontrados: ${priorityValues.join(', ')}`);

    const highPriority = tasks.filter(t => t.priority === 'high').length;
    const mediumPriority = tasks.filter(t => t.priority === 'medium').length;
    const lowPriority = tasks.filter(t => t.priority === 'low').length;

    console.log(`   Prioridades - Alta: ${highPriority}, Média: ${mediumPriority}, Baixa: ${lowPriority}`);

    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    // Tarefas atrasadas (due_date passou e não está concluída)
    const now = new Date();
    const overdue = tasks.filter(t =>
        t.due_date &&
        new Date(t.due_date) < now &&
        t.status !== 'concluido' &&
        t.status !== 'completed' &&
        t.status !== 'done'
    ).length;

    return {
        total,
        completed,
        inProgress,
        pending,
        highPriority,
        mediumPriority,
        lowPriority,
        completionRate,
        overdue
    };
}

/**
 * Gera análise com IA usando Gemini
 */
async function generateAIAnalysis(stats, tasks) {
    try {
        const prompt = `Você é um coach de produtividade especializado em análise de tarefas.

**DADOS DA SEMANA:**

Total de tarefas: ${stats.total}
Concluídas: ${stats.completed} (${stats.completionRate}%)
Em progresso: ${stats.inProgress}
Pendentes: ${stats.pending}
Atrasadas: ${stats.overdue}

Prioridades:
- Alta: ${stats.highPriority}
- Média: ${stats.mediumPriority}
- Baixa: ${stats.lowPriority}

**TAREFAS DA SEMANA:**
${tasks.slice(0, 10).map((t, i) =>
    `${i + 1}. ${t.name || t.title || t.description || 'Sem título'} - ${t.status} (Prioridade: ${t.priority})`
).join('\n')}

**SUA MISSÃO:**

Analise esses dados e forneça um relatório estruturado com:

1. **📊 Resumo da Semana** (2-3 linhas sobre o desempenho geral)

2. **✅ Pontos Positivos** (2-3 conquistas ou comportamentos bons)

3. **⚠️ Pontos de Atenção** (2-3 áreas que precisam melhorar)

4. **💡 Sugestões Práticas** (3-4 ações concretas para a próxima semana)

5. **🎯 Meta para Próxima Semana** (1 meta específica e mensurável)

**IMPORTANTE:**
- Seja direto e objetivo
- Use tom motivador mas realista
- Baseie-se apenas nos dados fornecidos
- Formate em texto simples (sem markdown)
- Use emojis para melhor visualização`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const analysis = response.text();

        console.log('✅ Análise de IA gerada com sucesso');
        return analysis;

    } catch (error) {
        console.error('❌ Erro ao gerar análise com IA:', error.message);
        return null;
    }
}

/**
 * Gera relatório semanal completo para um usuário
 */
async function generateWeeklyReport(userId) {
    try {
        console.log(`📊 Gerando relatório semanal para usuário ${userId}...`);

        // 1. Buscar tarefas da semana
        const tasks = await getWeeklyTasks(userId);

        if (tasks.length === 0) {
            return {
                success: true,
                message: 'Nenhuma tarefa encontrada na última semana',
                stats: {
                    total: 0,
                    completed: 0,
                    completionRate: 0
                },
                analysis: 'Você não criou tarefas nesta semana. Que tal começar a planejar suas atividades? 📝'
            };
        }

        // 2. Calcular estatísticas
        const stats = calculateWeeklyStats(tasks);

        // 3. Gerar análise com IA
        const analysis = await generateAIAnalysis(stats, tasks);

        return {
            success: true,
            stats,
            analysis,
            tasksCount: tasks.length,
            generatedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Erro ao gerar relatório semanal:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Envia relatório para todos os usuários que têm a opção ativada
 */
async function sendWeeklyReportsToAll() {
    try {
        console.log('📧 Iniciando envio de relatórios semanais...');

        // Buscar usuários com weekly_report ativado
        const users = await db.query(`
            SELECT u.id, u.name, u.email, u.telegram_chat_id
            FROM users u
            LEFT JOIN user_settings us ON u.id = us.user_id
            WHERE us.weekly_report = TRUE OR us.weekly_report IS NULL
        `);

        console.log(`👥 Encontrados ${users.length} usuários com relatório ativado`);

        let successCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                const report = await generateWeeklyReport(user.id);

                if (report.success) {
                    // Formatar mensagem
                    const message = `
🗓️ RELATÓRIO SEMANAL - ${new Date().toLocaleDateString('pt-BR')}

Olá ${user.name}! 👋

${report.analysis}

━━━━━━━━━━━━━━━━━━━━━
📊 ESTATÍSTICAS DA SEMANA:
━━━━━━━━━━━━━━━━━━━━━

✅ Concluídas: ${report.stats.completed}/${report.stats.total}
📈 Taxa de conclusão: ${report.stats.completionRate}%
🚧 Em progresso: ${report.stats.inProgress}
⏳ Pendentes: ${report.stats.pending}
⚠️ Atrasadas: ${report.stats.overdue}

Continue assim! 💪

---
NURA - Seu assistente de produtividade
                    `.trim();

                    // Enviar por email (se usuário tiver email cadastrado)
                    if (user.email) {
                        try {
                            const { enviarEmail } = require('./emailService');
                            await enviarEmail(
                                user.email,
                                '📊 Seu Relatório Semanal - NURA',
                                message
                            );
                            console.log(`📧 Email enviado para ${user.email}`);
                        } catch (emailError) {
                            console.error(`❌ Erro ao enviar email para ${user.email}:`, emailError.message);
                        }
                    } else {
                        console.log(`⚠️ Usuário ${user.name} não tem email cadastrado`);
                    }

                    // Enviar por Telegram (se disponível)
                    if (user.telegram_chat_id) {
                        try {
                            const { getBot } = require('./telegramService');
                            const bot = getBot();
                            if (bot) {
                                await bot.sendMessage(user.telegram_chat_id, message);
                                console.log(`📱 Telegram enviado para chat ${user.telegram_chat_id}`);
                            }
                        } catch (telegramError) {
                            console.error(`❌ Erro ao enviar Telegram:`, telegramError.message);
                        }
                    }

                    successCount++;
                } else {
                    errorCount++;
                }

            } catch (userError) {
                console.error(`❌ Erro ao processar usuário ${user.id}:`, userError.message);
                errorCount++;
            }
        }

        console.log(`✅ Relatórios enviados: ${successCount} sucesso, ${errorCount} erros`);

        return {
            success: true,
            sent: successCount,
            errors: errorCount,
            total: users.length
        };

    } catch (error) {
        console.error('❌ Erro ao enviar relatórios semanais:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    generateWeeklyReport,
    sendWeeklyReportsToAll,
    getWeeklyTasks,
    calculateWeeklyStats
};
