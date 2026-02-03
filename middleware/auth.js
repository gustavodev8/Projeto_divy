/* ========================================
   MIDDLEWARE DE AUTENTICAÇÃO JWT
   ======================================== */

const jwt = require('jsonwebtoken');

// Chaves secretas (em produção, usar variáveis de ambiente)
const JWT_SECRET = process.env.JWT_SECRET || 'nura_jwt_secret_key_2024_very_secure';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'nura_refresh_secret_key_2024_very_secure';

// Tempo de expiração
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutos
const REFRESH_TOKEN_EXPIRY = '7d';  // 7 dias

// Store para refresh tokens (em produção, usar Redis ou banco de dados)
const refreshTokens = new Set();

/**
 * Gera um par de tokens (access + refresh)
 */
function generateTokens(user) {
    const payload = {
        id: user.id,
        username: user.username,
        email: user.email
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    // Armazenar refresh token
    refreshTokens.add(refreshToken);

    return { accessToken, refreshToken };
}

/**
 * Verifica e decodifica um access token
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Verifica e decodifica um refresh token
 */
function verifyRefreshToken(token) {
    try {
        if (!refreshTokens.has(token)) {
            return null;
        }
        return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Invalida um refresh token (logout)
 */
function invalidateRefreshToken(token) {
    refreshTokens.delete(token);
}

/**
 * Middleware de autenticação JWT
 * Verifica se o usuário está autenticado
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token de acesso não fornecido',
            code: 'NO_TOKEN'
        });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            error: 'Token inválido ou expirado',
            code: 'INVALID_TOKEN'
        });
    }

    // Adiciona dados do usuário à requisição
    req.user = decoded;
    next();
}

/**
 * Middleware opcional de autenticação
 * Não bloqueia a requisição se não houver token
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        const decoded = verifyAccessToken(token);
        if (decoded) {
            req.user = decoded;
        }
    }

    next();
}

/**
 * Middleware para verificar se é o próprio usuário ou admin
 */
function authorizeUser(req, res, next) {
    const requestedUserId = parseInt(req.params.userId || req.body.user_id || req.query.user_id);

    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Não autenticado',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (req.user.id !== requestedUserId) {
        return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            code: 'FORBIDDEN'
        });
    }

    next();
}

module.exports = {
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    invalidateRefreshToken,
    authenticateToken,
    optionalAuth,
    authorizeUser,
    JWT_SECRET,
    JWT_REFRESH_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY
};
