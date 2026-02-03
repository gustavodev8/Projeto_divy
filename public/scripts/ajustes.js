/* ========================================
   SISTEMA DE AJUSTES - INTEGRADO COM SERVIDOR
   Arquivo: ajustes.js
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

let currentUser = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('⚙️ Inicializando sistema de ajustes...');

    // Verificar autenticação
    currentUser = getCurrentUser();

    if (!currentUser) {
        console.error('❌ Usuário não autenticado');
        window.location.href = 'Tela_Login.html';
        return;
    }

    console.log('👤 Usuário:', currentUser.username);

    // Atualizar informações da conta
    updateAccountInfo();

    // Carregar configurações salvas
    await loadSettings();

    // Carregar informações do plano
    await loadPlanInfo();

    // Inicializar event listeners
    initializeEventListeners();

    console.log('✅ Sistema de ajustes carregado');
});

// ===== ATUALIZAR INFORMAÇÕES DA CONTA =====
function updateAccountInfo() {
    const nameElement = document.querySelector('.account-name');
    const emailElement = document.querySelector('.account-email');

    if (nameElement) {
        nameElement.textContent = currentUser.username || 'Usuário';
    }

    if (emailElement) {
        emailElement.textContent = currentUser.email || 'email@exemplo.com';
    }
}

// ===== CARREGAR INFORMAÇÕES DO PLANO =====
async function loadPlanInfo() {
    console.log('💎 Carregando informações do plano...');

    const container = document.getElementById('plan-info-container');
    if (!container) return;

    try {
        // Usar o PlanService se disponível
        let planData = null;

        if (window.PlanService) {
            planData = await window.PlanService.getMyPlan(true);
        } else {
            // Fallback: fazer requisição direta
            const response = await fetch(`${API_URL}/api/plans/my-plan?user_id=${currentUser.id}`);
            planData = await response.json();
        }

        if (!planData || !planData.success) {
            container.innerHTML = `<div class="plan-error">Não foi possível carregar informações do plano</div>`;
            return;
        }

        const { plan, usage, features } = planData;

        // Esconder seção de IA para plano normal
        const aiSection = document.getElementById('ai-settings-section');
        if (aiSection) {
            aiSection.style.display = plan.id === 'normal' ? 'none' : '';
        }

        // Cores e ícones por plano
        const planStyles = {
            normal: { color: '#6c757d', icon: 'fa-user', gradient: 'linear-gradient(135deg, #6c757d, #495057)' },
            pro: { color: '#4f46e5', icon: 'fa-star', gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
            promax: { color: '#f59e0b', icon: 'fa-crown', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' }
        };

        const style = planStyles[plan.id] || planStyles.normal;

        // Formatar data de expiração
        let expirationText = '';
        if (plan.expiresAt) {
            const expDate = new Date(plan.expiresAt);
            const daysLeft = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
            expirationText = `<span class="plan-expiration">Expira em ${daysLeft} dias (${expDate.toLocaleDateString('pt-BR')})</span>`;
        }

        // Função para criar barra de progresso
        const createProgressBar = (current, limit, unlimited) => {
            if (unlimited) {
                return `<span class="usage-unlimited"><i class="fas fa-infinity"></i> Ilimitado</span>`;
            }
            const percentage = Math.min((current / limit) * 100, 100);
            const colorClass = percentage >= 90 ? 'critical' : percentage >= 70 ? 'warning' : 'normal';
            return `
                <div class="usage-bar-container">
                    <div class="usage-bar ${colorClass}" style="width: ${percentage}%"></div>
                </div>
                <span class="usage-text">${current} / ${limit}</span>
            `;
        };

        container.innerHTML = `
            <div class="plan-header-minimal">
                <div class="plan-badge-minimal ${plan.id}">
                    ${plan.name}
                </div>
                <span class="plan-price-minimal">${plan.isPaid ? `R$ ${plan.price?.toFixed(2).replace('.', ',')}/mês` : 'Gratuito'}</span>
            </div>

            <div class="plan-usage-minimal">
                <div class="usage-row">
                    <span class="usage-name">Tarefas</span>
                    <span class="usage-value">${usage.tasks.unlimited ? '∞' : `${usage.tasks.current}/${usage.tasks.limit}`}</span>
                </div>
                <div class="usage-row">
                    <span class="usage-name">Listas</span>
                    <span class="usage-value">${usage.lists.unlimited ? '∞' : `${usage.lists.current}/${usage.lists.limit}`}</span>
                </div>
                <div class="usage-row">
                    <span class="usage-name">IA</span>
                    <span class="usage-value ${!usage.ai.enabled ? 'locked' : ''}">${usage.ai.enabled ? (usage.ai.routines.unlimited ? '∞' : `${usage.ai.routines.current}/${usage.ai.routines.limit} rotinas`) : 'Pro'}</span>
                </div>
            </div>

            <div class="plan-features-minimal">
                <div class="feature-row ${features.kanban ? '' : 'disabled'}">
                    <span class="feature-check">${features.kanban ? '✓' : '—'}</span>
                    <span>Kanban</span>
                </div>
                <div class="feature-row ${features.dragAndDrop ? '' : 'disabled'}">
                    <span class="feature-check">${features.dragAndDrop ? '✓' : '—'}</span>
                    <span>Drag & Drop</span>
                </div>
                <div class="feature-row ${features.smartFilters ? '' : 'disabled'}">
                    <span class="feature-check">${features.smartFilters ? '✓' : '—'}</span>
                    <span>Filtros</span>
                </div>
                <div class="feature-row">
                    <span class="feature-check">✓</span>
                    <span>Modo Escuro</span>
                </div>
            </div>

            ${plan.id !== 'promax' ? `
                <button class="btn-upgrade-minimal" onclick="window.PlanService?.showUpgradeModal('Desbloqueie mais recursos', '${plan.id}', '${plan.id === 'normal' ? 'pro' : 'promax'}')">
                    Fazer upgrade
                </button>
            ` : ''}
        `;

        // Adicionar estilos específicos para a seção de plano
        addPlanSectionStyles();

        console.log('✅ Informações do plano carregadas');

    } catch (error) {
        console.error('❌ Erro ao carregar plano:', error);
        container.innerHTML = `<div class="plan-error">Erro ao carregar informações do plano</div>`;
    }
}

// ===== ESTILOS DA SEÇÃO DE PLANO =====
function addPlanSectionStyles() {
    if (document.getElementById('plan-section-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'plan-section-styles';
    styles.textContent = `
        /* Design Minimalista Preto e Branco */
        .plan-header-minimal {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(0,0,0,0.1);
            margin-bottom: 16px;
        }

        .plan-badge-minimal {
            font-size: 14px;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 4px;
            background: #111;
            color: #fff;
        }

        .plan-badge-minimal.pro {
            background: #333;
        }

        .plan-badge-minimal.promax {
            background: #000;
        }

        .plan-price-minimal {
            font-size: 13px;
            color: #666;
        }

        .plan-usage-minimal {
            margin-bottom: 20px;
        }

        .usage-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid rgba(0,0,0,0.06);
            font-size: 14px;
        }

        .usage-row:last-child {
            border-bottom: none;
        }

        .usage-name {
            color: #333;
        }

        .usage-value {
            color: #666;
            font-weight: 500;
        }

        .usage-value.locked {
            color: #999;
            font-size: 12px;
        }

        .plan-features-minimal {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 20px;
        }

        .feature-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #333;
            padding: 8px 0;
        }

        .feature-row.disabled {
            color: #bbb;
        }

        .feature-check {
            font-weight: 600;
            width: 16px;
        }

        .feature-row.disabled .feature-check {
            color: #ccc;
        }

        .btn-upgrade-minimal {
            width: 100%;
            padding: 12px 20px;
            background: #111;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }

        .btn-upgrade-minimal:hover {
            background: #333;
        }

        .plan-loading, .plan-error {
            text-align: center;
            padding: 20px;
            color: #888;
            font-size: 14px;
        }

        .plan-error {
            color: #c00;
        }

        /* Dark mode adaptações */
        [data-theme="dark"] .plan-header-minimal {
            border-color: rgba(255,255,255,0.1);
        }

        [data-theme="dark"] .plan-badge-minimal {
            background: #fff;
            color: #111;
        }

        [data-theme="dark"] .plan-badge-minimal.pro,
        [data-theme="dark"] .plan-badge-minimal.promax {
            background: #fff;
            color: #111;
        }

        [data-theme="dark"] .plan-price-minimal {
            color: #999;
        }

        [data-theme="dark"] .usage-row {
            border-color: rgba(255,255,255,0.08);
        }

        [data-theme="dark"] .usage-name {
            color: #eee;
        }

        [data-theme="dark"] .usage-value {
            color: #aaa;
        }

        [data-theme="dark"] .feature-row {
            color: #eee;
        }

        [data-theme="dark"] .feature-row.disabled {
            color: #555;
        }

        [data-theme="dark"] .feature-row.disabled .feature-check {
            color: #444;
        }

        [data-theme="dark"] .btn-upgrade-minimal {
            background: #fff;
            color: #111;
        }

        [data-theme="dark"] .btn-upgrade-minimal:hover {
            background: #eee;
        }

        /* Responsivo */
        @media (max-width: 480px) {
            .plan-features-minimal {
                grid-template-columns: 1fr;
            }
        }
    `;

    document.head.appendChild(styles);
}

// ===== CARREGAR CONFIGURAÇÕES DO SERVIDOR =====
async function loadSettings() {
    console.log('📥 Carregando configurações do servidor...');
    
    try {
        const response = await fetch(`${API_URL}/api/settings/${currentUser.id}`, {
            headers: {
                'x-user-id': currentUser.id.toString()
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.settings && Object.keys(data.settings).length > 0) {
            console.log('✅ Configurações do servidor:', data.settings);
            applySettings(data.settings);
            
            // Salvar no localStorage também
            saveToLocalStorage(data.settings);
        } else {
            console.log('⚠️ Sem configurações no servidor, tentando localStorage...');
            loadFromLocalStorage();
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar do servidor:', error);
        console.log('⚠️ Carregando do localStorage como fallback...');
        loadFromLocalStorage();
    }
}

// ===== CARREGAR DO LOCALSTORAGE (FALLBACK) =====
function loadFromLocalStorage() {
    const stored = localStorage.getItem('nura_settings');
    
    if (stored) {
        try {
            const settings = JSON.parse(stored);
            console.log('📦 Configurações do localStorage:', settings);
            applySettings(settings);
        } catch (error) {
            console.error('❌ Erro ao parsear localStorage:', error);
            applyDefaultSettings();
        }
    } else {
        console.log('⚠️ Nenhuma configuração salva, usando padrões');
        applyDefaultSettings();
    }
}

// ===== SALVAR NO LOCALSTORAGE =====
function saveToLocalStorage(settings) {
    try {
        localStorage.setItem('nura_settings', JSON.stringify(settings));
        console.log('💾 Configurações salvas no localStorage');
    } catch (error) {
        console.error('❌ Erro ao salvar no localStorage:', error);
    }
}

// ===== APLICAR CONFIGURAÇÕES NA UI =====
function applySettings(settings) {
    // Dark Mode
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.checked = settings.darkMode || false;
        applyDarkMode(settings.darkMode);
    }
    
    // Mostrar Detalhes
    const showDetailsToggle = document.getElementById('showDetailsToggle');
    if (showDetailsToggle) {
        showDetailsToggle.checked = settings.showDetails !== false; // padrão true
    }
    
    // Esconder Concluídas
    const hideCompletedToggle = document.getElementById('hideCompletedToggle');
    if (hideCompletedToggle) {
        hideCompletedToggle.checked = settings.hideCompleted || false;
    }
    
    // Destacar Urgentes
    const highlightUrgentToggle = document.getElementById('highlightUrgentToggle');
    if (highlightUrgentToggle) {
        highlightUrgentToggle.checked = settings.highlightUrgent || false;
    }
    
    // Sugestões IA
    const aiSuggestionsToggle = document.getElementById('aiSuggestionsToggle');
    if (aiSuggestionsToggle) {
        aiSuggestionsToggle.checked = settings.autoSuggestions || false;
    }

    // Nível de Detalhamento IA
    const aiDetailLevel = document.getElementById('aiDetailLevel');
    if (aiDetailLevel) {
        const level = (settings.detailLevel || 'Médio').toLowerCase();
        aiDetailLevel.value = level === 'médio' ? 'medio' : level;
    }

    // Mostrar/ocultar nível de detalhamento baseado no toggle de sugestões
    updateDetailLevelVisibility(settings.autoSuggestions || false);
}

// ===== CONTROLAR VISIBILIDADE DO NÍVEL DE DETALHAMENTO =====
function updateDetailLevelVisibility(isEnabled) {
    const detailLevelItem = document.getElementById('aiDetailLevelItem');
    if (detailLevelItem) {
        detailLevelItem.style.display = isEnabled ? 'flex' : 'none';
        console.log('🎛️ Nível de detalhamento:', isEnabled ? 'visível' : 'oculto');
    }
}

// ===== APLICAR CONFIGURAÇÕES PADRÃO =====
function applyDefaultSettings() {
    const defaults = {
        darkMode: false,
        showDetails: true,
        hideCompleted: false,
        highlightUrgent: false,
        autoSuggestions: false,
        detailLevel: 'medio',
        viewMode: 'lista'
    };
    
    applySettings(defaults);
}

// ===== APLICAR DARK MODE =====
function applyDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('nura_dark_mode', 'true');
        console.log('🌙 Dark mode ativado');
    } else {
        document.body.classList.remove('dark-mode');
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('nura_dark_mode', 'false');
        console.log('☀️ Dark mode desativado');
    }
}

// ===== SALVAR TODAS AS CONFIGURAÇÕES =====
async function saveAllSettings() {
    console.log('💾 Salvando todas as configurações...');
    
    const settings = {
        darkMode: document.getElementById('darkModeToggle')?.checked || false,
        showDetails: document.getElementById('showDetailsToggle')?.checked !== false, // padrão true
        hideCompleted: document.getElementById('hideCompletedToggle')?.checked || false,
        highlightUrgent: document.getElementById('highlightUrgentToggle')?.checked || false,
        autoSuggestions: document.getElementById('aiSuggestionsToggle')?.checked || false,
        detailLevel: document.getElementById('aiDetailLevel')?.value || 'medio',
        viewMode: 'lista' // padrão
    };
    
    console.log('📦 Settings a enviar:', settings);
    
    // ✅ Salvar no localStorage primeiro (instantâneo)
    saveToLocalStorage(settings);
    
    // ✅ NOTIFICAR OUTRAS ABAS/PÁGINAS VIA localStorage
    localStorage.setItem('nura_settings_update_trigger', Date.now().toString());
    console.log('📢 Trigger de atualização enviado para outras páginas');
    
    // Depois salvar no servidor
    try {
        console.log('📤 Settings enviados:', settings);

        const response = await fetch(`${API_URL}/api/settings/${currentUser.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser.id.toString()
            },
            body: JSON.stringify(settings)  // Enviar diretamente, não como { settings: ... }
        });
        
        const data = await response.json();
        
        console.log('📥 Resposta do servidor:', data);
        
        if (data.success) {
            console.log('✅ Configurações salvas no servidor');
            return true;
        } else {
            console.error('❌ Erro ao salvar no servidor:', data.error);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Erro de conexão ao salvar:', error);
        console.error('Stack:', error.stack);
        return false;
    }
}

// ===== INICIALIZAR EVENT LISTENERS =====
function initializeEventListeners() {
    console.log('🔧 Inicializando event listeners...');
    
    // Dark Mode Toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            applyDarkMode(enabled);
            await saveAllSettings();
            showNotification('✅ Dark mode ' + (enabled ? 'ativado' : 'desativado'));
            
            // ✅ Notificar outras páginas
            window.dispatchEvent(new CustomEvent('settingsUpdated', { 
                detail: { darkMode: enabled } 
            }));
        });
    }
    
    // Show Details Toggle
    const showDetailsToggle = document.getElementById('showDetailsToggle');
    if (showDetailsToggle) {
        showDetailsToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            
            console.log('👁️ Show Details Toggle clicado:', enabled);
            
            await saveAllSettings();
            showNotification('✅ ' + (enabled ? 'Detalhes visíveis' : 'Apenas títulos'));
            
            // ✅ Notificar outras páginas que os settings mudaram
            window.dispatchEvent(new CustomEvent('settingsUpdated', { 
                detail: { showDetails: enabled } 
            }));
            
            console.log('✅ Evento settingsUpdated disparado');
        });
    }
    
    // Hide Completed Toggle
    const hideCompletedToggle = document.getElementById('hideCompletedToggle');
    if (hideCompletedToggle) {
        hideCompletedToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;

            // Salvar individualmente no localStorage para sincronização
            localStorage.setItem('nura_hideCompleted', enabled.toString());

            await saveAllSettings();
            showNotification('✅ ' + (enabled ? 'Concluídas ocultadas' : 'Concluídas visíveis'));

            // ✅ Notificar outras páginas
            window.dispatchEvent(new CustomEvent('settingsUpdated', {
                detail: { hideCompleted: enabled }
            }));
        });
    }
    
    // Highlight Urgent Toggle
    const highlightUrgentToggle = document.getElementById('highlightUrgentToggle');
    if (highlightUrgentToggle) {
        highlightUrgentToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            await saveAllSettings();
            showNotification('✅ ' + (enabled ? 'Urgentes destacadas' : 'Sem destaque'));
            
            // ✅ Notificar outras páginas
            window.dispatchEvent(new CustomEvent('settingsUpdated', { 
                detail: { highlightUrgent: enabled } 
            }));
        });
    }
    
    // AI Suggestions Toggle
    const aiSuggestionsToggle = document.getElementById('aiSuggestionsToggle');
    if (aiSuggestionsToggle) {
        aiSuggestionsToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;

            // ✅ Mostrar/ocultar nível de detalhamento
            updateDetailLevelVisibility(enabled);

            await saveAllSettings();
            showNotification('✅ Sugestões de IA ' + (enabled ? 'ativadas' : 'desativadas'));

            // ✅ Notificar outras páginas
            window.dispatchEvent(new CustomEvent('settingsUpdated', {
                detail: { autoSuggestions: enabled }
            }));
        });
    }
    
    // AI Detail Level Select
    const aiDetailLevel = document.getElementById('aiDetailLevel');
    if (aiDetailLevel) {
        aiDetailLevel.addEventListener('change', async (e) => {
            await saveAllSettings();
            const levels = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
            showNotification(`✅ Nível: ${levels[e.target.value]}`);
            
            // ✅ Notificar outras páginas
            window.dispatchEvent(new CustomEvent('settingsUpdated', { 
                detail: { detailLevel: e.target.value } 
            }));
        });
    }
    
    console.log('✅ Event listeners configurados');
}

// ===== LOGOUT =====
function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        console.log('👋 Fazendo logout...');
        
        // Limpar dados do usuário
        localStorage.removeItem('nura_user');
        localStorage.removeItem('nura_dark_mode');
        localStorage.removeItem('nura_settings');
        
        // Redirecionar para login
        window.location.href = 'Tela_Login.html';
    }
}

// ===== NOTIFICAÇÃO =====
function showNotification(message) {
    // Remover notificação anterior se existir
    const existingNotification = document.querySelector('.settings-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = 'settings-notification';
    notification.textContent = message;
    
    // Aplicar estilos
    notification.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: hsl(0, 0%, 8%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 300ms ease;
        font-family: 'Inter', sans-serif;
    `;
    
    // Adicionar ao body
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 300ms ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== HELPER: GET CURRENT USER =====
function getCurrentUser() {
    const userStr = localStorage.getItem('nura_user');
    if (!userStr) return null;
    
    try {
        return JSON.parse(userStr);
    } catch (error) {
        console.error('❌ Erro ao parsear usuário:', error);
        return null;
    }
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.logout = logout;
window.saveAllSettings = saveAllSettings;

// ===== ANIMAÇÕES CSS =====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);

console.log('✅ ajustes.js carregado e integrado com servidor');