/* ========================================
   MIDDLEWARE DE VERIFICAÇÃO DE PLANOS
   Verifica limites e funcionalidades
   ======================================== */

const {
    getPlan,
    isLimitReached,
    hasFeature,
    getLimit,
    getLimitMessage,
    getFeatureBlockedMessage
} = require('../config/plans');

/**
 * Obtém o plano do usuário do banco de dados
 */
async function getUserPlan(db, isPostgres, userId) {
    try {
        let user;
        if (isPostgres) {
            const result = await db.query(
                'SELECT plan, plan_expires_at FROM users WHERE id = $1',
                [userId]
            );
            user = result[0];
        } else {
            user = db.prepare('SELECT plan, plan_expires_at FROM users WHERE id = ?').get(userId);
        }

        if (!user) return 'normal';

        // Verificar se o plano expirou
        if (user.plan_expires_at) {
            const expiresAt = new Date(user.plan_expires_at);
            if (expiresAt < new Date()) {
                // Plano expirado - rebaixar para normal
                if (isPostgres) {
                    await db.query(
                        'UPDATE users SET plan = $1, plan_expires_at = NULL WHERE id = $2',
                        ['normal', userId]
                    );
                } else {
                    db.prepare('UPDATE users SET plan = ?, plan_expires_at = NULL WHERE id = ?')
                        .run('normal', userId);
                }
                return 'normal';
            }
        }

        return user.plan || 'normal';
    } catch (error) {
        console.error('❌ Erro ao obter plano do usuário:', error);
        return 'normal';
    }
}

/**
 * Conta recursos do usuário
 */
async function countUserResources(db, isPostgres, userId, resource) {
    try {
        let count = 0;
        let query;

        switch (resource) {
            case 'tasks':
                query = isPostgres
                    ? "SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND status != 'completed'"
                    : "SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status != 'completed'";
                break;

            case 'lists':
                query = isPostgres
                    ? 'SELECT COUNT(*) as count FROM lists WHERE user_id = $1'
                    : 'SELECT COUNT(*) as count FROM lists WHERE user_id = ?';
                break;

            case 'sections':
                // Conta seções de uma lista específica (precisa do listId)
                return 0; // Será tratado separadamente

            case 'subtasks':
                // Conta subtarefas de uma tarefa específica (precisa do taskId)
                return 0; // Será tratado separadamente

            default:
                return 0;
        }

        if (isPostgres) {
            const result = await db.query(query, [userId]);
            count = parseInt(result[0]?.count || 0);
        } else {
            const result = db.prepare(query).get(userId);
            count = parseInt(result?.count || 0);
        }

        return count;
    } catch (error) {
        console.error('❌ Erro ao contar recursos:', error);
        return 0;
    }
}

/**
 * Conta seções de uma lista
 */
async function countSectionsInList(db, isPostgres, listId) {
    try {
        const query = isPostgres
            ? 'SELECT COUNT(*) as count FROM sections WHERE list_id = $1'
            : 'SELECT COUNT(*) as count FROM sections WHERE list_id = ?';

        if (isPostgres) {
            const result = await db.query(query, [listId]);
            return parseInt(result[0]?.count || 0);
        } else {
            const result = db.prepare(query).get(listId);
            return parseInt(result?.count || 0);
        }
    } catch (error) {
        console.error('❌ Erro ao contar seções:', error);
        return 0;
    }
}

/**
 * Conta subtarefas de uma tarefa
 */
async function countSubtasksInTask(db, isPostgres, taskId) {
    try {
        const query = isPostgres
            ? 'SELECT COUNT(*) as count FROM subtasks WHERE task_id = $1'
            : 'SELECT COUNT(*) as count FROM subtasks WHERE task_id = ?';

        if (isPostgres) {
            const result = await db.query(query, [taskId]);
            return parseInt(result[0]?.count || 0);
        } else {
            const result = db.prepare(query).get(taskId);
            return parseInt(result?.count || 0);
        }
    } catch (error) {
        console.error('❌ Erro ao contar subtarefas:', error);
        return 0;
    }
}

/**
 * Conta uso de IA do usuário (hoje/semana)
 */
async function countAIUsage(db, isPostgres, userId, type, period = 'day') {
    try {
        let dateCondition;
        if (period === 'day') {
            dateCondition = isPostgres
                ? "created_at >= CURRENT_DATE"
                : "date(created_at) = date('now')";
        } else if (period === 'week') {
            dateCondition = isPostgres
                ? "created_at >= CURRENT_DATE - INTERVAL '7 days'"
                : "created_at >= date('now', '-7 days')";
        }

        const query = isPostgres
            ? `SELECT COUNT(*) as count FROM ai_usage WHERE user_id = $1 AND type = $2 AND ${dateCondition}`
            : `SELECT COUNT(*) as count FROM ai_usage WHERE user_id = ? AND type = ? AND ${dateCondition}`;

        if (isPostgres) {
            const result = await db.query(query, [userId, type]);
            return parseInt(result[0]?.count || 0);
        } else {
            const result = db.prepare(query).get(userId, type);
            return parseInt(result?.count || 0);
        }
    } catch (error) {
        // Tabela pode não existir ainda
        return 0;
    }
}

/**
 * Registra uso de IA
 */
async function logAIUsage(db, isPostgres, userId, type) {
    try {
        const query = isPostgres
            ? 'INSERT INTO ai_usage (user_id, type, created_at) VALUES ($1, $2, NOW())'
            : "INSERT INTO ai_usage (user_id, type, created_at) VALUES (?, ?, datetime('now'))";

        if (isPostgres) {
            await db.query(query, [userId, type]);
        } else {
            db.prepare(query).run(userId, type);
        }
    } catch (error) {
        console.error('❌ Erro ao registrar uso de IA:', error);
    }
}

/**
 * Middleware factory para verificar limite de recurso
 */
function checkLimit(resource) {
    return (db, isPostgres) => async (req, res, next) => {
        try {
            const userId = req.user?.id || req.body?.user_id || req.query?.user_id;

            if (!userId) {
                return next(); // Sem usuário, deixa passar (será tratado por outro middleware)
            }

            const userPlan = await getUserPlan(db, isPostgres, userId);
            const limit = getLimit(userPlan, resource);

            // -1 = ilimitado
            if (limit === -1) {
                req.userPlan = userPlan;
                return next();
            }

            const currentCount = await countUserResources(db, isPostgres, userId, resource);

            if (isLimitReached(currentCount, limit)) {
                return res.status(403).json({
                    success: false,
                    error: getLimitMessage(resource, userPlan),
                    code: 'PLAN_LIMIT_REACHED',
                    limit: limit,
                    current: currentCount,
                    plan: userPlan,
                    upgrade: userPlan === 'normal' ? 'pro' : 'promax'
                });
            }

            req.userPlan = userPlan;
            req.planLimits = { [resource]: { limit, current: currentCount } };
            next();
        } catch (error) {
            console.error('❌ Erro no middleware de limite:', error);
            next(); // Em caso de erro, deixa passar
        }
    };
}

/**
 * Middleware factory para verificar funcionalidade
 */
function checkFeature(feature) {
    return (db, isPostgres) => async (req, res, next) => {
        try {
            const userId = req.user?.id || req.body?.user_id || req.query?.user_id;

            if (!userId) {
                return next();
            }

            const userPlan = await getUserPlan(db, isPostgres, userId);

            if (!hasFeature(userPlan, feature)) {
                return res.status(403).json({
                    success: false,
                    error: getFeatureBlockedMessage(feature, userPlan),
                    code: 'FEATURE_NOT_AVAILABLE',
                    feature: feature,
                    plan: userPlan,
                    upgrade: userPlan === 'normal' ? 'pro' : 'promax'
                });
            }

            req.userPlan = userPlan;
            next();
        } catch (error) {
            console.error('❌ Erro no middleware de feature:', error);
            next();
        }
    };
}

/**
 * Middleware factory para verificar limite de IA
 */
function checkAILimit(type, period = 'day') {
    return (db, isPostgres) => async (req, res, next) => {
        try {
            const userId = req.user?.id || req.body?.user_id || req.query?.user_id;

            if (!userId) {
                return next();
            }

            const userPlan = await getUserPlan(db, isPostgres, userId);
            const plan = getPlan(userPlan);

            // Verificar se IA está habilitada
            if (!plan.ai.enabled) {
                return res.status(403).json({
                    success: false,
                    error: getFeatureBlockedMessage('ai', userPlan),
                    code: 'AI_NOT_AVAILABLE',
                    plan: userPlan,
                    upgrade: 'pro'
                });
            }

            // Mapear tipo para limite
            const limitMap = {
                'routine': { limit: plan.ai.routinesPerWeek, period: 'week' },
                'description': { limit: plan.ai.descriptionsPerDay, period: 'day' },
                'subtask': { limit: plan.ai.subtasksPerDay, period: 'day' },
            };

            const config = limitMap[type];
            if (!config) {
                return next();
            }

            const limit = config.limit;

            // -1 = ilimitado
            if (limit === -1) {
                req.userPlan = userPlan;
                return next();
            }

            const currentUsage = await countAIUsage(db, isPostgres, userId, type, config.period);

            if (isLimitReached(currentUsage, limit)) {
                const periodText = config.period === 'day' ? 'hoje' : 'esta semana';
                return res.status(403).json({
                    success: false,
                    error: `Você atingiu o limite de ${limit} ${type === 'routine' ? 'rotinas' : type === 'description' ? 'descrições' : 'subtarefas com IA'} ${periodText} do plano ${plan.name}.`,
                    code: 'AI_LIMIT_REACHED',
                    limit: limit,
                    current: currentUsage,
                    plan: userPlan,
                    upgrade: userPlan === 'pro' ? 'promax' : 'pro'
                });
            }

            // Adicionar função para registrar uso após sucesso
            req.logAIUsage = () => logAIUsage(db, isPostgres, userId, type);
            req.userPlan = userPlan;
            next();
        } catch (error) {
            console.error('❌ Erro no middleware de IA:', error);
            next();
        }
    };
}

/**
 * Middleware para verificar limite de seções em uma lista
 */
function checkSectionLimit(db, isPostgres) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id || req.body?.user_id;
            const listId = req.body?.list_id || req.params?.listId;

            if (!userId || !listId) {
                return next();
            }

            const userPlan = await getUserPlan(db, isPostgres, userId);
            const limit = getLimit(userPlan, 'sectionsPerList');

            if (limit === -1) {
                req.userPlan = userPlan;
                return next();
            }

            const currentCount = await countSectionsInList(db, isPostgres, listId);

            if (isLimitReached(currentCount, limit)) {
                return res.status(403).json({
                    success: false,
                    error: getLimitMessage('sectionsPerList', userPlan),
                    code: 'PLAN_LIMIT_REACHED',
                    limit: limit,
                    current: currentCount,
                    plan: userPlan,
                    upgrade: userPlan === 'normal' ? 'pro' : 'promax'
                });
            }

            req.userPlan = userPlan;
            next();
        } catch (error) {
            console.error('❌ Erro no middleware de seções:', error);
            next();
        }
    };
}

/**
 * Middleware para verificar limite de subtarefas em uma tarefa
 */
function checkSubtaskLimit(db, isPostgres) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id || req.body?.user_id;
            const taskId = req.body?.task_id || req.params?.taskId;

            if (!userId || !taskId) {
                return next();
            }

            const userPlan = await getUserPlan(db, isPostgres, userId);
            const limit = getLimit(userPlan, 'subtasksPerTask');

            if (limit === -1) {
                req.userPlan = userPlan;
                return next();
            }

            const currentCount = await countSubtasksInTask(db, isPostgres, taskId);

            if (isLimitReached(currentCount, limit)) {
                return res.status(403).json({
                    success: false,
                    error: getLimitMessage('subtasksPerTask', userPlan),
                    code: 'PLAN_LIMIT_REACHED',
                    limit: limit,
                    current: currentCount,
                    plan: userPlan,
                    upgrade: userPlan === 'normal' ? 'pro' : 'promax'
                });
            }

            req.userPlan = userPlan;
            next();
        } catch (error) {
            console.error('❌ Erro no middleware de subtarefas:', error);
            next();
        }
    };
}

/**
 * Middleware para adicionar info do plano à requisição
 */
function attachPlanInfo(db, isPostgres) {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id || req.body?.user_id || req.query?.user_id;

            if (userId) {
                const userPlan = await getUserPlan(db, isPostgres, userId);
                req.userPlan = userPlan;
                req.planConfig = getPlan(userPlan);
            }

            next();
        } catch (error) {
            next();
        }
    };
}

module.exports = {
    getUserPlan,
    countUserResources,
    countSectionsInList,
    countSubtasksInTask,
    countAIUsage,
    logAIUsage,
    checkLimit,
    checkFeature,
    checkAILimit,
    checkSectionLimit,
    checkSubtaskLimit,
    attachPlanInfo,
};
