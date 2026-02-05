/* ========================================
   RATE LIMITING - PROTEÇÃO CONTRA ABUSO
   ======================================== */

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter geral para API
 * 100 requisições por minuto por IP
 */
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 requisições por janela
    message: {
        success: false,
        error: 'Muitas requisições. Tente novamente em alguns minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiter para login
 * 5 tentativas a cada 15 minutos por IP
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 tentativas
    message: {
        success: false,
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        code: 'LOGIN_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Não conta requisições bem-sucedidas
});

/**
 * Rate limiter para criação de conta
 * 3 contas por hora por IP
 */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 tentativas
    message: {
        success: false,
        error: 'Muitas contas criadas. Tente novamente em 1 hora.',
        code: 'REGISTER_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiter para endpoints de IA
 * 20 requisições por minuto (IA é custosa)
 */
const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 20, // 20 requisições
    message: {
        success: false,
        error: 'Muitas requisições de IA. Aguarde um momento.',
        code: 'AI_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiter para refresh token
 * 10 requisições por minuto
 */
const refreshLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 10,
    message: {
        success: false,
        error: 'Muitas requisições de refresh. Tente novamente.',
        code: 'REFRESH_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiter para envio de código de verificação
 * 3 códigos por email a cada 10 minutos por IP
 */
const sendCodeLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 3, // 3 tentativas
    message: {
        success: false,
        error: 'Muitos códigos solicitados. Aguarde 10 minutos.',
        code: 'SEND_CODE_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
    // Usa o keyGenerator padrão (por IP) para evitar problemas com IPv6
});

module.exports = {
    generalLimiter,
    loginLimiter,
    registerLimiter,
    aiLimiter,
    refreshLimiter,
    sendCodeLimiter
};
