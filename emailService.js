// ===== SERVIÇO DE ENVIO DE EMAILS (RESEND) =====
const db = require('./database');

// Configuração Resend (API HTTP - funciona no Render, grátis para sempre)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const EMAIL_NAME = process.env.EMAIL_NAME || 'DIVY - Sistema de Tarefas';

// Função para enviar email via Resend
async function sendEmail(to, subject, html, text) {
    if (!RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY não configurada');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: `${EMAIL_NAME} <${EMAIL_FROM}>`,
            to: [to],
            subject: subject,
            html: html,
            text: text
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('❌ Erro Resend:', data);
        throw new Error(data.message || 'Erro ao enviar email via Resend');
    }

    return { success: true, id: data.id };
}

// Debug: mostrar configurações ao iniciar
console.log('📧 ===== CONFIGURAÇÃO DE EMAIL (RESEND) =====');
console.log(`   RESEND_API_KEY: ${RESEND_API_KEY ? '✅ Configurada' : '❌ NÃO configurada'}`);
console.log(`   EMAIL_FROM: ${EMAIL_FROM}`);
console.log(`   EMAIL_NAME: ${EMAIL_NAME}`);
console.log('=============================================');

/**
 * Envia resumo diário para um usuário específico
 * @param {number} userId - ID do usuário
 * @param {string} userEmail - Email do usuário
 * @param {string} userName - Nome do usuário
 * @returns {Object} Resultado do envio
 */
async function enviarResumoDiario(userId, userEmail, userName) {
    try {
        console.log(`📧 Preparando email para ${userName} (${userEmail})...`);

        // Buscar tarefas pendentes do usuário
        const tasks = await db.query(
            "SELECT * FROM tasks WHERE user_id = ? AND status != 'completed' ORDER BY priority DESC, created_at ASC",
            [userId]
        );
+
        console.log(`📋 ${tasks.length} tarefas pendentes encontradas`);

        // Se não tiver tarefas pendentes, não envia
        if (tasks.length === 0) {
            console.log(`ℹ️ Usuário ${userName} não tem tarefas pendentes`);
            return {
                sent: false,
                reason: 'Sem tarefas pendentes',
                taskCount: 0
            };
        }

        // Separar tarefas por prioridade
        const urgentes = tasks.filter(t => t.priority === 'high');
        const medias = tasks.filter(t => t.priority === 'medium');
        const baixas = tasks.filter(t => t.priority === 'low');

        // Montar HTML do email
        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seu Resumo Diário - Nura</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #49a09d 0%, #5f9ea0 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #333;
        }
        .summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
        }
        .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .summary-item:last-child {
            border-bottom: none;
        }
        .summary-label {
            font-weight: 600;
            color: #555;
        }
        .summary-value {
            font-weight: 700;
            color: #49a09d;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 15px;
            color: #333;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .task {
            background: #fff;
            border-left: 4px solid #ddd;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .task.urgent {
            border-left-color: #e74c3c;
            background: #fef5f5;
        }
        .task.medium {
            border-left-color: #f39c12;
            background: #fefaf5;
        }
        .task.low {
            border-left-color: #27ae60;
            background: #f5fef8;
        }
        .task-title {
            font-weight: 600;
            font-size: 16px;
            color: #333;
            margin-bottom: 5px;
        }
        .task-desc {
            font-size: 14px;
            color: #666;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background: #49a09d;
            color: white;
            padding: 12px 30px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
            margin-left: 8px;
        }
        .badge.urgent {
            background: #e74c3c;
            color: white;
        }
        .badge.medium {
            background: #f39c12;
            color: white;
        }
        .badge.low {
            background: #27ae60;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Seu Resumo Diário</h1>
            <p>Sistema de Gerenciamento de Tarefas Nura</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Olá, <strong>${userName}</strong>! 👋
            </div>
            
            <div class="summary">
                <div class="summary-item">
                    <span class="summary-label">📊 Total de Tarefas Pendentes:</span>
                    <span class="summary-value">${tasks.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">🔴 Urgentes:</span>
                    <span class="summary-value">${urgentes.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">🟡 Médias:</span>
                    <span class="summary-value">${medias.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">🟢 Baixas:</span>
                    <span class="summary-value">${baixas.length}</span>
                </div>
            </div>

            ${urgentes.length > 0 ? `
            <div class="section">
                <div class="section-title">🔴 Tarefas Urgentes</div>
                ${urgentes.map(task => `
                    <div class="task urgent">
                        <div class="task-title">${task.title}<span class="badge urgent">URGENTE</span></div>
                        ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${medias.length > 0 ? `
            <div class="section">
                <div class="section-title">🟡 Tarefas Médias</div>
                ${medias.slice(0, 5).map(task => `
                    <div class="task medium">
                        <div class="task-title">${task.title}<span class="badge medium">MÉDIA</span></div>
                        ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    </div>
                `).join('')}
                ${medias.length > 5 ? `<p style="text-align: center; color: #666;">E mais ${medias.length - 5} tarefas...</p>` : ''}
            </div>
            ` : ''}

            ${baixas.length > 0 ? `
            <div class="section">
                <div class="section-title">🟢 Tarefas de Baixa Prioridade</div>
                ${baixas.slice(0, 3).map(task => `
                    <div class="task low">
                        <div class="task-title">${task.title}<span class="badge low">BAIXA</span></div>
                        ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                    </div>
                `).join('')}
                ${baixas.length > 3 ? `<p style="text-align: center; color: #666;">E mais ${baixas.length - 3} tarefas...</p>` : ''}
            </div>
            ` : ''}

            <div style="text-align: center;">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/inicial" class="button">
                    Acessar Sistema Nura
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>💡 <strong>Dica:</strong> Priorize as tarefas urgentes para manter sua produtividade em alta!</p>
            <p style="margin-top: 15px; font-size: 12px;">
                Este é um email automático enviado pelo sistema Nura.<br>
                Você está recebendo porque tem tarefas pendentes no sistema.
            </p>
        </div>
    </div>
</body>
</html>
        `;

        // Versão texto (fallback)
        const textContent = `
Olá, ${userName}!

📋 SEU RESUMO DIÁRIO - NURA

Total de Tarefas Pendentes: ${tasks.length}
🔴 Urgentes: ${urgentes.length}
🟡 Médias: ${medias.length}
🟢 Baixas: ${baixas.length}

${urgentes.length > 0 ? `
🔴 TAREFAS URGENTES:
${urgentes.map(t => `- ${t.title}`).join('\n')}
` : ''}

${medias.length > 0 ? `
🟡 TAREFAS MÉDIAS:
${medias.slice(0, 5).map(t => `- ${t.title}`).join('\n')}
${medias.length > 5 ? `E mais ${medias.length - 5} tarefas...` : ''}
` : ''}

${baixas.length > 0 ? `
🟢 TAREFAS DE BAIXA PRIORIDADE:
${baixas.slice(0, 3).map(t => `- ${t.title}`).join('\n')}
${baixas.length > 3 ? `E mais ${baixas.length - 3} tarefas...` : ''}
` : ''}

Acesse o sistema: ${process.env.APP_URL || 'http://localhost:3000'}/inicial

💡 Dica: Priorize as tarefas urgentes para manter sua produtividade em alta!

---
Este é um email automático enviado pelo sistema Nura.
        `;

        // Configurar mensagem
        const msg = {
            to: userEmail,
            from: {
                email: EMAIL_FROM,
                name: EMAIL_NAME
            },
            subject: `📋 Seu Resumo Diário - ${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} pendente${tasks.length > 1 ? 's' : ''}`,
            text: textContent,
            html: htmlContent,
        };

        // Enviar email
        await sgMail.send(msg);
        
        console.log(`✅ Email enviado com sucesso para ${userName}!`);

        return {
            sent: true,
            email: userEmail,
            taskCount: tasks.length,
            urgent: urgentes.length,
            medium: medias.length,
            low: baixas.length
        };

    } catch (error) {
        console.error(`❌ Erro ao enviar email para ${userName}:`, error);
        
        // Erros específicos do SendGrid
        if (error.response) {
            console.error('Detalhes do erro SendGrid:', error.response.body);
        }
        
        throw error;
    }
}

/**
 * Envia resumo diário para TODOS os usuários com tarefas pendentes
 * @returns {Object} Estatísticas do envio
 */
async function enviarResumoParaTodos() {
    try {
        console.log('\n📬 ========================================');
        console.log('📬 Iniciando envio em massa de resumos');
        console.log('📬 ========================================\n');

        // Buscar todos os usuários
        const users = await db.query('SELECT id, name, email FROM users');
        
        console.log(`👥 ${users.length} usuários encontrados`);

        let enviados = 0;
        let erros = 0;
        let semTarefas = 0;

        // Enviar para cada usuário
        for (const user of users) {
            try {
                const result = await enviarResumoDiario(user.id, user.email, user.name);
                
                if (result.sent) {
                    enviados++;
                    console.log(`✅ [${enviados}/${users.length}] Email enviado para ${user.name}`);
                } else {
                    semTarefas++;
                    console.log(`ℹ️ [${enviados + semTarefas}/${users.length}] ${user.name} sem tarefas pendentes`);
                }

                // Aguardar 1 segundo entre emails (evitar rate limit)
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                erros++;
                console.error(`❌ [${enviados + erros + semTarefas}/${users.length}] Erro ao enviar para ${user.name}:`, error.message);
            }
        }

        console.log('\n📊 ========================================');
        console.log('📊 RESUMO DO ENVIO');
        console.log('📊 ========================================');
        console.log(`📨 Enviados: ${enviados}`);
        console.log(`➖ Sem tarefas: ${semTarefas}`);
        console.log(`❌ Erros: ${erros}`);
        console.log(`👥 Total: ${users.length}`);
        console.log('========================================\n');

        return {
            total: users.length,
            enviados,
            semTarefas,
            erros
        };

    } catch (error) {
        console.error('❌ Erro fatal ao enviar resumos:', error);
        throw error;
    }
}

/**
 * Envia email genérico (usado para relatórios semanais e outras mensagens)
 * @param {string} destinatario - Email do destinatário
 * @param {string} assunto - Assunto do email
 * @param {string} mensagem - Corpo do email (texto simples)
 * @returns {Object} Resultado do envio
 */
async function enviarEmail(destinatario, assunto, mensagem) {
    try {
        console.log(`📧 Enviando email para ${destinatario}...`);

        // Converter texto simples em HTML formatado
        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #49a09d 0%, #5f9ea0 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px;
            line-height: 1.6;
            color: #333;
        }
        .message {
            white-space: pre-wrap;
            font-family: monospace;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #49a09d;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 ${assunto}</h1>
        </div>
        <div class="content">
            <div class="message">${mensagem}</div>
        </div>
        <div class="footer">
            <p>NURA - Seu assistente de produtividade</p>
            <p>Este é um email automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
        `.trim();

        const msg = {
            to: destinatario,
            from: EMAIL_FROM,
            subject: assunto,
            text: mensagem,
            html: htmlContent
        };

        await sgMail.send(msg);

        console.log(`✅ Email enviado com sucesso para ${destinatario}`);

        return {
            success: true,
            sent: true,
            email: destinatario
        };

    } catch (error) {
        console.error(`❌ Erro ao enviar email para ${destinatario}:`, error.message);

        if (error.response) {
            console.error('Detalhes do erro SendGrid:', error.response.body);
        }

        return {
            success: false,
            sent: false,
            error: error.message,
            email: destinatario
        };
    }
}

/**
 * Envia código de verificação para criação de conta
 * @param {string} email - Email do destinatário
 * @param {string} codigo - Código de 6 dígitos
 * @param {string} nome - Nome do usuário
 * @returns {Object} Resultado do envio
 */
async function enviarCodigoVerificacao(email, codigo, nome) {
    try {
        console.log(`📧 Enviando código de verificação para ${email}...`);

        // Formatar código com espaços para melhor visualização
        const codigoFormatado = codigo.split('').join(' ');

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de Verificação - Nura</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header-icon {
            width: 60px;
            height: 60px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 28px;
        }
        .header h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.8;
            font-size: 14px;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .greeting {
            font-size: 16px;
            color: #333;
            margin-bottom: 25px;
        }
        .instruction {
            font-size: 14px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.5;
        }
        .code-box {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 2px dashed #dee2e6;
            border-radius: 12px;
            padding: 25px 20px;
            margin: 25px 0;
        }
        .code {
            font-family: 'Courier New', monospace;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #1a1a2e;
        }
        .expiry {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 25px;
            padding: 12px 20px;
            background: #fff3cd;
            border-radius: 8px;
            font-size: 13px;
            color: #856404;
        }
        .warning {
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            font-size: 12px;
            color: #666;
            line-height: 1.5;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #999;
            font-size: 12px;
        }
        .footer p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">🔐</div>
            <h1>Código de Verificação</h1>
            <p>Nura - Sistema de Tarefas</p>
        </div>

        <div class="content">
            <div class="greeting">
                Olá${nome ? ', <strong>' + nome + '</strong>' : ''}!
            </div>

            <div class="instruction">
                Use o código abaixo para verificar seu e-mail e criar sua conta no Nura:
            </div>

            <div class="code-box">
                <div class="code">${codigoFormatado}</div>
            </div>

            <div class="expiry">
                ⏰ Este código expira em <strong>10 minutos</strong>
            </div>

            <div class="warning">
                Se você não solicitou este código, ignore este e-mail. Sua conta não será criada sem a verificação.
            </div>
        </div>

        <div class="footer">
            <p>Nura - Seu assistente de produtividade</p>
            <p>Este é um e-mail automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
        `.trim();

        const textContent = `
Olá${nome ? ', ' + nome : ''}!

Seu código de verificação Nura é:

    ${codigoFormatado}

Este código expira em 10 minutos.

Se você não solicitou este código, ignore este e-mail.

---
Nura - Seu assistente de produtividade
        `.trim();

        // Enviar via SendGrid (API HTTP - funciona no Render)
        console.log('📧 Usando Resend para enviar...');

        await sendEmail(
            email,
            `Código de verificação DIVY: ${codigo}`,
            htmlContent,
            textContent
        );

        console.log(`✅ Código de verificação enviado via Resend para ${email}`);

        return {
            success: true,
            sent: true,
            email: email
        };

    } catch (error) {
        console.error(`❌ Erro ao enviar código de verificação para ${email}:`, error.message);

        if (error.response) {
            console.error('Detalhes do erro SendGrid:', error.response.body);
        }

        return {
            success: false,
            sent: false,
            error: error.message,
            email: email
        };
    }
}

/**
 * Envia código de recuperação de senha
 * @param {string} email - Email do destinatário
 * @param {string} codigo - Código de 6 dígitos
 * @param {string} nome - Nome do usuário
 * @returns {Object} Resultado do envio
 */
async function enviarCodigoRecuperacao(email, codigo, nome) {
    try {
        console.log(`📧 Enviando código de recuperação para ${email}...`);

        // Formatar código com espaços para melhor visualização
        const codigoFormatado = codigo.split('').join(' ');

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperação de Senha - Nura</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header-icon {
            width: 60px;
            height: 60px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 28px;
        }
        .header h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.8;
            font-size: 14px;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .greeting {
            font-size: 16px;
            color: #333;
            margin-bottom: 25px;
        }
        .instruction {
            font-size: 14px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.5;
        }
        .code-box {
            background: linear-gradient(135deg, #fef5f5 0%, #fde8e8 100%);
            border: 2px dashed #f5c6cb;
            border-radius: 12px;
            padding: 25px 20px;
            margin: 25px 0;
        }
        .code {
            font-family: 'Courier New', monospace;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #c0392b;
        }
        .expiry {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 25px;
            padding: 12px 20px;
            background: #fff3cd;
            border-radius: 8px;
            font-size: 13px;
            color: #856404;
        }
        .warning {
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            font-size: 12px;
            color: #666;
            line-height: 1.5;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #999;
            font-size: 12px;
        }
        .footer p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">🔑</div>
            <h1>Recuperação de Senha</h1>
            <p>Nura - Sistema de Tarefas</p>
        </div>

        <div class="content">
            <div class="greeting">
                Olá${nome ? ', <strong>' + nome + '</strong>' : ''}!
            </div>

            <div class="instruction">
                Recebemos uma solicitação para redefinir sua senha. Use o código abaixo:
            </div>

            <div class="code-box">
                <div class="code">${codigoFormatado}</div>
            </div>

            <div class="expiry">
                ⏰ Este código expira em <strong>10 minutos</strong>
            </div>

            <div class="warning">
                ⚠️ Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha atual permanecerá inalterada.
            </div>
        </div>

        <div class="footer">
            <p>Nura - Seu assistente de produtividade</p>
            <p>Este é um e-mail automático, por favor não responda.</p>
        </div>
    </div>
</body>
</html>
        `.trim();

        const textContent = `
Olá${nome ? ', ' + nome : ''}!

Recebemos uma solicitação para redefinir sua senha.

Seu código de recuperação Nura é:

    ${codigoFormatado}

Este código expira em 10 minutos.

Se você não solicitou a redefinição de senha, ignore este e-mail.

---
Nura - Seu assistente de produtividade
        `.trim();

        // Enviar via SendGrid (API HTTP - funciona no Render)
        console.log('📧 Usando Resend para enviar...');

        await sendEmail(
            email,
            `Código de recuperação DIVY: ${codigo}`,
            htmlContent,
            textContent
        );

        console.log(`✅ Código de recuperação enviado via Resend para ${email}`);

        return {
            success: true,
            sent: true,
            email: email
        };

    } catch (error) {
        console.error(`❌ Erro ao enviar código de recuperação para ${email}:`, error.message);

        if (error.response) {
            console.error('Detalhes do erro SendGrid:', error.response.body);
        }

        return {
            success: false,
            sent: false,
            error: error.message,
            email: email
        };
    }
}

/**
 * Envia feedback de um usuário para o admin
 * @param {string} tipo - Tipo do feedback (bug, sugestao, melhoria, outro)
 * @param {string} mensagem - Mensagem do feedback
 * @param {string} nomeUsuario - Nome do usuário
 * @param {string} emailUsuario - Email do usuário
 * @param {number} userId - ID do usuário
 */
async function enviarFeedback(tipo, mensagem, nomeUsuario, emailUsuario, userId) {
    try {
        console.log(`📬 Enviando feedback de ${nomeUsuario} (${emailUsuario})...`);

        const tipoLabels = {
            'bug': { label: 'Bug', emoji: '🐛', color: '#ef4444' },
            'sugestao': { label: 'Sugestão', emoji: '💡', color: '#f59e0b' },
            'melhoria': { label: 'Melhoria', emoji: '🚀', color: '#3b82f6' },
            'outro': { label: 'Outro', emoji: '💬', color: '#8b5cf6' }
        };

        const tipoInfo = tipoLabels[tipo] || tipoLabels['outro'];
        const dataFormatada = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const htmlContent = `<pre style="font-family:monospace;font-size:14px;line-height:1.8">
[DIVY Feedback]

Tipo:     ${tipoInfo.emoji} ${tipoInfo.label}
Usuario:  ${nomeUsuario}
Email:    ${emailUsuario}
ID:       #${userId || 'N/A'}
Data:     ${dataFormatada}

--- Mensagem ---
${mensagem.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
</pre>`;

        const textContent = `Novo Feedback DIVY\n\nTipo: ${tipoInfo.label}\nUsuário: ${nomeUsuario} (${emailUsuario})\nID: #${userId || 'N/A'}\nData: ${dataFormatada}\n\nMensagem:\n${mensagem}`;

        await sendEmail(
            'gustavu.dev@gmail.com',
            `[DIVY Feedback] ${tipoInfo.emoji} ${tipoInfo.label} - ${nomeUsuario}`,
            htmlContent,
            textContent
        );

        return { success: true, sent: true };

    } catch (err) {
        console.error('❌ Erro ao enviar feedback:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    enviarResumoDiario,
    enviarResumoParaTodos,
    enviarEmail,
    enviarCodigoVerificacao,
    enviarCodigoRecuperacao,
    enviarFeedback
};