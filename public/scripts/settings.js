// ===== SISTEMA DE CONFIGURAÇÕES NURA COM BANCO DE DADOS =====
// Arquivo: public/scripts/settings.js

const SETTINGS_API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

let currentUserId = null;

// ===== OBJETO DE CONFIGURAÇÕES =====
let nuraSettings = {
    hideCompleted: false,
    highlightUrgent: true,
    autoSuggestions: true,
    detailLevel: 'medio',
    darkMode: false,
    primaryColor: '#49a09d',
    currentPlan: 'free',
    planRenewalDate: '',
    viewMode: 'lista',
    showDetails: false,
    emailNotifications: true,
    weeklyReport: false,
    aiDescriptionsEnabled: true,
    aiDetailLevel: 'medio',
    aiOptimizationEnabled: true
};

// ===== OBTER ID DO USUÁRIO =====
function getCurrentUserId() {
    if (!currentUserId) {
        const userData = localStorage.getItem('nura_user');
        if (userData) {
            try {
                currentUserId = JSON.parse(userData).id;
            } catch (e) {
                console.error('❌ Erro ao parsear usuário:', e);
                return null;
            }
        }
    }
    return currentUserId;
}

// ===== CARREGAR CONFIGURAÇÕES DO BANCO =====
async function loadSettingsFromDatabase() {
    const user = getCurrentUser();
    
    // ✅ DEFAULTS INLINE (não depende de variável externa)
    const DEFAULTS = {
        hideCompleted: false,
        highlightUrgent: true,
        autoSuggestions: true,
        detailLevel: 'medio',
        darkMode: false,
        primaryColor: '#49a09d',
        currentPlan: 'free',
        planRenewalDate: '',
        viewMode: 'lista',
        showDetails: false,
        emailNotifications: true,
        weeklyReport: false,
        aiDescriptionsEnabled: true,
        aiDetailLevel: 'medio',
        aiOptimizationEnabled: true
    };
    
    if (!user) {
        console.warn('⚠️ Usuário não logado, usando configurações padrão');
        nuraSettings = { ...DEFAULTS };
        this.applySettings();
        return;
    }

    console.log('⏳ Carregando configurações do banco para usuário:', user.id);

    try {
        const response = await fetch(`${API_URL}/api/settings/${user.id}`);
        const data = await response.json();

        if (data.success && data.settings) {
            console.log('📥 Configurações carregadas do banco:', data.settings);
            console.log('📥 showDetails carregado:', data.settings.showDetails);
            
            // Mesclar defaults com dados do banco
Object.assign(nuraSettings, DEFAULTS, data.settings);
            
            console.log('✅ Configurações mescladas:', nuraSettings);
            console.log('✅ showDetails final:', nuraSettings.showDetails);
        } else {
            console.log('⚠️ Nenhuma configuração encontrada, usando padrão');
            nuraSettings = { ...DEFAULTS };
        }
    } catch (error) {
        console.error('❌ Erro ao carregar configurações:', error);
        nuraSettings = { ...DEFAULTS };
    }
    
    // ✅ FALLBACK: localStorage para showDetails
    const localShowDetails = localStorage.getItem('nura_showDetails');
    if (localShowDetails !== null) {
        nuraSettings.showDetails = localShowDetails === 'true';
        console.log('📦 showDetails do localStorage:', nuraSettings.showDetails);
    }

    // ✅ FALLBACK: localStorage para hideCompleted
    const localHideCompleted = localStorage.getItem('nura_hideCompleted');
    if (localHideCompleted !== null) {
        nuraSettings.hideCompleted = localHideCompleted === 'true';
        console.log('📦 hideCompleted do localStorage:', nuraSettings.hideCompleted);
    }

    // ✅ FALLBACK: localStorage para highlightUrgent
    const localHighlightUrgent = localStorage.getItem('nura_highlightUrgent');
    if (localHighlightUrgent !== null) {
        nuraSettings.highlightUrgent = localHighlightUrgent === 'true';
        console.log('📦 highlightUrgent do localStorage:', nuraSettings.highlightUrgent);
    }

    this.applySettings();
}

// ===== SALVAR CONFIGURAÇÕES NO BANCO =====
async function saveSettingsToDatabase() {
    const user = getCurrentUser();
    if (!user) {
        console.error('❌ Usuário não logado');
        return;
    }

    console.log('⚙️ Salvando configurações no banco...');
    console.log('📦 Configurações a salvar:', nuraSettings);

    try {
        const response = await fetch(`${API_URL}/api/settings/${user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(nuraSettings) // ✅ Deve enviar TODO o objeto
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Configurações salvas com sucesso!');
        } else {
            console.error('❌ Erro ao salvar:', result.error);
        }
    } catch (error) {
        console.error('❌ Erro de conexão:', error);
    }
}

// ===== APLICAR CONFIGURAÇÕES NA INTERFACE =====
function applySettings() {
    // Aplicar modo escuro
    if (nuraSettings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Aplicar cor primária
    document.documentElement.style.setProperty('--primary-color', nuraSettings.primaryColor);
    
    console.log('🎨 Configurações aplicadas');
}

// ===== ATUALIZAR INTERFACE COM AS CONFIGURAÇÕES =====
function updateUIWithSettings() {
    console.log('🔄 Atualizando interface com:', nuraSettings);
    
    // Atualizar toggle do modo escuro
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        if (nuraSettings.darkMode) {
            darkModeToggle.classList.add('active');
        } else {
            darkModeToggle.classList.remove('active');
        }
    }
    
    // Atualizar TODOS os toggles
    document.querySelectorAll('.setting-row').forEach(row => {
        const toggle = row.querySelector('.toggle-switch');
        if (!toggle) return;
        
        const label = row.querySelector('.setting-label');
        if (!label) return;
        
        const text = label.textContent.toLowerCase();
        
        // Mapear cada toggle para sua configuração
        if (text.includes('modo escuro')) {
            toggle.classList.toggle('active', nuraSettings.darkMode);
        } else if (text.includes('ocultar tarefas') || text.includes('concluídas')) {
            toggle.classList.toggle('active', nuraSettings.hideCompleted);
        } else if (text.includes('destacar') || text.includes('urgentes')) {
            toggle.classList.toggle('active', nuraSettings.highlightUrgent);
        } else if (text.includes('sugestões')) {
            toggle.classList.toggle('active', nuraSettings.autoSuggestions);
        } else if (text.includes('resumo diário') || text.includes('email')) {
            toggle.classList.toggle('active', nuraSettings.emailNotifications);
        }
    });
    
    // Atualizar cor ativa
    document.querySelectorAll('.color-option').forEach(color => {
        const colorValue = color.getAttribute('data-color');
        if (colorValue === nuraSettings.primaryColor) {
            color.classList.add('active');
        } else {
            color.classList.remove('active');
        }
    });
    
    // Atualizar selects
    document.querySelectorAll('.setting-row').forEach(row => {
        const select = row.querySelector('select');
        if (!select) return;
        
        const label = row.querySelector('.setting-label');
        if (!label) return;
        
        const text = label.textContent.toLowerCase();
        
        if (text.includes('detalhamento')) {
            select.value = nuraSettings.detailLevel;
        } else if (text.includes('exibição')) {
            select.value = nuraSettings.viewMode || 'Lista';
        }
    });
    
    console.log('✅ Interface atualizada!');
}

// ===== MODO DE VISUALIZAÇÃO =====
async function setViewMode(mode) {
    const modeLower = mode.toLowerCase();
    nuraSettings.viewMode = modeLower;

    // Atualizar variável global
    window.currentViewMode = modeLower;

    // Salvar no localStorage para sincronização
    localStorage.setItem('nura_viewMode', modeLower);

    // Salvar no banco de dados
    await saveSettingsToDatabase();

    // Disparar evento para sincronização
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
        detail: { viewMode: modeLower }
    }));

    showNotification(`📊 Modo de visualização: ${mode}`);

    // Atualizar visualização se estiver na página de tarefas
    if (window.renderAllTasks) {
        window.renderAllTasks();
    }
}

// ===== FILTRO: OCULTAR TAREFAS CONCLUÍDAS =====
async function toggleHideCompleted(enabled) {
    console.log('👁️ toggleHideCompleted:', enabled);

    nuraSettings.hideCompleted = enabled;

    // Atualizar UI imediatamente - toggle na tela de ajustes
    const toggle = Array.from(document.querySelectorAll('.toggle-switch')).find(t => {
        const row = t.closest('.setting-row');
        return row?.textContent.toLowerCase().includes('ocultar tarefas');
    });
    if (toggle) toggle.classList.toggle('active', enabled);

    // Atualizar checkbox no menu de 3 pontinhos
    const menuCheckbox = document.getElementById('toggleHideCompletedCheckbox');
    if (menuCheckbox) {
        menuCheckbox.checked = enabled;
    }

    // Salvar no localStorage para sincronização
    localStorage.setItem('nura_hideCompleted', enabled.toString());

    // Salvar no banco de dados
    await saveSettingsToDatabase();

    // Disparar evento para sincronização
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
        detail: { hideCompleted: enabled }
    }));

    // Re-renderizar tarefas para aplicar o filtro
    if (typeof renderAllTasks === 'function') {
        console.log('🎨 Re-renderizando tarefas...');
        renderAllTasks();
    } else if (typeof window.renderAllTasks === 'function') {
        console.log('🎨 Re-renderizando tarefas (window)...');
        window.renderAllTasks();
    } else {
        // Fallback: aplicar diretamente no DOM
        document.querySelectorAll('[data-task-status="completed"]').forEach(task => {
            task.style.display = enabled ? 'none' : '';
        });

        // Ocultar coluna de concluídos no Kanban
        const completedColumn = document.querySelector('[data-kanban-column="completed"]');
        if (completedColumn) {
            completedColumn.style.display = enabled ? 'none' : '';
        }
    }

    showNotification(enabled ? '👁️ Tarefas concluídas ocultadas' : '👁️ Tarefas concluídas visíveis');
}

// ===== FILTRO: DESTACAR TAREFAS URGENTES =====
async function toggleHighlightUrgent(enabled) {
    console.log('🎨 toggleHighlightUrgent:', enabled);

    nuraSettings.highlightUrgent = enabled;

    // Atualizar toggle visual na tela de ajustes
    const toggle = Array.from(document.querySelectorAll('.toggle-switch')).find(t => {
        const row = t.closest('.setting-row');
        return row?.textContent.toLowerCase().includes('destacar');
    });
    if (toggle) toggle.classList.toggle('active', enabled);

    // Salvar no localStorage para sincronização
    localStorage.setItem('nura_highlightUrgent', enabled.toString());

    // Salvar no banco de dados
    await saveSettingsToDatabase();

    // Disparar evento para sincronização
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
        detail: { highlightUrgent: enabled }
    }));

    // Re-renderizar tarefas para aplicar/remover destaques
    if (typeof renderAllTasks === 'function') {
        console.log('🎨 Re-renderizando tarefas...');
        renderAllTasks();
    } else if (typeof window.renderAllTasks === 'function') {
        console.log('🎨 Re-renderizando tarefas (window)...');
        window.renderAllTasks();
    }

    showNotification(enabled ? '🚨 Tarefas urgentes destacadas' : '➡️ Destaques removidos');
}


// ===== ASSISTENTE IA: SUGESTÕES AUTOMÁTICAS =====
async function toggleAutoSuggestions(enabled) {
    nuraSettings.autoSuggestions = enabled;
    
    const toggle = Array.from(document.querySelectorAll('.toggle-switch')).find(t => {
        const row = t.closest('.setting-row');
        return row?.textContent.toLowerCase().includes('sugestões');
    });
    if (toggle) toggle.classList.toggle('active', enabled);
    
    await saveSettingsToDatabase();
    showNotification(enabled ? '💡 Sugestões de IA ativadas!' : '🔕 Sugestões de IA desativadas');
}

// ===== NOTIFICAÇÕES POR EMAIL =====
async function toggleEmailNotifications(enabled) {
    nuraSettings.emailNotifications = enabled;

    // Atualizar toggle visual
    const toggle = Array.from(document.querySelectorAll('.toggle-switch')).find(t => {
        const row = t.closest('.setting-row');
        const text = row?.textContent.toLowerCase();
        return text && (text.includes('resumo diário') || text.includes('email'));
    });

    if (toggle) {
        toggle.classList.toggle('active', enabled);
    }

    await saveSettingsToDatabase();

    if (enabled) {
        showNotification('📧 Resumo diário por email ATIVADO - Você receberá emails às 07:58 com suas tarefas pendentes');
    } else {
        showNotification('📪 Resumo diário por email DESATIVADO - Você não receberá mais emails automáticos');
    }
}

// ===== RELATÓRIO SEMANAL =====
async function toggleWeeklyReport(enabled) {
    nuraSettings.weeklyReport = enabled;

    // Atualizar toggle visual
    const toggle = Array.from(document.querySelectorAll('.toggle-switch')).find(t => {
        const row = t.closest('.setting-row');
        const text = row?.textContent.toLowerCase();
        return text && text.includes('relatório semanal');
    });

    if (toggle) {
        toggle.classList.toggle('active', enabled);
    }

    await saveSettingsToDatabase();

    if (enabled) {
        showNotification('📊 Relatório semanal ATIVADO - Toda segunda às 08:00 você receberá análise de produtividade com IA');
    } else {
        showNotification('📪 Relatório semanal DESATIVADO - Você não receberá mais relatórios automáticos');
    }
}

// ===== ASSISTENTE IA: NÍVEL DE DETALHAMENTO =====
async function setDetailLevel(level) {
    nuraSettings.detailLevel = level;
    await saveSettingsToDatabase();
    showNotification(`📊 Detalhamento: ${level}`);
}

// ===== PLANOS: OBTER INFORMAÇÕES =====
function getPlanInfo() {
    const plans = {
        'free': {
            name: 'Gratuito',
            price: 'R$ 0',
            tasks: 10,
            features: ['Até 10 tarefas', '1 rotina/semana', 'Sincronização básica']
        },
        'pro': {
            name: 'Pro',
            price: 'R$ 29/mês',
            tasks: 'Ilimitado',
            features: ['Tarefas ilimitadas', '5 rotinas/semana', 'Sincronização real-time', 'Sugestões IA']
        },
        'premium': {
            name: 'Premium',
            price: 'R$ 99/mês',
            tasks: 'Ilimitado',
            features: ['Tudo no Pro', 'Rotinas ilimitadas', 'IA avançada', 'Suporte 24/7']
        }
    };
    
    return plans[nuraSettings.currentPlan] || plans['pro'];
}

// ===== PLANOS: SELECIONAR PLANO =====
async function selectPlan(planName) {
    if (planName === 'premium') {
        if (confirm('🚀 Upgrade para Premium - R$ 99/mês?\n\n(Simulado para teste)')) {
            nuraSettings.currentPlan = 'premium';
            await saveSettingsToDatabase();
            showNotification('🚀 Upgrade realizado!');
        }
    } else if (planName === 'free') {
        if (confirm('⚠️ Você perderá acesso aos recursos Pro. Tem certeza?')) {
            nuraSettings.currentPlan = 'free';
            await saveSettingsToDatabase();
            showNotification('📉 Downgrade realizado');
        }
    }
}

// ===== PLANOS: CANCELAR =====
async function cancelPlan() {
    if (confirm('⚠️ Cancelar assinatura? Você será downgrade em 30 dias')) {
        nuraSettings.currentPlan = 'free';
        await saveSettingsToDatabase();
        showNotification('❌ Assinatura cancelada');
    }
}

// ===== APARÊNCIA: MODO ESCURO =====
async function toggleDarkMode(enabled) {
    nuraSettings.darkMode = enabled;
    
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.classList.toggle('active', enabled);
    
    document.body.classList.toggle('dark-mode', enabled);
    
    // Salvar no banco
    await saveSettingsToDatabase();
    
    // Atualizar localStorage para sincronização rápida
    localStorage.setItem('darkMode', enabled);
    
    // Notificar darkMode.js
    window.dispatchEvent(new CustomEvent('darkModeUpdated', { 
        detail: { isDark: enabled } 
    }));
    
    showNotification(enabled ? '🌙 Modo escuro ativado' : '☀️ Modo claro ativado');
}

// ===== SINCRONIZAR COM DARKMMODE.JS =====
function syncDarkMode(isDark) {
    nuraSettings.darkMode = isDark;
    
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        if (isDark) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }
    
    // Salvar no banco (sem notificação para evitar loop)
    saveSettingsToDatabase();
}

// ===== APARÊNCIA: TROCAR COR =====
async function setPrimaryColor(hexColor) {
    nuraSettings.primaryColor = hexColor;
    
    document.querySelectorAll('.color-option').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-color') === hexColor);
    });
    
    document.documentElement.style.setProperty('--primary-color', hexColor);
    
    await saveSettingsToDatabase();
    showNotification('🎨 Cor atualizada');
}

// ===== NOTIFICAÇÃO =====
function showNotification(message, type = 'info') {
    // Remover emojis da mensagem
    const cleanMessage = message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2705}]|[\u{274C}]|[\u{26A0}]|[\u{2139}]/gu, '').trim();

    // Detectar tipo baseado na mensagem original
    if (message.includes('✅') || message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('ativado') || message.toLowerCase().includes('vinculado')) type = 'success';
    else if (message.includes('❌') || message.toLowerCase().includes('erro') || message.toLowerCase().includes('cancelada')) type = 'error';
    else if (message.includes('⚠️') || message.toLowerCase().includes('desativado') || message.toLowerCase().includes('desvinculado')) type = 'warning';

    // Ícones SVG por tipo
    const icons = {
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    // Cores por tipo
    const colors = {
        success: { bg: '#0f172a', border: '#22c55e', icon: '#22c55e' },
        error: { bg: '#0f172a', border: '#ef4444', icon: '#ef4444' },
        warning: { bg: '#0f172a', border: '#f59e0b', icon: '#f59e0b' },
        info: { bg: '#0f172a', border: '#3b82f6', icon: '#3b82f6' }
    };

    const color = colors[type] || colors.info;
    const icon = icons[type] || icons.info;

    // Remover notificação anterior
    const existingNotification = document.querySelector('.divy-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Criar notificação
    const notification = document.createElement('div');
    notification.className = 'divy-notification';
    notification.innerHTML = `
        <div class="notification-icon" style="color: ${color.icon}">${icon}</div>
        <span class="notification-message">${cleanMessage}</span>
    `;

    // Estilos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color.bg};
        color: #e2e8f0;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 0.875rem;
        font-weight: 500;
        border-left: 3px solid ${color.border};
        animation: slideInNotification 0.3s ease;
        max-width: 320px;
    `;

    // Adicionar estilos de animação se não existirem
    if (!document.getElementById('divy-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'divy-notification-styles';
        style.textContent = `
            @keyframes slideInNotification {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideOutNotification {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(20px); }
            }
            .divy-notification .notification-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .divy-notification .notification-message {
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOutNotification 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== INICIALIZAR - CARREGAR CONFIGURAÇÕES =====
// ===== EVENTOS DO HTML - CONSOLIDADO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('⚙️ Carregando sistema de configurações...');
    console.log('🔧 Inicializando event listeners...');

    // Carregar configurações do banco
    loadSettingsFromDatabase();
    
    // ===== MODO ESCURO (Específico) =====
    const darkModeToggle = document.querySelector('#appearance #darkModeToggle');
    if (darkModeToggle) {
        // Remover listeners antigos (evita duplicação)
        const newToggle = darkModeToggle.cloneNode(true);
        darkModeToggle.parentNode.replaceChild(newToggle, darkModeToggle);
        
        // Adicionar listener único
        newToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Prevenir cliques rápidos
            if (this.classList.contains('animating')) return;
            this.classList.add('animating');
            
            const newState = !nuraSettings.darkMode;
            toggleDarkMode(newState);
            
            // Liberar após 500ms
            setTimeout(() => {
                this.classList.remove('animating');
            }, 500);
        });
        console.log('✅ Toggle de modo escuro inicializado');
    }
    
    // ===== CORES =====
    document.querySelectorAll('.color-option').forEach(color => {
        color.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const hexColor = this.getAttribute('data-color');
            setPrimaryColor(hexColor);
        });
    });
    
    // ===== OUTROS TOGGLE SWITCHES (Exceto modo escuro e IA) =====
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        // Pular o toggle de modo escuro (já foi configurado acima)
        if (toggle.id === 'darkModeToggle') {
            console.log('⏭️ Pulando toggle de modo escuro (já configurado)');
            return;
        }

        // Pular toggles de IA (gerenciados pelo aiSettings.js)
        if (toggle.id === 'aiDescriptionsToggle' || toggle.id === 'aiOptimizationToggle') {
            console.log('⏭️ Pulando toggle de IA (gerenciado por aiSettings.js)');
            return;
        }

        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const row = this.closest('.setting-row');
            if (!row) return;

            const label = row.querySelector('.setting-label');
            if (!label) return;

            const text = label.textContent.toLowerCase();

            console.log('🔘 Toggle clicado:', text);

            if (text.includes('ocultar tarefas') || text.includes('concluídas')) {
                toggleHideCompleted(!nuraSettings.hideCompleted);
            } else if (text.includes('destacar') || text.includes('urgentes')) {
                toggleHighlightUrgent(!nuraSettings.highlightUrgent);
            } else if (text.includes('sugestões')) {
                toggleAutoSuggestions(!nuraSettings.autoSuggestions);
            } else if (text.includes('resumo diário') || text.includes('email')) {
                toggleEmailNotifications(!nuraSettings.emailNotifications);
            } else if (text.includes('relatório semanal')) {
                toggleWeeklyReport(!nuraSettings.weeklyReport);
            } else {
                // Toggle genérico para outros botões
                this.classList.toggle('active');
                console.log('✅ Toggle genérico ativado');
            }
        });
    });
    
    // Selects
    document.querySelectorAll('.setting-row').forEach(row => {
        const select = row.querySelector('select');
        if (!select) return;
        
        const label = row.querySelector('.setting-label');
        if (!label) return;
        
        const text = label.textContent.toLowerCase();
        
        if (text.includes('exibição')) {
            select.addEventListener('change', function() {
                setViewMode(this.value);
            });
        } else if (text.includes('detalhamento')) {
            select.addEventListener('change', function() {
                setDetailLevel(this.value);
            });
        }
    });
    
    // ===== TELEGRAM - Verificar status e configurar botões =====
    checkTelegramStatus();

    // Botão de vincular
    const saveTelegramBtn = document.getElementById('saveTelegram');
    if (saveTelegramBtn) {
        saveTelegramBtn.addEventListener('click', linkTelegram);
    }

    // Botão de desvincular
    const unlinkTelegramBtn = document.getElementById('unlinkTelegram');
    if (unlinkTelegramBtn) {
        unlinkTelegramBtn.addEventListener('click', unlinkTelegram);
    }

    // Enter no input
    const telegramInput = document.getElementById('telegramChatId');
    if (telegramInput) {
        telegramInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                linkTelegram();
            }
        });
    }

    console.log('✅ Event listeners configurados!');
});

// ===== GERENCIAMENTO DE TELEGRAM =====

async function checkTelegramStatus() {
    try {
        const userId = getCurrentUserId();
        if (!userId) return;

        const response = await fetch(`${SETTINGS_API_URL}/api/users`, {
            headers: { 'x-user-id': userId }
        });

        if (response.ok) {
            const data = await response.json();
            const currentUser = data.users.find(u => u.id == userId);

            if (currentUser && currentUser.telegram_chat_id) {
                showTelegramConnected();
            } else {
                showTelegramDisconnected();
            }
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status do Telegram:', error);
    }
}

function showTelegramConnected() {
    const inputRow = document.getElementById('telegramInputRow');
    const connectedRow = document.getElementById('telegramConnectedRow');
    const status = document.getElementById('telegramStatus');

    if (inputRow) inputRow.style.display = 'none';
    if (connectedRow) connectedRow.style.display = 'flex';
    if (status) {
        status.querySelector('.status-title').textContent = '✅ Telegram Vinculado';
        status.querySelector('.status-description').textContent = 'Você está recebendo notificações!';
        status.style.backgroundColor = '#d4edda';
        status.style.borderColor = '#c3e6cb';
    }
}

function showTelegramDisconnected() {
    const inputRow = document.getElementById('telegramInputRow');
    const connectedRow = document.getElementById('telegramConnectedRow');
    const status = document.getElementById('telegramStatus');

    if (inputRow) inputRow.style.display = 'flex';
    if (connectedRow) connectedRow.style.display = 'none';
    if (status) {
        status.querySelector('.status-title').textContent = 'Telegram não vinculado';
        status.querySelector('.status-description').textContent = 'Conecte seu Telegram para receber notificações aleatórias durante o dia';
        status.style.backgroundColor = '#f8f9fa';
        status.style.borderColor = '#dee2e6';
    }
}

async function linkTelegram() {
    const chatIdInput = document.getElementById('telegramChatId');
    const chatId = chatIdInput?.value.trim();

    if (!chatId) {
        showNotification('Por favor, cole o código do Telegram', 'error');
        return;
    }

    const userId = getCurrentUserId();
    if (!userId) {
        showNotification('Usuário não identificado', 'error');
        return;
    }

    try {
        const response = await fetch(`${SETTINGS_API_URL}/api/users/${userId}/telegram`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            },
            body: JSON.stringify({ telegram_chat_id: chatId })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Telegram vinculado com sucesso!', 'success');
            chatIdInput.value = '';
            showTelegramConnected();
        } else {
            showNotification(data.error || 'Erro ao vincular Telegram', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao vincular Telegram:', error);
        showNotification('Erro ao conectar com o servidor', 'error');
    }
}

async function unlinkTelegram() {
    const userId = getCurrentUserId();
    if (!userId) return;

    if (!confirm('Tem certeza que deseja desvincular seu Telegram?')) {
        return;
    }

    try {
        const response = await fetch(`${SETTINGS_API_URL}/api/users/${userId}/telegram`, {
            method: 'DELETE',
            headers: { 'x-user-id': userId }
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Telegram desvinculado', 'success');
            showTelegramDisconnected();
        } else {
            showNotification(data.error || 'Erro ao desvincular', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao desvincular Telegram:', error);
        showNotification('Erro ao conectar com o servidor', 'error');
    }
}

// ===== EXPORTAR FUNÇÕES =====
window.nuraSettingsFunctions = {
    loadSettingsFromDatabase: async function() {
        const user = getCurrentUser();
        
        const DEFAULTS = {
            hideCompleted: false,
            highlightUrgent: true,
            autoSuggestions: true,
            detailLevel: 'medio',
            darkMode: false,
            primaryColor: '#49a09d',
            currentPlan: 'free',
            planRenewalDate: '',
            viewMode: 'lista',
            showDetails: false,
            emailNotifications: true,
            weeklyReport: false,
            aiDescriptionsEnabled: true,
            aiDetailLevel: 'medio',
            aiOptimizationEnabled: true
        };
        
        if (!user) {
            console.warn('⚠️ Usuário não logado, usando configurações padrão');
            Object.assign(nuraSettings, DEFAULTS);
            this.applySettings();
            return;
        }

        console.log('⏳ Carregando configurações do banco para usuário:', user.id);

        try {
            const response = await fetch(`${SETTINGS_API_URL}/api/settings/${user.id}`);
            const data = await response.json();

            if (data.success && data.settings) {
                console.log('📥 Configurações carregadas do banco:', data.settings);
                console.log('📥 showDetails carregado:', data.settings.showDetails);
                
                Object.assign(nuraSettings, DEFAULTS, data.settings);
                
                console.log('✅ Configurações mescladas:', nuraSettings);
                console.log('✅ showDetails final:', nuraSettings.showDetails);
            } else {
                console.log('⚠️ Nenhuma configuração encontrada, usando padrão');
                Object.assign(nuraSettings, DEFAULTS);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar configurações:', error);
            Object.assign(nuraSettings, DEFAULTS);
        }
        
        const localShowDetails = localStorage.getItem('nura_showDetails');
        if (localShowDetails !== null) {
            nuraSettings.showDetails = localShowDetails === 'true';
            console.log('📦 showDetails do localStorage:', nuraSettings.showDetails);
        }

        const localHideCompleted = localStorage.getItem('nura_hideCompleted');
        if (localHideCompleted !== null) {
            nuraSettings.hideCompleted = localHideCompleted === 'true';
            console.log('📦 hideCompleted do localStorage:', nuraSettings.hideCompleted);
        }

        // ✅ FALLBACK: localStorage para highlightUrgent
        const localHighlightUrgent = localStorage.getItem('nura_highlightUrgent');
        if (localHighlightUrgent !== null) {
            nuraSettings.highlightUrgent = localHighlightUrgent === 'true';
            console.log('📦 highlightUrgent do localStorage:', nuraSettings.highlightUrgent);
        }

        this.applySettings();
    },

    saveSettingsToDatabase: async function() {
        const user = getCurrentUser();
        if (!user) {
            console.error('❌ Usuário não logado');
            return;
        }

        console.log('⚙️ Salvando configurações no banco...');
        console.log('📦 Configurações a salvar:', nuraSettings);

        try {
            const response = await fetch(`${SETTINGS_API_URL}/api/settings/${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuraSettings)
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Configurações salvas com sucesso!');
            } else {
                console.error('❌ Erro ao salvar:', result.error);
            }
        } catch (error) {
            console.error('❌ Erro de conexão:', error);
        }
    },
    
    applySettings: function() {
        if (nuraSettings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        document.documentElement.style.setProperty('--primary-color', nuraSettings.primaryColor);
        
        console.log('🎨 Configurações aplicadas');
    },
    
    toggleHideCompleted,
    toggleHighlightUrgent,
    toggleAutoSuggestions,
    toggleEmailNotifications,
    setDetailLevel,
    setViewMode,
    getPlanInfo,
    selectPlan,
    cancelPlan,
    toggleDarkMode,
    syncDarkMode,
    setPrimaryColor,
    showNotification,
    getSettings: () => nuraSettings,
    checkTelegramStatus,
    linkTelegram,
    unlinkTelegram
};

console.log('✅ settings.js carregado e pronto!');