/* ========================================
   ROTAS DE FEEDBACK - API v1
   ======================================== */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { success, error, badRequest } = require('../../utils/response');
const { enviarFeedback } = require('../../emailService');

// Rate limiter: 3 feedbacks por hora por usuário
const feedbackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,
    message: { success: false, error: 'Limite de feedbacks atingido. Tente novamente em 1 hora.' },
    keyGenerator: (req) => String(req.user?.id || 'anon'),
    validate: false
});

module.exports = function(db, isPostgres) {

    // ===== ENVIAR FEEDBACK =====
    router.post('/', feedbackLimiter, async (req, res) => {
        try {
            const { type, message } = req.body;
            const userId = req.user?.id;

            // Validações
            if (!type || !message) {
                return badRequest(res, 'Tipo e mensagem são obrigatórios.');
            }

            const tiposValidos = ['bug', 'sugestao', 'melhoria', 'outro'];
            if (!tiposValidos.includes(type)) {
                return badRequest(res, 'Tipo de feedback inválido.');
            }

            if (message.trim().length < 10) {
                return badRequest(res, 'A mensagem deve ter pelo menos 10 caracteres.');
            }

            if (message.trim().length > 2000) {
                return badRequest(res, 'A mensagem deve ter no máximo 2000 caracteres.');
            }

            // Buscar dados do usuário
            let userName = 'Usuário';
            let userEmail = 'não informado';

            if (userId) {
                try {
                    const query = isPostgres
                        ? 'SELECT username, email FROM users WHERE id = $1'
                        : 'SELECT username, email FROM users WHERE id = ?';
                    const params = [userId];

                    const result = isPostgres
                        ? await db.query(query, params)
                        : await new Promise((resolve, reject) => {
                            db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
                        });

                    const user = isPostgres ? result.rows[0] : result;
                    if (user) {
                        userName = user.username || 'Usuário';
                        userEmail = user.email || 'não informado';
                    }
                } catch (dbErr) {
                    console.error('⚠️ Erro ao buscar usuário para feedback:', dbErr.message);
                }
            }

            // Enviar email
            const emailResult = await enviarFeedback(type, message.trim(), userName, userEmail, userId);

            if (emailResult.success) {
                console.log(`📬 Feedback enviado por ${userName} (${userEmail}): [${type}]`);
                return success(res, { sent: true }, 'Feedback enviado com sucesso! Obrigado pela sua contribuição.');
            } else {
                return error(res, 'Erro ao enviar feedback. Tente novamente.');
            }

        } catch (err) {
            console.error('❌ Erro na rota de feedback:', err);
            return error(res, 'Erro interno ao processar feedback.');
        }
    });

    return router;
};
