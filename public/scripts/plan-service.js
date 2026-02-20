/* ========================================
   SERVIÇO DE PLANOS - NURA
   Gerencia verificação de planos no frontend
   ======================================== */

const PLAN_API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// Cache do plano atual
let cachedPlanInfo = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtém informações do plano do usuário atual
 */
async function getMyPlan(forceRefresh = false) {
    try {
        // Verificar cache
        if (!forceRefresh && cachedPlanInfo && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
            return cachedPlanInfo;
        }

        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        if (!userId) {
            console.warn('⚠️ Usuário não logado');
            return null;
        }

        const response = await fetchWithAuth(`${PLAN_API_URL}/api/plans/my-plan?user_id=${userId}`);
        const data = await response.json();

        if (data.success) {
            cachedPlanInfo = data;
            cacheTimestamp = Date.now();
            // Cache do planId para verificação síncrona
            if (data.plan && data.plan.id) {
                window.PlanService._cachedPlanId = data.plan.id;
            }
            return data;
        }

        return null;

    } catch (error) {
        console.error('❌ Erro ao obter plano:', error);
        return null;
    }
}

/**
 * Verifica se pode criar mais de um recurso
 */
async function canCreate(resource) {
    try {
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        if (!userId) return { canCreate: true }; // Default para não bloquear

        const response = await fetchWithAuth(`${PLAN_API_URL}/api/plans/check-limit/${resource}?user_id=${userId}`);
        const data = await response.json();

        return data;

    } catch (error) {
        console.error('❌ Erro ao verificar limite:', error);
        return { canCreate: true }; // Em caso de erro, não bloqueia
    }
}

/**
 * Verifica se pode usar uma funcionalidade
 */
async function canUseFeature(feature) {
    try {
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        if (!userId) return { canUse: true };

        const response = await fetchWithAuth(`${PLAN_API_URL}/api/plans/can-use/${feature}?user_id=${userId}`);
        const data = await response.json();

        return data;

    } catch (error) {
        console.error('❌ Erro ao verificar feature:', error);
        return { canUse: true };
    }
}

/**
 * Mostra modal de upgrade
 * @param {string} reason - Motivo do bloqueio
 * @param {string} currentPlan - Plano atual do usuário
 * @param {string} suggestedPlan - Plano sugerido para upgrade
 * @param {string} type - Tipo do modal: 'limit' (padrão) ou 'ai' (funcionalidades de IA)
 */
function showUpgradeModal(reason, currentPlan = 'normal', suggestedPlan = 'pro', type = 'limit') {
    // Remover modal existente se houver
    const existingModal = document.getElementById('upgrade-modal');
    if (existingModal) existingModal.remove();

    const planNames = {
        normal: 'Normal',
        pro: 'Pro',
        promax: 'ProMax'
    };

    const planPrices = {
        pro: { value: '14,90', full: 'R$ 14,90/mês' },
        promax: { value: '29', full: 'R$ 29/mês' }
    };

    const planBenefits = {
        pro: [
            'Projetos ilimitados',
            'Exportação em alta qualidade',
            'Suporte prioritário',
            'Integrações avançadas'
        ],
        promax: [
            'Tudo do Pro',
            'IA ilimitada',
            'Backup automático',
            'API exclusiva'
        ]
    };

    // Conteúdo específico para IA
    const aiContent = {
        icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27a7 7 0 0 1-12.46 0H6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
                    <circle cx="9.5" cy="15.5" r="1"></circle>
                    <circle cx="14.5" cy="15.5" r="1"></circle>
               </svg>`,
        title: 'Recurso Exclusivo',
        subtitle: `A Inteligência Artificial está disponível apenas nos planos Pro e ProMax`,
        benefits: [
            'Assistente IA completo',
            'Geração de rotinas com IA',
            'Descrições automáticas',
            'Subtarefas inteligentes'
        ]
    };

    // Conteúdo padrão (limite atingido)
    const defaultContent = {
        icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
               </svg>`,
        title: 'Limite Atingido',
        subtitle: `Desbloqueie recursos ilimitados com o plano ${planNames[suggestedPlan]}`,
        benefits: planBenefits[suggestedPlan] || planBenefits.pro
    };

    // Selecionar conteúdo baseado no tipo
    const content = type === 'ai' ? aiContent : defaultContent;

    const modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.className = 'upgrade-modal-overlay';
    modal.innerHTML = `
        <div class="upgrade-modal-content">
            <button class="upgrade-modal-close" onclick="closeUpgradeModal()">×</button>

            <div class="upgrade-modal-icon">
                ${content.icon}
            </div>

            <h2 class="upgrade-modal-title">${content.title}</h2>
            <p class="upgrade-modal-subtitle">${content.subtitle}</p>

            <ul class="upgrade-benefits-list">
                ${content.benefits.map(b => `
                    <li>
                        <span class="benefit-check">✓</span>
                        <span>${b}</span>
                    </li>
                `).join('')}
            </ul>

            <div class="upgrade-price">
                <span class="price-currency">R$</span>
                <span class="price-value">${planPrices[suggestedPlan].value}</span>
                <span class="price-period">/mês</span>
            </div>

            <button class="btn-upgrade-action" onclick="handleUpgrade('${suggestedPlan}')">
                Fazer Upgrade
            </button>

            <button class="btn-upgrade-back" onclick="closeUpgradeModal()">
                Voltar
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Animar entrada
    requestAnimationFrame(() => {
        modal.classList.add('visible');
    });
}

/**
 * Fecha modal de upgrade
 */
function closeUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300);
    }
}

/**
 * Lida com clique no botão de upgrade
 */
async function handleUpgrade(plan) {
    // Por enquanto, apenas fecha o modal
    // Futuramente: integrar com gateway de pagamento
    closeUpgradeModal();

    // Mostrar toast de "em breve"
    showToast('Em breve: integração com pagamento! Enquanto isso, entre em contato conosco.', 'info');
}

/**
 * Mostra toast de notificação
 */
function showToast(message, type = 'info') {
    // Remover toast existente
    const existingToast = document.getElementById('plan-toast');
    if (existingToast) existingToast.remove();

    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle'
    };

    const colors = {
        info: '#3498db',
        success: '#27ae60',
        warning: '#f39c12',
        error: '#e74c3c'
    };

    const toast = document.createElement('div');
    toast.id = 'plan-toast';
    toast.className = 'plan-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: ${colors[type]};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.3s ease;
        font-size: 14px;
    `;

    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Remover após 4 segundos
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Mostra badge do plano no header
 */
async function showPlanBadge() {
    const planInfo = await getMyPlan();

    if (!planInfo) return;

    const plan = planInfo.plan;
    const planColors = {
        normal: '#6c757d',
        pro: '#4f46e5',
        promax: '#f59e0b'
    };

    // Verificar se já existe badge
    let badge = document.getElementById('plan-badge');

    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'plan-badge';
        badge.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${planColors[plan.id]};
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: transform 0.2s;
        `;

        badge.onmouseenter = () => badge.style.transform = 'scale(1.05)';
        badge.onmouseleave = () => badge.style.transform = 'scale(1)';
        badge.onclick = () => window.location.href = '/ajustes';

        document.body.appendChild(badge);
    }

    const icons = {
        normal: 'fa-user',
        pro: 'fa-star',
        promax: 'fa-crown'
    };

    badge.innerHTML = `
        <i class="fas ${icons[plan.id]}"></i>
        <span>${plan.name}</span>
    `;
    badge.style.background = planColors[plan.id];
}

/**
 * Intercepta erros de limite de plano
 */
function handlePlanLimitError(error) {
    if (error.code === 'PLAN_LIMIT_REACHED' || error.code === 'AI_NOT_AVAILABLE' || error.code === 'AI_LIMIT_REACHED' || error.code === 'FEATURE_NOT_AVAILABLE') {
        showUpgradeModal(error.error, error.plan, error.upgrade);
        return true;
    }
    return false;
}

// Adicionar estilos do modal de upgrade
function addUpgradeModalStyles() {
    if (document.getElementById('upgrade-modal-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'upgrade-modal-styles';
    styles.textContent = `
        .upgrade-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .upgrade-modal-overlay.visible {
            opacity: 1;
        }

        .upgrade-modal-content {
            background: #fff;
            border-radius: 16px;
            padding: 32px 28px;
            max-width: 340px;
            width: 90%;
            position: relative;
            transform: scale(0.95);
            transition: transform 0.2s ease;
            text-align: center;
        }

        .upgrade-modal-overlay.visible .upgrade-modal-content {
            transform: scale(1);
        }

        .upgrade-modal-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            color: #999;
            font-size: 24px;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 24px;
            height: 24px;
        }

        .upgrade-modal-close:hover {
            color: #333;
        }

        .upgrade-modal-icon {
            width: 56px;
            height: 56px;
            background: #1a1a2e;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }

        .upgrade-modal-icon svg {
            color: #fff;
            width: 24px;
            height: 24px;
        }

        .upgrade-modal-title {
            font-size: 20px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 8px;
        }

        .upgrade-modal-subtitle {
            font-size: 14px;
            color: #666;
            margin: 0 0 24px;
            line-height: 1.4;
        }

        .upgrade-benefits-list {
            list-style: none;
            padding: 0;
            margin: 0 0 24px;
            text-align: left;
        }

        .upgrade-benefits-list li {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            font-size: 14px;
            color: #333;
            border-bottom: 1px solid #f0f0f0;
        }

        .upgrade-benefits-list li:last-child {
            border-bottom: none;
        }

        .benefit-check {
            width: 20px;
            height: 20px;
            background: #1a1a2e;
            color: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            flex-shrink: 0;
        }

        .upgrade-price {
            margin-bottom: 20px;
            display: flex;
            align-items: baseline;
            justify-content: center;
            gap: 2px;
        }

        .price-currency {
            font-size: 14px;
            color: #666;
            font-weight: 500;
        }

        .price-value {
            font-size: 36px;
            font-weight: 700;
            color: #1a1a1a;
        }

        .price-period {
            font-size: 14px;
            color: #666;
        }

        .btn-upgrade-action {
            width: 100%;
            padding: 14px 20px;
            background: #1a1a2e;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            margin-bottom: 12px;
        }

        .btn-upgrade-action:hover {
            background: #2d2d44;
        }

        .btn-upgrade-back {
            background: none;
            border: none;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            padding: 8px;
        }

        .btn-upgrade-back:hover {
            color: #333;
            text-decoration: underline;
        }

        /* Responsivo */
        @media (max-width: 480px) {
            .upgrade-modal-content {
                padding: 24px 20px;
                margin: 16px;
            }

            .price-value {
                font-size: 32px;
            }
        }
    `;

    document.head.appendChild(styles);
}

// Inicializar estilos ao carregar
document.addEventListener('DOMContentLoaded', () => {
    addUpgradeModalStyles();
});

// Exportar funções globalmente
window.PlanService = {
    getMyPlan,
    canCreate,
    canUseFeature,
    showUpgradeModal,
    closeUpgradeModal,
    showToast,
    showPlanBadge,
    handlePlanLimitError
};

console.log('💎 Plan Service carregado!');
