/* ========================================
   CONFIGURAÇÃO DE PLANOS - NURA
   Normal, Pro, ProMax
   ======================================== */

const PLANS = {
    // ===== PLANO NORMAL (GRATUITO) =====
    normal: {
        id: 'normal',
        name: 'Normal',
        price: 0,
        priceMonthly: 0,
        description: 'Plano gratuito com recursos básicos',

        // Limites de quantidade
        limits: {
            tasks: 100,              // Máximo de tarefas ativas
            lists: 5,                // Máximo de listas/cadernos
            sectionsPerList: 3,      // Máximo de seções por lista
            subtasksPerTask: 5,      // Máximo de subtarefas por tarefa
        },

        // Limites de IA
        ai: {
            enabled: false,
            routinesPerWeek: 0,      // Geração de rotinas
            descriptionsPerDay: 0,   // Descrições automáticas
            subtasksPerDay: 0,       // Geração de subtarefas com IA
            detailLevel: 'baixo',    // Nível de detalhe
            weeklyReport: false,     // Relatório semanal com IA
        },

        // Funcionalidades
        features: {
            kanban: false,           // Modo Kanban
            smartFilters: false,     // Filtros inteligentes
            dragAndDrop: false,      // Drag & drop de tarefas
            statistics: 'basic',     // basic, advanced, complete
            customColors: 1,         // Quantidade de cores customizáveis
            darkMode: true,          // Modo escuro
        },

        // Notificações
        notifications: {
            emailFrequency: 'weekly',  // weekly, 3x_week, daily
            telegram: false,
            whatsapp: false,
            push: false,
        },

        // Armazenamento
        storage: {
            historyDays: 30,         // Histórico de tarefas concluídas
            trashDays: 0,            // Lixeira (0 = sem lixeira)
            backup: false,           // Backup automático
            export: false,           // Exportar dados
        },
    },

    // ===== PLANO PRO =====
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 14.90,
        priceMonthly: 14.90,
        description: 'Para quem quer mais produtividade',

        limits: {
            tasks: 500,
            lists: 20,
            sectionsPerList: 10,
            subtasksPerTask: 20,
        },

        ai: {
            enabled: true,
            routinesPerWeek: 5,
            descriptionsPerDay: 10,
            subtasksPerDay: 5,
            detailLevel: 'medio',
            weeklyReport: true,
        },

        features: {
            kanban: true,
            smartFilters: true,
            dragAndDrop: true,
            statistics: 'advanced',
            customColors: 5,
            darkMode: true,
        },

        notifications: {
            emailFrequency: '3x_week',
            telegram: true,
            whatsapp: false,
            push: true,
        },

        storage: {
            historyDays: 365,
            trashDays: 30,
            backup: 'monthly',
            export: 'csv',
        },
    },

    // ===== PLANO PROMAX =====
    promax: {
        id: 'promax',
        name: 'ProMax',
        price: 29.90,
        priceMonthly: 29.90,
        description: 'Recursos ilimitados para máxima produtividade',

        limits: {
            tasks: -1,               // -1 = ilimitado
            lists: -1,
            sectionsPerList: -1,
            subtasksPerTask: -1,
        },

        ai: {
            enabled: true,
            routinesPerWeek: -1,
            descriptionsPerDay: -1,
            subtasksPerDay: -1,
            detailLevel: 'alto',
            weeklyReport: true,
        },

        features: {
            kanban: true,
            smartFilters: true,
            dragAndDrop: true,
            statistics: 'complete',
            customColors: -1,
            darkMode: true,
        },

        notifications: {
            emailFrequency: 'daily',
            telegram: true,
            whatsapp: true,
            push: true,
        },

        storage: {
            historyDays: -1,         // -1 = ilimitado
            trashDays: 90,
            backup: 'weekly',
            export: 'csv_pdf',
        },
    },
};

// ===== FUNÇÕES AUXILIARES =====

/**
 * Obtém configuração de um plano
 */
function getPlan(planId) {
    return PLANS[planId] || PLANS.normal;
}

/**
 * Verifica se um limite foi atingido
 * @param {number} current - Quantidade atual
 * @param {number} limit - Limite do plano (-1 = ilimitado)
 * @returns {boolean} - true se atingiu o limite
 */
function isLimitReached(current, limit) {
    if (limit === -1) return false; // Ilimitado
    return current >= limit;
}

/**
 * Verifica se uma funcionalidade está disponível
 */
function hasFeature(planId, feature) {
    const plan = getPlan(planId);

    // Verificar em features
    if (plan.features && plan.features[feature] !== undefined) {
        return !!plan.features[feature];
    }

    // Verificar em ai
    if (plan.ai && plan.ai[feature] !== undefined) {
        return !!plan.ai[feature];
    }

    // Verificar em notifications
    if (plan.notifications && plan.notifications[feature] !== undefined) {
        return !!plan.notifications[feature];
    }

    return false;
}

/**
 * Obtém o limite de um recurso
 */
function getLimit(planId, resource) {
    const plan = getPlan(planId);

    // Verificar em limits
    if (plan.limits && plan.limits[resource] !== undefined) {
        return plan.limits[resource];
    }

    // Verificar em ai
    if (plan.ai && plan.ai[resource] !== undefined) {
        return plan.ai[resource];
    }

    // Verificar em storage
    if (plan.storage && plan.storage[resource] !== undefined) {
        return plan.storage[resource];
    }

    return 0;
}

/**
 * Verifica se o plano é pago
 */
function isPaidPlan(planId) {
    const plan = getPlan(planId);
    return plan.price > 0;
}

/**
 * Lista todos os planos
 */
function getAllPlans() {
    return Object.values(PLANS);
}

/**
 * Compara dois planos (retorna qual é superior)
 */
function comparePlans(planA, planB) {
    const order = { normal: 0, pro: 1, promax: 2 };
    return order[planB] - order[planA];
}

/**
 * Gera mensagem de erro quando limite é atingido
 */
function getLimitMessage(resource, planId) {
    const plan = getPlan(planId);
    const limit = getLimit(planId, resource);

    const messages = {
        tasks: `Você atingiu o limite de ${limit} tarefas do plano ${plan.name}. Faça upgrade para criar mais.`,
        lists: `Você atingiu o limite de ${limit} listas do plano ${plan.name}. Faça upgrade para criar mais.`,
        sectionsPerList: `Você atingiu o limite de ${limit} seções por lista do plano ${plan.name}. Faça upgrade para criar mais.`,
        subtasksPerTask: `Você atingiu o limite de ${limit} subtarefas por tarefa do plano ${plan.name}. Faça upgrade para criar mais.`,
        routinesPerWeek: `Você atingiu o limite de ${limit} rotinas por semana do plano ${plan.name}. Faça upgrade para gerar mais.`,
        descriptionsPerDay: `Você atingiu o limite de ${limit} descrições por dia do plano ${plan.name}. Faça upgrade para gerar mais.`,
        subtasksPerDay: `Você atingiu o limite de ${limit} subtarefas com IA por dia do plano ${plan.name}. Faça upgrade para gerar mais.`,
    };

    return messages[resource] || `Limite atingido no plano ${plan.name}. Faça upgrade para continuar.`;
}

/**
 * Gera mensagem de funcionalidade bloqueada
 */
function getFeatureBlockedMessage(feature, planId) {
    const plan = getPlan(planId);

    const messages = {
        kanban: `Modo Kanban não disponível no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
        smartFilters: `Filtros inteligentes não disponíveis no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
        dragAndDrop: `Arrastar e soltar não disponível no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
        telegram: `Notificações via Telegram não disponíveis no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
        whatsapp: `Notificações via WhatsApp não disponíveis no plano ${plan.name}. Faça upgrade para ProMax.`,
        ai: `Funcionalidades de IA não disponíveis no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
        weeklyReport: `Relatório semanal com IA não disponível no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
        export: `Exportação de dados não disponível no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
        backup: `Backup automático não disponível no plano ${plan.name}. Faça upgrade para Pro ou ProMax.`,
    };

    return messages[feature] || `Funcionalidade não disponível no plano ${plan.name}. Faça upgrade para continuar.`;
}

module.exports = {
    PLANS,
    getPlan,
    isLimitReached,
    hasFeature,
    getLimit,
    isPaidPlan,
    getAllPlans,
    comparePlans,
    getLimitMessage,
    getFeatureBlockedMessage,
};
