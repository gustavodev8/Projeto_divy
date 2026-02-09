/* ========================================
   ROTAS DE WHATSAPP - API v1
   Sistema de vinculação via código
   ======================================== */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const { success, error, badRequest, unauthorized, notFound } = require('../../utils/response');

module.exports = function(db, isPostgres) {

    // Armazena códigos de verificação pendentes (em memória)
    // Em produção, considere usar Redis
    const pendingVerifications = new Map();

    // Limpar verificações expiradas a cada 5 minutos
    setInterval(() => {
        const now = Date.now();
        for (const [key, data] of pendingVerifications.entries()) {
            if (now > data.expiresAt) {
                pendingVerifications.delete(key);
            }
        }
    }, 5 * 60 * 1000);

    // ===== VERIFICAR STATUS DE VINCULAÇÃO =====
    router.get('/status', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            // Buscar vinculação existente
            let whatsappRecord;
            if (isPostgres) {
                const result = await db.query(
                    'SELECT phone_number, created_at FROM users_whatsapp WHERE user_id = $1',
                    [userId]
                );
                whatsappRecord = result[0];
            }

            if (whatsappRecord) {
                // Formatar número para exibição
                const phone = whatsappRecord.phone_number;
                const formattedPhone = `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4)}`;

                return success(res, {
                    linked: true,
                    phoneNumber: formattedPhone,
                    linkedAt: whatsappRecord.created_at
                }, 'WhatsApp vinculado');
            }

            return success(res, {
                linked: false,
                phoneNumber: null,
                linkedAt: null
            }, 'WhatsApp não vinculado');

        } catch (err) {
            console.error('❌ Erro ao verificar status WhatsApp:', err);
            return error(res, 'Erro ao verificar status');
        }
    });

    // ===== SOLICITAR CÓDIGO DE VERIFICAÇÃO =====
    router.post('/request-verification', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return badRequest(res, 'Número de telefone é obrigatório', 'MISSING_PHONE');
            }

            // Limpar e validar número
            let cleanNumber = phoneNumber.replace(/\D/g, '');

            // Adicionar 55 se não tiver
            if (!cleanNumber.startsWith('55')) {
                cleanNumber = '55' + cleanNumber;
            }

            // Validar formato: 55 + DDD (2) + número (8)
            if (cleanNumber.length !== 12) {
                return badRequest(res, 'Número inválido. Use formato: DDD + número (sem o 9 da frente)', 'INVALID_PHONE');
            }

            // Verificar se número já está vinculado a outra conta
            if (isPostgres) {
                const existingLink = await db.query(
                    'SELECT user_id FROM users_whatsapp WHERE phone_number = $1',
                    [cleanNumber]
                );
                if (existingLink[0] && existingLink[0].user_id !== userId) {
                    return badRequest(res, 'Este número já está vinculado a outra conta', 'PHONE_IN_USE');
                }
            }

            // Gerar código de 6 dígitos
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Salvar verificação pendente (expira em 10 minutos)
            const expiresAt = Date.now() + 10 * 60 * 1000;
            pendingVerifications.set(`${userId}_${cleanNumber}`, {
                code,
                userId,
                phoneNumber: cleanNumber,
                expiresAt,
                attempts: 0
            });

            // Enviar mensagem via WhatsApp bot
            try {
                const whatsappBot = require('../../whatsapp-bot');
                const sock = whatsappBot.sock;

                if (sock) {
                    await sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, {
                        text: `🔐 *DIVY - Código de Verificação*\n\n` +
                              `Seu código de vinculação é:\n\n` +
                              `*${code}*\n\n` +
                              `⏱️ Este código expira em 10 minutos.\n\n` +
                              `Se você não solicitou este código, ignore esta mensagem.`
                    });

                    console.log(`📱 Código ${code} enviado para ${cleanNumber}`);
                } else {
                    console.error('❌ WhatsApp bot não está conectado');
                    return error(res, 'Serviço WhatsApp temporariamente indisponível');
                }
            } catch (whatsappError) {
                console.error('❌ Erro ao enviar mensagem WhatsApp:', whatsappError);
                return error(res, 'Erro ao enviar código. Verifique se o número está correto.');
            }

            // Formatar número para exibição
            const displayNumber = `+${cleanNumber.slice(0, 2)} ${cleanNumber.slice(2, 4)} ${cleanNumber.slice(4)}`;

            return success(res, {
                phoneNumber: displayNumber,
                expiresIn: 600 // 10 minutos em segundos
            }, 'Código de verificação enviado');

        } catch (err) {
            console.error('❌ Erro ao solicitar verificação WhatsApp:', err);
            return error(res, 'Erro ao enviar código de verificação');
        }
    });

    // ===== VERIFICAR CÓDIGO =====
    router.post('/verify-code', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { phoneNumber, code } = req.body;

            if (!phoneNumber || !code) {
                return badRequest(res, 'Número e código são obrigatórios', 'MISSING_FIELDS');
            }

            // Limpar número
            let cleanNumber = phoneNumber.replace(/\D/g, '');
            if (!cleanNumber.startsWith('55')) {
                cleanNumber = '55' + cleanNumber;
            }

            // Buscar verificação pendente
            const verificationKey = `${userId}_${cleanNumber}`;
            const verification = pendingVerifications.get(verificationKey);

            if (!verification) {
                return unauthorized(res, 'Código expirado ou não encontrado. Solicite um novo código.', 'NO_VERIFICATION');
            }

            // Verificar expiração
            if (Date.now() > verification.expiresAt) {
                pendingVerifications.delete(verificationKey);
                return unauthorized(res, 'Código expirado. Solicite um novo código.', 'CODE_EXPIRED');
            }

            // Verificar tentativas
            if (verification.attempts >= 5) {
                pendingVerifications.delete(verificationKey);
                return unauthorized(res, 'Muitas tentativas incorretas. Solicite um novo código.', 'TOO_MANY_ATTEMPTS');
            }

            // Verificar código
            if (verification.code !== code) {
                verification.attempts++;
                return unauthorized(res, 'Código incorreto', 'INVALID_CODE');
            }

            // Código correto - vincular WhatsApp
            try {
                if (isPostgres) {
                    // Verificar se já existe registro para atualizar
                    const existing = await db.query(
                        'SELECT id FROM users_whatsapp WHERE user_id = $1',
                        [userId]
                    );

                    if (existing[0]) {
                        // Atualizar número existente
                        await db.query(
                            'UPDATE users_whatsapp SET phone_number = $1, created_at = NOW() WHERE user_id = $2',
                            [cleanNumber, userId]
                        );
                    } else {
                        // Criar novo registro
                        await db.query(
                            'INSERT INTO users_whatsapp (user_id, phone_number) VALUES ($1, $2) ON CONFLICT (phone_number) DO UPDATE SET user_id = $1',
                            [userId, cleanNumber]
                        );
                    }
                }

                // Remover verificação pendente
                pendingVerifications.delete(verificationKey);

                // Enviar mensagem de confirmação
                try {
                    const whatsappBot = require('../../whatsapp-bot');
                    const sock = whatsappBot.sock;

                    if (sock) {
                        await sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, {
                            text: `✅ *WhatsApp vinculado com sucesso!*\n\n` +
                                  `Agora você pode gerenciar suas tarefas por aqui.\n\n` +
                                  `Digite *oi* para ver os comandos disponíveis.`
                        });
                    }
                } catch (msgError) {
                    console.log('⚠️ Não foi possível enviar mensagem de confirmação');
                }

                // Formatar número para exibição
                const displayNumber = `+${cleanNumber.slice(0, 2)} ${cleanNumber.slice(2, 4)} ${cleanNumber.slice(4)}`;

                console.log(`✅ WhatsApp ${cleanNumber} vinculado ao usuário ${userId}`);

                return success(res, {
                    linked: true,
                    phoneNumber: displayNumber
                }, 'WhatsApp vinculado com sucesso');

            } catch (dbError) {
                console.error('❌ Erro ao salvar vinculação:', dbError);
                return error(res, 'Erro ao vincular WhatsApp');
            }

        } catch (err) {
            console.error('❌ Erro ao verificar código WhatsApp:', err);
            return error(res, 'Erro ao verificar código');
        }
    });

    // ===== REENVIAR CÓDIGO =====
    router.post('/resend-code', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return badRequest(res, 'Número de telefone é obrigatório', 'MISSING_PHONE');
            }

            // Limpar número
            let cleanNumber = phoneNumber.replace(/\D/g, '');
            if (!cleanNumber.startsWith('55')) {
                cleanNumber = '55' + cleanNumber;
            }

            // Buscar verificação pendente existente
            const verificationKey = `${userId}_${cleanNumber}`;
            const existingVerification = pendingVerifications.get(verificationKey);

            // Gerar novo código
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = Date.now() + 10 * 60 * 1000;

            // Atualizar ou criar verificação
            pendingVerifications.set(verificationKey, {
                code,
                userId,
                phoneNumber: cleanNumber,
                expiresAt,
                attempts: 0
            });

            // Enviar mensagem via WhatsApp bot
            try {
                const whatsappBot = require('../../whatsapp-bot');
                const sock = whatsappBot.sock;

                if (sock) {
                    await sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, {
                        text: `🔐 *DIVY - Novo Código de Verificação*\n\n` +
                              `Seu novo código de vinculação é:\n\n` +
                              `*${code}*\n\n` +
                              `⏱️ Este código expira em 10 minutos.`
                    });

                    console.log(`📱 Novo código ${code} enviado para ${cleanNumber}`);
                } else {
                    return error(res, 'Serviço WhatsApp temporariamente indisponível');
                }
            } catch (whatsappError) {
                console.error('❌ Erro ao reenviar código:', whatsappError);
                return error(res, 'Erro ao reenviar código');
            }

            const displayNumber = `+${cleanNumber.slice(0, 2)} ${cleanNumber.slice(2, 4)} ${cleanNumber.slice(4)}`;

            return success(res, {
                phoneNumber: displayNumber,
                expiresIn: 600
            }, 'Novo código enviado');

        } catch (err) {
            console.error('❌ Erro ao reenviar código WhatsApp:', err);
            return error(res, 'Erro ao reenviar código');
        }
    });

    // ===== DESVINCULAR WHATSAPP =====
    router.delete('/unlink', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            // Buscar número antes de desvincular
            let phoneNumber = null;
            if (isPostgres) {
                const result = await db.query(
                    'SELECT phone_number FROM users_whatsapp WHERE user_id = $1',
                    [userId]
                );
                if (result[0]) {
                    phoneNumber = result[0].phone_number;
                }
            }

            if (!phoneNumber) {
                return notFound(res, 'Nenhum WhatsApp vinculado', 'NOT_LINKED');
            }

            // Remover vinculação
            if (isPostgres) {
                await db.query('DELETE FROM users_whatsapp WHERE user_id = $1', [userId]);
            }

            // Enviar mensagem de despedida
            try {
                const whatsappBot = require('../../whatsapp-bot');
                const sock = whatsappBot.sock;

                if (sock) {
                    await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
                        text: `👋 *Seu WhatsApp foi desvinculado do Divy.*\n\n` +
                              `Você não receberá mais notificações por aqui.\n\n` +
                              `Para vincular novamente, acesse as configurações no app.`
                    });
                }
            } catch (msgError) {
                console.log('⚠️ Não foi possível enviar mensagem de despedida');
            }

            console.log(`🔓 WhatsApp ${phoneNumber} desvinculado do usuário ${userId}`);

            return success(res, {
                unlinked: true
            }, 'WhatsApp desvinculado com sucesso');

        } catch (err) {
            console.error('❌ Erro ao desvincular WhatsApp:', err);
            return error(res, 'Erro ao desvincular WhatsApp');
        }
    });

    return router;
};
