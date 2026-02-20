/* ========================================
   ROTAS DE PLANOS V1 - NURA
   Gerenciamento de planos e assinaturas
   ======================================== */

const express = require('express');
const router = express.Router();
const {
    PLANS,
    getPlan,
    getAllPlans,
    isPaidPlan,
    getLimit,
    hasFeature
} = require('../../config/plans');
const {
    getUserPlan,
    countUserResources,
    countAIUsage
} = require('../../middleware/planLimits');

module.exports = function(db, isPostgres) {

    // ===== LISTAR TODOS OS PLANOS =====
    router.get('/', (req, res) => {
        try {
            const plans = getAllPlans().map(plan => ({
                id: plan.id,
                name: plan.name,
                price: plan.price,
                priceMonthly: plan.priceMonthly,
                description: plan.description,
                limits: plan.limits,
                features: {
                    kanban: plan.features.kanban,
                    smartFilters: plan.features.smartFilters,
                    dragAndDrop: plan.features.dragAndDrop,
                    statistics: plan.features.statistics,
                    customColors: plan.features.customColors,
                },
                ai: {
                    enabled: plan.ai.enabled,
                    routinesPerWeek: plan.ai.routinesPerWeek,
                    descriptionsPerDay: plan.ai.descriptionsPerDay,
                    subtasksPerDay: plan.ai.subtasksPerDay,
                    weeklyReport: plan.ai.weeklyReport,
                },
                notifications: plan.notifications,
                storage: plan.storage,
            }));

            res.json({
                success: true,
                plans: plans
            });
        } catch (error) {
            console.error('❌ Erro ao listar planos:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao listar planos'
            });
        }
    });

    // ===== OBTER PLANO DO USUÁRIO ATUAL =====
    router.get('/my-plan', async (req, res) => {
        try {
            const userId = req.user?.id || req.query?.user_id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }

            // Buscar plano, expiração e contagens tudo em paralelo
            const expiryQuery = isPostgres
                ? db.query('SELECT plan_expires_at FROM users WHERE id = $1', [userId]).then(r => r[0]?.plan_expires_at ?? null)
                : Promise.resolve(db.prepare('SELECT plan_expires_at FROM users WHERE id = ?').get(userId)?.plan_expires_at ?? null);

            const [
                userPlan,
                expiresAt,
                tasksCount,
                listsCount,
                routinesThisWeek,
                descriptionsToday,
                subtasksToday,
            ] = await Promise.all([
                getUserPlan(db, isPostgres, userId),
                expiryQuery,
                countUserResources(db, isPostgres, userId, 'tasks'),
                countUserResources(db, isPostgres, userId, 'lists'),
                countAIUsage(db, isPostgres, userId, 'routine', 'week'),
                countAIUsage(db, isPostgres, userId, 'description', 'day'),
                countAIUsage(db, isPostgres, userId, 'subtask', 'day'),
            ]);

            const planConfig = getPlan(userPlan);

            res.json({
                success: true,
                plan: {
                    id: planConfig.id,
                    name: planConfig.name,
                    price: planConfig.price,
                    expiresAt: expiresAt,
                    isActive: true,
                    isPaid: isPaidPlan(userPlan)
                },
                usage: {
                    tasks: {
                        current: tasksCount,
                        limit: planConfig.limits.tasks,
                        unlimited: planConfig.limits.tasks === -1
                    },
                    lists: {
                        current: listsCount,
                        limit: planConfig.limits.lists,
                        unlimited: planConfig.limits.lists === -1
                    },
                    ai: {
                        enabled: planConfig.ai.enabled,
                        routines: {
                            current: routinesThisWeek,
                            limit: planConfig.ai.routinesPerWeek,
                            unlimited: planConfig.ai.routinesPerWeek === -1,
                            period: 'week'
                        },
                        descriptions: {
                            current: descriptionsToday,
                            limit: planConfig.ai.descriptionsPerDay,
                            unlimited: planConfig.ai.descriptionsPerDay === -1,
                            period: 'day'
                        },
                        subtasks: {
                            current: subtasksToday,
                            limit: planConfig.ai.subtasksPerDay,
                            unlimited: planConfig.ai.subtasksPerDay === -1,
                            period: 'day'
                        }
                    }
                },
                features: planConfig.features,
                limits: planConfig.limits
            });

        } catch (error) {
            console.error('❌ Erro ao obter plano:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter informações do plano'
            });
        }
    });

    // ===== VERIFICAR SE PODE USAR FEATURE =====
    router.get('/can-use/:feature', async (req, res) => {
        try {
            const userId = req.user?.id || req.query?.user_id;
            const { feature } = req.params;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }

            const userPlan = await getUserPlan(db, isPostgres, userId);
            const canUse = hasFeature(userPlan, feature);
            const planConfig = getPlan(userPlan);

            res.json({
                success: true,
                feature: feature,
                canUse: canUse,
                plan: userPlan,
                upgrade: canUse ? null : (userPlan === 'normal' ? 'pro' : 'promax')
            });

        } catch (error) {
            console.error('❌ Erro ao verificar feature:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao verificar funcionalidade'
            });
        }
    });

    // ===== VERIFICAR LIMITE =====
    router.get('/check-limit/:resource', async (req, res) => {
        try {
            const userId = req.user?.id || req.query?.user_id;
            const { resource } = req.params;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }

            const userPlan = await getUserPlan(db, isPostgres, userId);
            const limit = getLimit(userPlan, resource);
            const current = await countUserResources(db, isPostgres, userId, resource);

            const canCreate = limit === -1 || current < limit;

            res.json({
                success: true,
                resource: resource,
                current: current,
                limit: limit,
                unlimited: limit === -1,
                canCreate: canCreate,
                remaining: limit === -1 ? null : Math.max(0, limit - current),
                plan: userPlan
            });

        } catch (error) {
            console.error('❌ Erro ao verificar limite:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao verificar limite'
            });
        }
    });

    // ===== UPGRADE DE PLANO (ADMIN/TESTE) =====
    router.post('/upgrade', async (req, res) => {
        try {
            const userId = req.user?.id || req.body?.user_id;
            const { plan, months = 1 } = req.body;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }

            // Validar plano
            if (!['normal', 'pro', 'promax'].includes(plan)) {
                return res.status(400).json({
                    success: false,
                    error: 'Plano inválido. Use: normal, pro ou promax'
                });
            }

            // Calcular data de expiração (30 dias por mês)
            const expiresAt = plan === 'normal' ? null : new Date(Date.now() + (months * 30 * 24 * 60 * 60 * 1000));

            // Atualizar plano do usuário
            if (isPostgres) {
                await db.query(
                    'UPDATE users SET plan = $1, plan_expires_at = $2 WHERE id = $3',
                    [plan, expiresAt, userId]
                );

                // Registrar assinatura
                if (plan !== 'normal') {
                    const planConfig = getPlan(plan);
                    await db.query(`
                        INSERT INTO subscriptions (user_id, plan, status, amount, expires_at)
                        VALUES ($1, $2, 'active', $3, $4)
                    `, [userId, plan, planConfig.price * months, expiresAt]);
                }
            } else {
                db.prepare(
                    'UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?'
                ).run(plan, expiresAt ? expiresAt.toISOString() : null, userId);

                // Registrar assinatura
                if (plan !== 'normal') {
                    const planConfig = getPlan(plan);
                    db.prepare(`
                        INSERT INTO subscriptions (user_id, plan, status, amount, expires_at)
                        VALUES (?, ?, 'active', ?, ?)
                    `).run(userId, plan, planConfig.price * months, expiresAt.toISOString());
                }
            }

            const planConfig = getPlan(plan);

            res.json({
                success: true,
                message: `Plano atualizado para ${planConfig.name}!`,
                plan: {
                    id: plan,
                    name: planConfig.name,
                    expiresAt: expiresAt,
                    price: planConfig.price * months
                }
            });

        } catch (error) {
            console.error('❌ Erro ao fazer upgrade:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao atualizar plano'
            });
        }
    });

    // ===== CANCELAR ASSINATURA =====
    router.post('/cancel', async (req, res) => {
        try {
            const userId = req.user?.id || req.body?.user_id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }

            // Rebaixar para normal
            if (isPostgres) {
                await db.query(
                    'UPDATE users SET plan = $1, plan_expires_at = NULL WHERE id = $2',
                    ['normal', userId]
                );

                // Marcar assinatura como cancelada
                await db.query(`
                    UPDATE subscriptions
                    SET status = 'cancelled', cancelled_at = NOW()
                    WHERE user_id = $1 AND status = 'active'
                `, [userId]);
            } else {
                db.prepare(
                    'UPDATE users SET plan = ?, plan_expires_at = NULL WHERE id = ?'
                ).run('normal', userId);

                db.prepare(`
                    UPDATE subscriptions
                    SET status = 'cancelled', cancelled_at = datetime('now')
                    WHERE user_id = ? AND status = 'active'
                `).run(userId);
            }

            res.json({
                success: true,
                message: 'Assinatura cancelada. Seu plano foi alterado para Normal.',
                plan: {
                    id: 'normal',
                    name: 'Normal'
                }
            });

        } catch (error) {
            console.error('❌ Erro ao cancelar assinatura:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao cancelar assinatura'
            });
        }
    });

    // ===== HISTÓRICO DE ASSINATURAS =====
    router.get('/history', async (req, res) => {
        try {
            const userId = req.user?.id || req.query?.user_id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado'
                });
            }

            let subscriptions;
            if (isPostgres) {
                subscriptions = await db.query(`
                    SELECT id, plan, status, amount, currency, started_at, expires_at, cancelled_at
                    FROM subscriptions
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT 20
                `, [userId]);
            } else {
                subscriptions = db.prepare(`
                    SELECT id, plan, status, amount, currency, started_at, expires_at, cancelled_at
                    FROM subscriptions
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT 20
                `).all(userId);
            }

            res.json({
                success: true,
                subscriptions: subscriptions || []
            });

        } catch (error) {
            console.error('❌ Erro ao buscar histórico:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao buscar histórico de assinaturas'
            });
        }
    });

    // ===== COMPARAR PLANOS =====
    router.get('/compare', (req, res) => {
        try {
            const plans = getAllPlans();

            const comparison = {
                limits: {
                    tasks: plans.map(p => ({ plan: p.name, value: p.limits.tasks === -1 ? 'Ilimitado' : p.limits.tasks })),
                    lists: plans.map(p => ({ plan: p.name, value: p.limits.lists === -1 ? 'Ilimitado' : p.limits.lists })),
                    sectionsPerList: plans.map(p => ({ plan: p.name, value: p.limits.sectionsPerList === -1 ? 'Ilimitado' : p.limits.sectionsPerList })),
                    subtasksPerTask: plans.map(p => ({ plan: p.name, value: p.limits.subtasksPerTask === -1 ? 'Ilimitado' : p.limits.subtasksPerTask })),
                },
                features: {
                    kanban: plans.map(p => ({ plan: p.name, available: p.features.kanban })),
                    smartFilters: plans.map(p => ({ plan: p.name, available: p.features.smartFilters })),
                    dragAndDrop: plans.map(p => ({ plan: p.name, available: p.features.dragAndDrop })),
                    statistics: plans.map(p => ({ plan: p.name, value: p.features.statistics })),
                },
                ai: {
                    enabled: plans.map(p => ({ plan: p.name, available: p.ai.enabled })),
                    routinesPerWeek: plans.map(p => ({ plan: p.name, value: p.ai.routinesPerWeek === -1 ? 'Ilimitado' : p.ai.routinesPerWeek })),
                    descriptionsPerDay: plans.map(p => ({ plan: p.name, value: p.ai.descriptionsPerDay === -1 ? 'Ilimitado' : p.ai.descriptionsPerDay })),
                    weeklyReport: plans.map(p => ({ plan: p.name, available: p.ai.weeklyReport })),
                },
                notifications: {
                    telegram: plans.map(p => ({ plan: p.name, available: p.notifications.telegram })),
                    whatsapp: plans.map(p => ({ plan: p.name, available: p.notifications.whatsapp })),
                    push: plans.map(p => ({ plan: p.name, available: p.notifications.push })),
                },
                pricing: plans.map(p => ({
                    plan: p.name,
                    price: p.price,
                    description: p.description
                }))
            };

            res.json({
                success: true,
                comparison: comparison
            });

        } catch (error) {
            console.error('❌ Erro ao comparar planos:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao comparar planos'
            });
        }
    });

    return router;
};
