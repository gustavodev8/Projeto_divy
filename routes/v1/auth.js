/* ========================================
   ROTAS DE AUTENTICAÇÃO - API v1
   ======================================== */

const express = require('express');
const router = express.Router();
const { hashPassword, comparePassword, isHashedPassword } = require('../../utils/password');
const { generateTokens, verifyRefreshToken, invalidateRefreshToken } = require('../../middleware/auth');
const { loginLimiter, registerLimiter, refreshLimiter, sendCodeLimiter } = require('../../middleware/rateLimiter');
const { validateLogin, validateRegister } = require('../../middleware/validators');
const { success, error, created, unauthorized, badRequest, conflict } = require('../../utils/response');
const { enviarCodigoVerificacao } = require('../../emailService');

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
                user = result[0];
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
                existingUser = result[0];
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
                newUser = result[0];
            } else {
                const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                const info = stmt.run(displayName, email, hashedPassword);
                newUser = { id: info.lastInsertRowid, name: displayName, email };
            }

            // Gerar tokens
            const tokens = generateTokens(newUser);

            // Criar lista padrão "Minha Lista"
            let newList;
            if (isPostgres) {
                const listResult = await db.query(
                    `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                     VALUES ($1, 'Minha Lista', '📋', '#2563eb', true, 0)
                     RETURNING id`,
                    [newUser.id]
                );
                newList = listResult[0];
            } else {
                const stmt = db.prepare(
                    `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                     VALUES (?, 'Minha Lista', '📋', '#2563eb', 1, 0)`
                );
                const info = stmt.run(newUser.id);
                newList = { id: info.lastInsertRowid };
            }

            // Criar seção padrão "Tarefas" dentro da lista
            if (newList && newList.id) {
                if (isPostgres) {
                    await db.query(
                        `INSERT INTO sections (list_id, user_id, name, position)
                         VALUES ($1, $2, 'Tarefas', 0)`,
                        [newList.id, newUser.id]
                    );
                } else {
                    db.prepare(
                        `INSERT INTO sections (list_id, user_id, name, position)
                         VALUES (?, ?, 'Tarefas', 0)`
                    ).run(newList.id, newUser.id);
                }
            }

            console.log(`✅ Lista e seção padrão criadas para usuário ${newUser.id}`);

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
                user = result[0];
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

    // ===== ENVIAR CÓDIGO DE VERIFICAÇÃO =====
    router.post('/send-code', sendCodeLimiter, async (req, res) => {
        try {
            const { email, name, password } = req.body;

            if (!email) {
                return badRequest(res, 'Email é obrigatório', 'MISSING_EMAIL');
            }

            if (!name || name.length < 3) {
                return badRequest(res, 'Nome deve ter pelo menos 3 caracteres', 'INVALID_NAME');
            }

            if (!password || password.length < 6) {
                return badRequest(res, 'Senha deve ter pelo menos 6 caracteres', 'INVALID_PASSWORD');
            }

            // Verificar se email já está cadastrado
            let existingUser;
            if (isPostgres) {
                const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
                existingUser = result[0];
            } else {
                existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            }

            if (existingUser) {
                return conflict(res, 'Este email já está cadastrado', 'EMAIL_EXISTS');
            }

            // Gerar código de 6 dígitos
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Hash da senha para armazenar temporariamente
            const passwordHash = await hashPassword(password);

            // Definir expiração (10 minutos)
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            // Invalidar códigos anteriores do mesmo email
            if (isPostgres) {
                await db.query(
                    "UPDATE verification_codes SET used = true WHERE email = $1 AND used = false",
                    [email]
                );
            } else {
                db.prepare("UPDATE verification_codes SET used = 1 WHERE email = ? AND used = 0").run(email);
            }

            // Salvar novo código
            if (isPostgres) {
                await db.query(
                    `INSERT INTO verification_codes (email, code, name, password_hash, type, expires_at)
                     VALUES ($1, $2, $3, $4, 'register', $5)`,
                    [email, code, name, passwordHash, expiresAt]
                );
            } else {
                db.prepare(
                    `INSERT INTO verification_codes (email, code, name, password_hash, type, expires_at)
                     VALUES (?, ?, ?, ?, 'register', ?)`
                ).run(email, code, name, passwordHash, expiresAt);
            }

            // Enviar email
            const emailResult = await enviarCodigoVerificacao(email, code, name);

            if (!emailResult.success) {
                return error(res, 'Erro ao enviar email de verificação. Tente novamente.');
            }

            console.log(`📧 Código ${code} enviado para ${email}`);

            return success(res, {
                email: email,
                expiresIn: 600 // 10 minutos em segundos
            }, 'Código de verificação enviado para seu email');

        } catch (err) {
            console.error('❌ Erro ao enviar código:', err);
            return error(res, 'Erro ao enviar código de verificação');
        }
    });

    // ===== VERIFICAR CÓDIGO =====
    router.post('/verify-code', async (req, res) => {
        try {
            const { email, code } = req.body;

            if (!email || !code) {
                return badRequest(res, 'Email e código são obrigatórios', 'MISSING_FIELDS');
            }

            // Buscar código válido
            let verificationRecord;
            if (isPostgres) {
                const result = await db.query(
                    `SELECT * FROM verification_codes
                     WHERE email = $1 AND code = $2 AND used = false AND expires_at > NOW()
                     ORDER BY created_at DESC LIMIT 1`,
                    [email, code]
                );
                verificationRecord = result[0];
            } else {
                verificationRecord = db.prepare(
                    `SELECT * FROM verification_codes
                     WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
                     ORDER BY created_at DESC LIMIT 1`
                ).get(email, code);
            }

            if (!verificationRecord) {
                // Incrementar tentativas do código mais recente (se existir)
                if (isPostgres) {
                    await db.query(
                        `UPDATE verification_codes SET attempts = attempts + 1
                         WHERE email = $1 AND used = false
                         AND id = (SELECT id FROM verification_codes WHERE email = $1 AND used = false ORDER BY created_at DESC LIMIT 1)`,
                        [email]
                    );
                } else {
                    const latest = db.prepare(
                        `SELECT id FROM verification_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`
                    ).get(email);
                    if (latest) {
                        db.prepare(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?`).run(latest.id);
                    }
                }

                return unauthorized(res, 'Código inválido ou expirado', 'INVALID_CODE');
            }

            // Verificar número de tentativas
            if (verificationRecord.attempts >= 5) {
                return unauthorized(res, 'Muitas tentativas incorretas. Solicite um novo código.', 'TOO_MANY_ATTEMPTS');
            }

            // Marcar como verificado
            if (isPostgres) {
                await db.query(
                    'UPDATE verification_codes SET verified = true WHERE id = $1',
                    [verificationRecord.id]
                );
            } else {
                db.prepare('UPDATE verification_codes SET verified = 1 WHERE id = ?').run(verificationRecord.id);
            }

            console.log(`✅ Código verificado para ${email}`);

            return success(res, {
                verified: true,
                email: email
            }, 'Código verificado com sucesso');

        } catch (err) {
            console.error('❌ Erro ao verificar código:', err);
            return error(res, 'Erro ao verificar código');
        }
    });

    // ===== REGISTRO COM CÓDIGO VERIFICADO =====
    router.post('/register-verified', async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return badRequest(res, 'Email é obrigatório', 'MISSING_EMAIL');
            }

            // Buscar código verificado recente (últimos 15 minutos)
            let verificationRecord;
            if (isPostgres) {
                const result = await db.query(
                    `SELECT * FROM verification_codes
                     WHERE email = $1 AND verified = true AND used = false
                     AND created_at > NOW() - INTERVAL '15 minutes'
                     ORDER BY created_at DESC LIMIT 1`,
                    [email]
                );
                verificationRecord = result[0];
            } else {
                verificationRecord = db.prepare(
                    `SELECT * FROM verification_codes
                     WHERE email = ? AND verified = 1 AND used = 0
                     AND created_at > datetime('now', '-15 minutes')
                     ORDER BY created_at DESC LIMIT 1`
                ).get(email);
            }

            if (!verificationRecord) {
                return unauthorized(res, 'Verificação expirada. Solicite um novo código.', 'VERIFICATION_EXPIRED');
            }

            // Verificar se email já existe (dupla verificação)
            let existingUser;
            if (isPostgres) {
                const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
                existingUser = result[0];
            } else {
                existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            }

            if (existingUser) {
                return conflict(res, 'Este email já está cadastrado', 'EMAIL_EXISTS');
            }

            // Criar usuário com dados salvos na verificação
            let newUser;
            if (isPostgres) {
                const result = await db.query(
                    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
                    [verificationRecord.name, email, verificationRecord.password_hash]
                );
                newUser = result[0];
            } else {
                const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
                const info = stmt.run(verificationRecord.name, email, verificationRecord.password_hash);
                newUser = { id: info.lastInsertRowid, name: verificationRecord.name, email };
            }

            // Marcar código como usado
            if (isPostgres) {
                await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [verificationRecord.id]);
            } else {
                db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(verificationRecord.id);
            }

            // Gerar tokens
            const tokens = generateTokens(newUser);

            // Criar lista padrão "Minha Lista"
            let newList;
            if (isPostgres) {
                const listResult = await db.query(
                    `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                     VALUES ($1, 'Minha Lista', '📋', '#2563eb', true, 0)
                     RETURNING id`,
                    [newUser.id]
                );
                newList = listResult[0];
            } else {
                const stmt = db.prepare(
                    `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                     VALUES (?, 'Minha Lista', '📋', '#2563eb', 1, 0)`
                );
                const info = stmt.run(newUser.id);
                newList = { id: info.lastInsertRowid };
            }

            // Criar seção padrão "Tarefas" dentro da lista
            if (newList && newList.id) {
                if (isPostgres) {
                    await db.query(
                        `INSERT INTO sections (list_id, user_id, name, position)
                         VALUES ($1, $2, 'Tarefas', 0)`,
                        [newList.id, newUser.id]
                    );
                } else {
                    db.prepare(
                        `INSERT INTO sections (list_id, user_id, name, position)
                         VALUES (?, ?, 'Tarefas', 0)`
                    ).run(newList.id, newUser.id);
                }
            }

            console.log(`✅ Conta criada com verificação de email: ${email}`);

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
            console.error('❌ Erro ao criar conta verificada:', err);
            return error(res, 'Erro ao criar conta');
        }
    });

    // ===== REENVIAR CÓDIGO =====
    router.post('/resend-code', sendCodeLimiter, async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return badRequest(res, 'Email é obrigatório', 'MISSING_EMAIL');
            }

            // Buscar registro de verificação mais recente
            let verificationRecord;
            if (isPostgres) {
                const result = await db.query(
                    `SELECT * FROM verification_codes
                     WHERE email = $1 AND used = false
                     ORDER BY created_at DESC LIMIT 1`,
                    [email]
                );
                verificationRecord = result[0];
            } else {
                verificationRecord = db.prepare(
                    `SELECT * FROM verification_codes
                     WHERE email = ? AND used = 0
                     ORDER BY created_at DESC LIMIT 1`
                ).get(email);
            }

            if (!verificationRecord) {
                return badRequest(res, 'Nenhuma solicitação de cadastro encontrada para este email', 'NO_PENDING_REGISTRATION');
            }

            // Gerar novo código
            const newCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            // Invalidar código antigo e criar novo
            if (isPostgres) {
                await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [verificationRecord.id]);
                await db.query(
                    `INSERT INTO verification_codes (email, code, name, password_hash, type, expires_at)
                     VALUES ($1, $2, $3, $4, 'register', $5)`,
                    [email, newCode, verificationRecord.name, verificationRecord.password_hash, expiresAt]
                );
            } else {
                db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(verificationRecord.id);
                db.prepare(
                    `INSERT INTO verification_codes (email, code, name, password_hash, type, expires_at)
                     VALUES (?, ?, ?, ?, 'register', ?)`
                ).run(email, newCode, verificationRecord.name, verificationRecord.password_hash, expiresAt);
            }

            // Enviar email
            const emailResult = await enviarCodigoVerificacao(email, newCode, verificationRecord.name);

            if (!emailResult.success) {
                return error(res, 'Erro ao reenviar email. Tente novamente.');
            }

            console.log(`📧 Código reenviado ${newCode} para ${email}`);

            return success(res, {
                email: email,
                expiresIn: 600
            }, 'Novo código enviado para seu email');

        } catch (err) {
            console.error('❌ Erro ao reenviar código:', err);
            return error(res, 'Erro ao reenviar código');
        }
    });

    // ===== ESQUECI MINHA SENHA - ENVIAR CÓDIGO =====
    router.post('/forgot-password', sendCodeLimiter, async (req, res) => {
        try {
            const { email } = req.body;

            if (!email) {
                return badRequest(res, 'Email é obrigatório', 'MISSING_EMAIL');
            }

            // Verificar se email existe
            let user;
            if (isPostgres) {
                const result = await db.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
                user = result[0];
            } else {
                user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
            }

            if (!user) {
                // Por segurança, não revelamos se o email existe ou não
                return success(res, {
                    email: email,
                    expiresIn: 600
                }, 'Se este email estiver cadastrado, você receberá um código de recuperação');
            }

            // Gerar código de 6 dígitos
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Definir expiração (10 minutos)
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            // Invalidar códigos anteriores do mesmo email
            if (isPostgres) {
                await db.query(
                    "UPDATE verification_codes SET used = true WHERE email = $1 AND type = 'reset' AND used = false",
                    [email]
                );
            } else {
                db.prepare("UPDATE verification_codes SET used = 1 WHERE email = ? AND type = 'reset' AND used = 0").run(email);
            }

            // Salvar novo código
            if (isPostgres) {
                await db.query(
                    `INSERT INTO verification_codes (email, code, name, type, expires_at)
                     VALUES ($1, $2, $3, 'reset', $4)`,
                    [email, code, user.name, expiresAt]
                );
            } else {
                db.prepare(
                    `INSERT INTO verification_codes (email, code, name, type, expires_at)
                     VALUES (?, ?, ?, 'reset', ?)`
                ).run(email, code, user.name, expiresAt);
            }

            // Enviar email
            const { enviarCodigoRecuperacao } = require('../../emailService');
            const emailResult = await enviarCodigoRecuperacao(email, code, user.name);

            if (!emailResult.success) {
                return error(res, 'Erro ao enviar email de recuperação. Tente novamente.');
            }

            console.log(`📧 Código de recuperação ${code} enviado para ${email}`);

            return success(res, {
                email: email,
                expiresIn: 600
            }, 'Código de recuperação enviado para seu email');

        } catch (err) {
            console.error('❌ Erro ao enviar código de recuperação:', err);
            return error(res, 'Erro ao enviar código de recuperação');
        }
    });

    // ===== VERIFICAR CÓDIGO DE RECUPERAÇÃO =====
    router.post('/verify-reset-code', async (req, res) => {
        try {
            const { email, code } = req.body;

            if (!email || !code) {
                return badRequest(res, 'Email e código são obrigatórios', 'MISSING_FIELDS');
            }

            // Buscar código válido
            let verificationRecord;
            if (isPostgres) {
                const result = await db.query(
                    `SELECT * FROM verification_codes
                     WHERE email = $1 AND code = $2 AND type = 'reset' AND used = false AND expires_at > NOW()
                     ORDER BY created_at DESC LIMIT 1`,
                    [email, code]
                );
                verificationRecord = result[0];
            } else {
                verificationRecord = db.prepare(
                    `SELECT * FROM verification_codes
                     WHERE email = ? AND code = ? AND type = 'reset' AND used = 0 AND expires_at > datetime('now')
                     ORDER BY created_at DESC LIMIT 1`
                ).get(email, code);
            }

            if (!verificationRecord) {
                // Incrementar tentativas
                if (isPostgres) {
                    await db.query(
                        `UPDATE verification_codes SET attempts = attempts + 1
                         WHERE email = $1 AND type = 'reset' AND used = false
                         AND id = (SELECT id FROM verification_codes WHERE email = $1 AND type = 'reset' AND used = false ORDER BY created_at DESC LIMIT 1)`,
                        [email]
                    );
                }

                return unauthorized(res, 'Código inválido ou expirado', 'INVALID_CODE');
            }

            // Verificar número de tentativas
            if (verificationRecord.attempts >= 5) {
                return unauthorized(res, 'Muitas tentativas incorretas. Solicite um novo código.', 'TOO_MANY_ATTEMPTS');
            }

            // Marcar como verificado
            if (isPostgres) {
                await db.query(
                    'UPDATE verification_codes SET verified = true WHERE id = $1',
                    [verificationRecord.id]
                );
            } else {
                db.prepare('UPDATE verification_codes SET verified = 1 WHERE id = ?').run(verificationRecord.id);
            }

            console.log(`✅ Código de recuperação verificado para ${email}`);

            return success(res, {
                verified: true,
                email: email
            }, 'Código verificado com sucesso');

        } catch (err) {
            console.error('❌ Erro ao verificar código de recuperação:', err);
            return error(res, 'Erro ao verificar código');
        }
    });

    // ===== AUTENTICAÇÃO COM GOOGLE (via credential JWT) =====
    router.post('/google', async (req, res) => {
        try {
            const { credential } = req.body;

            if (!credential) {
                return badRequest(res, 'Token do Google é obrigatório', 'MISSING_CREDENTIAL');
            }

            // Verificar o token JWT do Google
            const { OAuth2Client } = require('google-auth-library');
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

            let payload;
            try {
                const ticket = await client.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID
                });
                payload = ticket.getPayload();
            } catch (verifyError) {
                console.error('❌ Erro ao verificar token Google:', verifyError);
                return unauthorized(res, 'Token do Google inválido', 'INVALID_GOOGLE_TOKEN');
            }

            const { email, name, picture, sub: googleId } = payload;

            if (!email) {
                return badRequest(res, 'Email não disponível na conta Google', 'NO_EMAIL');
            }

            // Verificar se usuário já existe
            let user;
            if (isPostgres) {
                const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
                user = result[0];
            } else {
                user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
            }

            if (user) {
                // Usuário existe - fazer login
                // Atualizar google_id se não tiver
                if (!user.google_id) {
                    if (isPostgres) {
                        await db.query('UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3', [googleId, picture, user.id]);
                    } else {
                        db.prepare('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?').run(googleId, picture, user.id);
                    }
                }

                // Gerar tokens
                const tokens = generateTokens(user);

                console.log(`✅ Login com Google: ${email}`);

                return success(res, {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        username: user.name,
                        avatar_url: picture || user.avatar_url
                    },
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresIn: 900,
                    isNewUser: false
                }, 'Login realizado com sucesso');

            } else {
                // Usuário não existe - criar conta
                let newUser;
                if (isPostgres) {
                    const result = await db.query(
                        'INSERT INTO users (name, email, google_id, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
                        [name, email, googleId, picture]
                    );
                    newUser = result[0];
                } else {
                    const stmt = db.prepare('INSERT INTO users (name, email, google_id, avatar_url) VALUES (?, ?, ?, ?)');
                    const info = stmt.run(name, email, googleId, picture);
                    newUser = { id: info.lastInsertRowid, name, email };
                }

                // Criar lista padrão "Minha Lista"
                let newList;
                if (isPostgres) {
                    const listResult = await db.query(
                        `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                         VALUES ($1, 'Minha Lista', '📋', '#2563eb', true, 0)
                         RETURNING id`,
                        [newUser.id]
                    );
                    newList = listResult[0];
                } else {
                    const stmt = db.prepare(
                        `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                         VALUES (?, 'Minha Lista', '📋', '#2563eb', 1, 0)`
                    );
                    const info = stmt.run(newUser.id);
                    newList = { id: info.lastInsertRowid };
                }

                // Criar seção padrão "Tarefas" dentro da lista
                if (newList && newList.id) {
                    if (isPostgres) {
                        await db.query(
                            `INSERT INTO sections (list_id, user_id, name, position)
                             VALUES ($1, $2, 'Tarefas', 0)`,
                            [newList.id, newUser.id]
                        );
                    } else {
                        db.prepare(
                            `INSERT INTO sections (list_id, user_id, name, position)
                             VALUES (?, ?, 'Tarefas', 0)`
                        ).run(newList.id, newUser.id);
                    }
                }

                // Gerar tokens
                const tokens = generateTokens(newUser);

                console.log(`✅ Conta criada com Google: ${email}`);

                return created(res, {
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        email: newUser.email,
                        username: newUser.name,
                        avatar_url: picture
                    },
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresIn: 900,
                    isNewUser: true
                }, 'Conta criada com sucesso');
            }

        } catch (err) {
            console.error('❌ Erro na autenticação Google:', err);
            return error(res, 'Erro ao autenticar com Google');
        }
    });

    // ===== AUTENTICAÇÃO COM GOOGLE (via userinfo - método alternativo) =====
    router.post('/google-userinfo', async (req, res) => {
        try {
            const { email, name, picture, sub: googleId } = req.body;

            if (!email) {
                return badRequest(res, 'Email é obrigatório', 'MISSING_EMAIL');
            }

            // Verificar se usuário já existe
            let user;
            if (isPostgres) {
                const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
                user = result[0];
            } else {
                user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
            }

            if (user) {
                // Usuário existe - fazer login
                if (!user.google_id && googleId) {
                    if (isPostgres) {
                        await db.query('UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3', [googleId, picture, user.id]);
                    } else {
                        db.prepare('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?').run(googleId, picture, user.id);
                    }
                }

                const tokens = generateTokens(user);

                console.log(`✅ Login com Google (userinfo): ${email}`);

                return success(res, {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        username: user.name,
                        avatar_url: picture || user.avatar_url
                    },
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresIn: 900,
                    isNewUser: false
                }, 'Login realizado com sucesso');

            } else {
                // Criar nova conta
                let newUser;
                if (isPostgres) {
                    const result = await db.query(
                        'INSERT INTO users (name, email, google_id, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
                        [name, email, googleId, picture]
                    );
                    newUser = result[0];
                } else {
                    const stmt = db.prepare('INSERT INTO users (name, email, google_id, avatar_url) VALUES (?, ?, ?, ?)');
                    const info = stmt.run(name, email, googleId, picture);
                    newUser = { id: info.lastInsertRowid, name, email };
                }

                // Criar lista padrão "Minha Lista"
                let newList;
                if (isPostgres) {
                    const listResult = await db.query(
                        `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                         VALUES ($1, 'Minha Lista', '📋', '#2563eb', true, 0)
                         RETURNING id`,
                        [newUser.id]
                    );
                    newList = listResult[0];
                } else {
                    const stmt = db.prepare(
                        `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                         VALUES (?, 'Minha Lista', '📋', '#2563eb', 1, 0)`
                    );
                    const info = stmt.run(newUser.id);
                    newList = { id: info.lastInsertRowid };
                }

                // Criar seção padrão "Tarefas" dentro da lista
                if (newList && newList.id) {
                    if (isPostgres) {
                        await db.query(
                            `INSERT INTO sections (list_id, user_id, name, position)
                             VALUES ($1, $2, 'Tarefas', 0)`,
                            [newList.id, newUser.id]
                        );
                    } else {
                        db.prepare(
                            `INSERT INTO sections (list_id, user_id, name, position)
                             VALUES (?, ?, 'Tarefas', 0)`
                        ).run(newList.id, newUser.id);
                    }
                }

                const tokens = generateTokens(newUser);

                console.log(`✅ Conta criada com Google (userinfo): ${email}`);

                return created(res, {
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        email: newUser.email,
                        username: newUser.name,
                        avatar_url: picture
                    },
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresIn: 900,
                    isNewUser: true
                }, 'Conta criada com sucesso');
            }

        } catch (err) {
            console.error('❌ Erro na autenticação Google (userinfo):', err);
            return error(res, 'Erro ao autenticar com Google');
        }
    });

    // ===== REDEFINIR SENHA =====
    router.post('/reset-password', async (req, res) => {
        try {
            const { email, newPassword } = req.body;

            if (!email || !newPassword) {
                return badRequest(res, 'Email e nova senha são obrigatórios', 'MISSING_FIELDS');
            }

            if (newPassword.length < 6) {
                return badRequest(res, 'Senha deve ter pelo menos 6 caracteres', 'INVALID_PASSWORD');
            }

            // Verificar se há código verificado recente (últimos 15 minutos)
            let verificationRecord;
            if (isPostgres) {
                const result = await db.query(
                    `SELECT * FROM verification_codes
                     WHERE email = $1 AND type = 'reset' AND verified = true AND used = false
                     AND created_at > NOW() - INTERVAL '15 minutes'
                     ORDER BY created_at DESC LIMIT 1`,
                    [email]
                );
                verificationRecord = result[0];
            } else {
                verificationRecord = db.prepare(
                    `SELECT * FROM verification_codes
                     WHERE email = ? AND type = 'reset' AND verified = 1 AND used = 0
                     AND created_at > datetime('now', '-15 minutes')
                     ORDER BY created_at DESC LIMIT 1`
                ).get(email);
            }

            if (!verificationRecord) {
                return unauthorized(res, 'Verificação expirada. Solicite um novo código.', 'VERIFICATION_EXPIRED');
            }

            // Hash da nova senha
            const hashedPassword = await hashPassword(newPassword);

            // Atualizar senha do usuário
            if (isPostgres) {
                await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
            } else {
                db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashedPassword, email);
            }

            // Marcar código como usado
            if (isPostgres) {
                await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [verificationRecord.id]);
            } else {
                db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(verificationRecord.id);
            }

            console.log(`✅ Senha redefinida para ${email}`);

            return success(res, {
                email: email
            }, 'Senha redefinida com sucesso');

        } catch (err) {
            console.error('❌ Erro ao redefinir senha:', err);
            return error(res, 'Erro ao redefinir senha');
        }
    });

    // ===== DEFINIR SENHA PARA CONTA GOOGLE =====
    router.post('/set-password-google', async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return badRequest(res, 'Email e senha são obrigatórios', 'MISSING_FIELDS');
            }

            if (password.length < 6) {
                return badRequest(res, 'Senha deve ter pelo menos 6 caracteres', 'INVALID_PASSWORD');
            }

            // Verificar se usuário existe e é conta Google
            let user;
            if (isPostgres) {
                const result = await db.query('SELECT id, email, password, google_id FROM users WHERE email = $1', [email]);
                user = result[0];
            } else {
                user = db.prepare('SELECT id, email, password, google_id FROM users WHERE email = ?').get(email);
            }

            if (!user) {
                return badRequest(res, 'Usuário não encontrado', 'USER_NOT_FOUND');
            }

            if (!user.google_id) {
                return badRequest(res, 'Esta funcionalidade é apenas para contas criadas com Google', 'NOT_GOOGLE_ACCOUNT');
            }

            if (user.password) {
                return badRequest(res, 'Esta conta já possui senha definida', 'PASSWORD_ALREADY_SET');
            }

            // Hash da nova senha
            const hashedPassword = await hashPassword(password);

            // Atualizar senha do usuário
            if (isPostgres) {
                await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
            } else {
                db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
            }

            console.log(`✅ Senha definida para conta Google: ${email}`);

            // Gerar tokens para login automático
            const tokens = generateTokens(user);

            return success(res, {
                user: {
                    id: user.id,
                    email: user.email
                },
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            }, 'Senha definida com sucesso! Agora você pode fazer login com email e senha.');

        } catch (err) {
            console.error('❌ Erro ao definir senha:', err);
            return error(res, 'Erro ao definir senha');
        }
    });

    return router;
};
