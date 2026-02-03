/* ========================================
   UTILITÁRIOS DE RESPOSTA PADRONIZADA
   ======================================== */

/**
 * Resposta de sucesso padronizada
 */
function success(res, data = null, message = 'Operação realizada com sucesso', statusCode = 200) {
    const response = {
        success: true,
        message
    };

    if (data !== null) {
        // Se data for um objeto com propriedades específicas, spread
        if (typeof data === 'object' && !Array.isArray(data)) {
            Object.assign(response, data);
        } else {
            response.data = data;
        }
    }

    return res.status(statusCode).json(response);
}

/**
 * Resposta de erro padronizada
 */
function error(res, message = 'Erro interno do servidor', statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    const response = {
        success: false,
        error: message,
        code
    };

    if (details) {
        response.details = details;
    }

    return res.status(statusCode).json(response);
}

/**
 * Resposta de criação (201)
 */
function created(res, data, message = 'Recurso criado com sucesso') {
    return success(res, data, message, 201);
}

/**
 * Resposta de não encontrado (404)
 */
function notFound(res, message = 'Recurso não encontrado', code = 'NOT_FOUND') {
    return error(res, message, 404, code);
}

/**
 * Resposta de não autorizado (401)
 */
function unauthorized(res, message = 'Não autorizado', code = 'UNAUTHORIZED') {
    return error(res, message, 401, code);
}

/**
 * Resposta de proibido (403)
 */
function forbidden(res, message = 'Acesso negado', code = 'FORBIDDEN') {
    return error(res, message, 403, code);
}

/**
 * Resposta de bad request (400)
 */
function badRequest(res, message = 'Requisição inválida', code = 'BAD_REQUEST', details = null) {
    return error(res, message, 400, code, details);
}

/**
 * Resposta de conflito (409)
 */
function conflict(res, message = 'Conflito de dados', code = 'CONFLICT') {
    return error(res, message, 409, code);
}

/**
 * Wrapper para try-catch em controllers async
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(err => {
            console.error('❌ Erro não tratado:', err);
            error(res, 'Erro interno do servidor', 500, 'INTERNAL_ERROR');
        });
    };
}

module.exports = {
    success,
    error,
    created,
    notFound,
    unauthorized,
    forbidden,
    badRequest,
    conflict,
    asyncHandler
};
