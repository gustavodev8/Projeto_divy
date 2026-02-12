/* ========================================
   SISTEMA DE AJUSTES - INTEGRADO COM SERVIDOR
   Arquivo: ajustes.js
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

let currentUser = null;

// Estado de verificação WhatsApp
let whatsappVerificationPhone = null;

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

    // Carregar status do WhatsApp (se for ProMax)
    await loadWhatsappStatus();

    // Inicializar event listeners
    initializeEventListeners();

    // Inicializar inputs de código de verificação
    initializeCodeInputs();

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

// ===== MODAL DE LOGOUT =====
function showLogoutModal() {
    const overlay = document.getElementById('logoutModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function closeLogoutModal() {
    const overlay = document.getElementById('logoutModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function confirmLogout() {
    console.log('👋 Fazendo logout...');

    // Limpar dados do usuário
    localStorage.removeItem('nura_user');
    localStorage.removeItem('nura_dark_mode');
    localStorage.removeItem('nura_settings');
    localStorage.removeItem('nura_access_token');
    localStorage.removeItem('nura_refresh_token');
    localStorage.removeItem('nura_logged_in');

    // Redirecionar para login
    window.location.href = 'Tela_Login.html';
}

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLogoutModal();
    }
});

// ===== NOTIFICAÇÃO =====
function showNotification(message, type = 'info') {
    // Remover emojis
    const cleanMessage = message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2705}]|[\u{274C}]|[\u{26A0}]|[\u{2139}]/gu, '').trim();

    // Detectar tipo
    if (message.includes('✅') || message.includes('sucesso') || message.toLowerCase().includes('salv')) type = 'success';
    else if (message.includes('❌') || message.includes('erro')) type = 'error';
    else if (message.includes('⚠️')) type = 'warning';

    const icons = {
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const colors = {
        success: { bg: '#0f172a', border: '#22c55e', icon: '#22c55e' },
        error: { bg: '#0f172a', border: '#ef4444', icon: '#ef4444' },
        warning: { bg: '#0f172a', border: '#f59e0b', icon: '#f59e0b' },
        info: { bg: '#0f172a', border: '#3b82f6', icon: '#3b82f6' }
    };

    const color = colors[type] || colors.info;

    const existing = document.querySelector('.divy-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'divy-notification';
    notification.innerHTML = `
        <span style="display:flex;color:${color.icon};flex-shrink:0">${icons[type] || icons.info}</span>
        <span style="flex:1;line-height:1.3">${cleanMessage}</span>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        background: ${color.bg};
        color: #e2e8f0;
        padding: 12px 16px;
        border-radius: 6px;
        border-left: 3px solid ${color.border};
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 500;
        max-width: 320px;
        animation: divyNotifIn 0.2s ease;
    `;

    if (!document.getElementById('divy-notif-css')) {
        const style = document.createElement('style');
        style.id = 'divy-notif-css';
        style.textContent = `
            @keyframes divyNotifIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
            @keyframes divyNotifOut { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(16px); } }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'divyNotifOut 0.2s ease forwards';
        setTimeout(() => notification.remove(), 200);
    }, 2500);
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

// ===== WHATSAPP: CARREGAR STATUS =====
async function loadWhatsappStatus() {
    console.log('📱 Verificando status do WhatsApp...');

    const whatsappSection = document.getElementById('whatsapp-section');
    if (!whatsappSection) return;

    // Verificar se é ProMax
    try {
        let planData = null;

        if (window.PlanService) {
            planData = await window.PlanService.getMyPlan(false);
        } else {
            const response = await fetch(`${API_URL}/api/plans/my-plan?user_id=${currentUser.id}`);
            planData = await response.json();
        }

        if (!planData || !planData.success || planData.plan.id !== 'promax') {
            console.log('📱 WhatsApp: Plano não é ProMax, escondendo seção');
            whatsappSection.style.display = 'none';
            return;
        }

        // Mostrar seção WhatsApp para ProMax
        whatsappSection.style.display = '';

        // Buscar status de vinculação
        const token = localStorage.getItem('nura_access_token');
        console.log('🔑 Token WhatsApp:', token ? 'encontrado' : 'NÃO ENCONTRADO');

        const response = await fetch(`${API_URL}/v1/whatsapp/status`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        console.log('📱 Resposta status WhatsApp:', data);

        // Verificar se resposta é válida
        if (!response.ok || !data.success) {
            console.log('⚠️ WhatsApp status não disponível, mostrando estado não vinculado');
            showWhatsappNotLinkedState();
            return;
        }

        if (data.data && data.data.linked) {
            // WhatsApp vinculado
            showWhatsappLinkedState(data.data.phoneNumber);
        } else {
            // Não vinculado
            showWhatsappNotLinkedState();
        }

        console.log('✅ Status WhatsApp carregado');

    } catch (error) {
        console.error('❌ Erro ao carregar status WhatsApp:', error);
        // Mostrar estado não vinculado em caso de erro
        showWhatsappNotLinkedState();
    }
}

// ===== WHATSAPP: MOSTRAR ESTADOS =====
function showWhatsappNotLinkedState() {
    document.getElementById('whatsapp-not-linked').style.display = '';
    document.getElementById('whatsapp-verification').style.display = 'none';
    document.getElementById('whatsapp-linked').style.display = 'none';
}

function showWhatsappVerificationState(phoneNumber) {
    document.getElementById('whatsapp-not-linked').style.display = 'none';
    document.getElementById('whatsapp-verification').style.display = '';
    document.getElementById('whatsapp-linked').style.display = 'none';

    // Atualizar número exibido
    document.getElementById('verificationPhone').textContent = phoneNumber;

    // Limpar inputs de código
    document.querySelectorAll('.code-input').forEach(input => {
        input.value = '';
        input.classList.remove('filled');
    });

    // Focar no primeiro input
    document.querySelector('.code-input[data-index="0"]')?.focus();
}

function showWhatsappLinkedState(phoneNumber) {
    document.getElementById('whatsapp-not-linked').style.display = 'none';
    document.getElementById('whatsapp-verification').style.display = 'none';
    document.getElementById('whatsapp-linked').style.display = '';

    // Atualizar número exibido
    document.getElementById('linkedWhatsappNumber').textContent = phoneNumber;
}

// ===== WHATSAPP: SOLICITAR VERIFICAÇÃO =====
async function requestWhatsappVerification() {
    const phoneInput = document.getElementById('whatsappPhone');
    const phone = phoneInput?.value.replace(/\D/g, '');

    if (!phone || phone.length < 10) {
        showNotification('Número inválido. Use DDD + número', 'error');
        return;
    }

    const btn = document.getElementById('btnLinkWhatsapp');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Enviando...';

    try {
        const token = localStorage.getItem('nura_access_token');
        console.log('🔑 Token para verificação:', token ? `${token.substring(0, 20)}...` : 'NÃO ENCONTRADO');

        if (!token) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Vincular WhatsApp';
            return;
        }

        const response = await fetch(`${API_URL}/v1/whatsapp/request-verification`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber: phone })
        });

        const data = await response.json();
        console.log('📱 Resposta WhatsApp:', data);

        if (response.status === 401) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Vincular WhatsApp';
            return;
        }

        if (data.success) {
            whatsappVerificationPhone = phone;
            showWhatsappVerificationState(data.data.phoneNumber);
            showNotification('Código enviado para seu WhatsApp', 'success');
        } else {
            showNotification(data.message || 'Erro ao enviar código', 'error');
        }

    } catch (error) {
        console.error('❌ Erro ao solicitar verificação:', error);
        showNotification('Erro ao enviar código. Tente novamente.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            Enviar código de verificação
        `;
    }
}

// ===== WHATSAPP: VERIFICAR CÓDIGO =====
async function verifyWhatsappCode() {
    // Coletar código dos inputs
    const codeInputs = document.querySelectorAll('.code-input');
    let code = '';
    codeInputs.forEach(input => code += input.value);

    if (code.length !== 6) {
        showNotification('Digite o código completo de 6 dígitos', 'error');
        return;
    }

    const btn = document.getElementById('btnVerifyCode');
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
        const token = localStorage.getItem('nura_access_token');
        const response = await fetch(`${API_URL}/v1/whatsapp/verify-code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: whatsappVerificationPhone,
                code: code
            })
        });

        const data = await response.json();

        if (data.success) {
            showWhatsappLinkedState(data.data.phoneNumber);
            showNotification('WhatsApp vinculado com sucesso!', 'success');
            whatsappVerificationPhone = null;
        } else {
            showNotification(data.message || 'Código incorreto', 'error');
            // Limpar inputs
            codeInputs.forEach(input => {
                input.value = '';
                input.classList.remove('filled');
            });
            codeInputs[0]?.focus();
        }

    } catch (error) {
        console.error('❌ Erro ao verificar código:', error);
        showNotification('Erro ao verificar código. Tente novamente.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verificar código';
    }
}

// ===== WHATSAPP: REENVIAR CÓDIGO =====
async function resendVerificationCode() {
    if (!whatsappVerificationPhone) {
        showNotification('Erro ao reenviar. Tente novamente.', 'error');
        cancelVerification();
        return;
    }

    try {
        const token = localStorage.getItem('nura_access_token');
        const response = await fetch(`${API_URL}/v1/whatsapp/resend-code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber: whatsappVerificationPhone })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Novo código enviado!', 'success');
            // Limpar inputs
            document.querySelectorAll('.code-input').forEach(input => {
                input.value = '';
                input.classList.remove('filled');
            });
            document.querySelector('.code-input[data-index="0"]')?.focus();
        } else {
            showNotification(data.message || 'Erro ao reenviar código', 'error');
        }

    } catch (error) {
        console.error('❌ Erro ao reenviar código:', error);
        showNotification('Erro ao reenviar código. Tente novamente.', 'error');
    }
}

// ===== WHATSAPP: CANCELAR VERIFICAÇÃO =====
function cancelVerification() {
    whatsappVerificationPhone = null;
    showWhatsappNotLinkedState();

    // Limpar input de telefone
    const phoneInput = document.getElementById('whatsappPhone');
    if (phoneInput) phoneInput.value = '';
}

// ===== WHATSAPP: DESVINCULAR =====
async function unlinkWhatsapp() {
    if (!confirm('Tem certeza que deseja desvincular o WhatsApp?')) {
        return;
    }

    try {
        const token = localStorage.getItem('nura_access_token');
        const response = await fetch(`${API_URL}/v1/whatsapp/unlink`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showWhatsappNotLinkedState();
            showNotification('WhatsApp desvinculado', 'success');
        } else {
            showNotification(data.message || 'Erro ao desvincular', 'error');
        }

    } catch (error) {
        console.error('❌ Erro ao desvincular WhatsApp:', error);
        showNotification('Erro ao desvincular. Tente novamente.', 'error');
    }
}

// ===== WHATSAPP: INICIALIZAR INPUTS DE CÓDIGO =====
function initializeCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');

    inputs.forEach((input, index) => {
        // Ao digitar
        input.addEventListener('input', (e) => {
            const value = e.target.value;

            // Apenas números
            e.target.value = value.replace(/\D/g, '').slice(0, 1);

            // Atualizar estado visual
            if (e.target.value) {
                e.target.classList.add('filled');
                // Mover para próximo input
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            } else {
                e.target.classList.remove('filled');
            }

            // Verificar se todos os campos estão preenchidos
            const allFilled = Array.from(inputs).every(i => i.value.length === 1);
            if (allFilled) {
                // Auto-verificar após pequeno delay
                setTimeout(() => verifyWhatsappCode(), 300);
            }
        });

        // Ao pressionar tecla
        input.addEventListener('keydown', (e) => {
            // Backspace: voltar para input anterior
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
            // Seta esquerda
            if (e.key === 'ArrowLeft' && index > 0) {
                inputs[index - 1].focus();
            }
            // Seta direita
            if (e.key === 'ArrowRight' && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // Ao colar
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            const digits = pastedData.replace(/\D/g, '').slice(0, 6);

            digits.split('').forEach((digit, i) => {
                if (inputs[i]) {
                    inputs[i].value = digit;
                    inputs[i].classList.add('filled');
                }
            });

            // Focar no último preenchido ou no próximo vazio
            const lastFilledIndex = digits.length - 1;
            if (lastFilledIndex < inputs.length - 1) {
                inputs[lastFilledIndex + 1]?.focus();
            } else {
                inputs[lastFilledIndex]?.focus();
            }

            // Auto-verificar se colou 6 dígitos
            if (digits.length === 6) {
                setTimeout(() => verifyWhatsappCode(), 300);
            }
        });
    });
}

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.showLogoutModal = showLogoutModal;
window.closeLogoutModal = closeLogoutModal;
window.confirmLogout = confirmLogout;
window.saveAllSettings = saveAllSettings;
window.requestWhatsappVerification = requestWhatsappVerification;
window.verifyWhatsappCode = verifyWhatsappCode;
window.resendVerificationCode = resendVerificationCode;
window.cancelVerification = cancelVerification;
window.unlinkWhatsapp = unlinkWhatsapp;

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