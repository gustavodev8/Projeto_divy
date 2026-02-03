/* ========================================
   ROTAS DE AUTENTICAÇÃO - API v1
   ======================================== */

const express = require('express');
const router = express.Router();
const { hashPassword, comparePassword, isHashedPassword } = require('../../utils/password');
const { generateTokens, verifyRefreshToken, invalidateRefreshToken } = require('../../middleware/auth');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../../middleware/rateLimiter');
const { validateLogin, validateRegister } = require('../../middleware/validators');
const { success, error, created, unauthorized, badRequest, conflict } = require('../../utils/response');

module.exports = function(db, isPostgres) {

    // ===== LOGIN =====
    router.post('/login', loginLimiter, validateLogin, async (req, res) => {
        try {
            const { email, username, password } = req.body;

            if (!email && !username) {
                return badRequest(res, 'Email ou username é obrigatório', 'MISSING_CREDENTIALS');
            }

            // Buscar usuário
            let user;
            if (isPostgres) {
                const result = await db.query(
                    'SELECT * FROM users WHERE email = $1 OR name = $2',
                    [email || '', username || '']
                );
                user = result.rows[0];
            } else {
                user = db.prepare('SELECT * FROM users WHERE email = ? OR name = ?')
                    .get(email || '', username || '');
            }

            if (!user) {
                return unauthorized(res, 'Credenciais inválidas', 'INVALID_CREDENTIALS');
            }

            // Verificar senha
            let passwordValid = false;

            if (isHashedPassword(user.password)) {
                // Senha já está com hash
                passwordValid = await comparePassword(password, user.password);
            } else {
                // Senha em texto plano (legado) - verificar e atualizar para hash
                passwordValid = (password === user.password);

                if (passwordValid) {
                    // Atualizar senha para hash
                    const hashedPassword = await hashPassword(password);
                    if (isPostgres) {
                        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
                    } else {
                        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
                    }
                    console.log(`🔐 Senha do usuário ${user.id} atualizada para hash`);
                }
            }

            if (!passwordValid) {
                return unauthorized(res, 'Credenciais inválidas', 'INVALID_CREDENTIALS');
            }

            // Gerar tokens
            const tokens = generateTokens(user);

            // Resposta de sucesso
            return success(res, {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    username: user.name
                },
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: 900 // 15 minutos em segundos
            }, 'Login realizado com sucesso');

        } catch (err) {
            console.error('❌ Erro no login:', err);
            return error(res, 'Erro ao realizar login');
        }
    });

    // ===== REGISTRO =====
    router.post('/register', registerLimiter, validateRegister, async (req, res) => {
        try {
            const { name, email, password, username } = req.body;
            const displayName = username || name;

            // Verificar se email já existe
            let existingUser;
            if (isPostgres) {
                const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
                existingUser = result.rows[0];
            } else {
                existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            }

            if (existingUser) {
                return conflict(res, 'Email já cadastrado', 'EMAIL_EXISTS');
            }

            // Hash da senha
            const hashedPassword = await hashPassword(password);

            // Criar usuário
            let newUser;
            if (isPostgres) {
                const result = await db.query(
                    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
                    [displayName, email, hashedPassword]
                );
                newUser = result.rows[0];
            } else {
                const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                const info = stmt.run(displayName, email, hashedPassword);
                newUser = { id: info.lastInsertRowid, name: displayName, email };
            }

            // Gerar tokens
            const tokens = generateTokens(newUser);

            // Criar lista padrão "Tarefas"
            if (isPostgres) {
                await db.query(
                    `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                     VALUES ($1, 'Tarefas', '📋', '#146551', true, 0)`,
                    [newUser.id]
                );
            } else {
                db.prepare(
                    `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                     VALUES (?, 'Tarefas', '📋', '#146551', 1, 0)`
                ).run(newUser.id);
            }

            return created(res, {
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    username: newUser.name
                },
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: 900
            }, 'Conta criada com sucesso');

        } catch (err) {
            console.error('❌ Erro no registro:', err);
            return error(res, 'Erro ao criar conta');
        }
    });

    // ===== REFRESH TOKEN =====
    router.post('/refresh', refreshLimiter, async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return badRequest(res, 'Refresh token é obrigatório', 'MISSING_REFRESH_TOKEN');
            }

            // Verificar refresh token
            const decoded = verifyRefreshToken(refreshToken);

            if (!decoded) {
                return unauthorized(res, 'Refresh token inválido ou expirado', 'INVALID_REFRESH_TOKEN');
            }

            // Buscar usuário
            let user;
            if (isPostgres) {
                const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.id]);
                user = result.rows[0];
            } else {
                user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(decoded.id);
            }

            if (!user) {
                return unauthorized(res, 'Usuário não encontrado', 'USER_NOT_FOUND');
            }

            // Invalidar token antigo e gerar novos
            invalidateRefreshToken(refreshToken);
            const tokens = generateTokens(user);

            return success(res, {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: 900
            }, 'Token renovado com sucesso');

        } catch (err) {
            console.error('❌ Erro no refresh:', err);
            return error(res, 'Erro ao renovar token');
        }
    });

    // ===== LOGOUT =====
    router.post('/logout', async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (refreshToken) {
                invalidateRefreshToken(refreshToken);
            }

            return success(res, null, 'Logout realizado com sucesso');

        } catch (err) {
            console.error('❌ Erro no logout:', err);
            return error(res, 'Erro ao realizar logout');
        }
    });

    // ===== VERIFICAR TOKEN =====
    router.get('/verify', async (req, res) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return unauthorized(res, 'Token não fornecido', 'NO_TOKEN');
        }

        const { verifyAccessToken } = require('../../middleware/auth');
        const decoded = verifyAccessToken(token);

        if (!decoded) {
            return unauthorized(res, 'Token inválido', 'INVALID_TOKEN');
        }

        return success(res, {
            user: {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email
            },
            valid: true
        }, 'Token válido');
    });

    return router;
};
