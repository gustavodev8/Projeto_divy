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
        const payload = { settings };
        
        console.log('📤 Payload enviado:', payload);
        
        const response = await fetch(`${API_URL}/api/settings/${currentUser.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser.id.toString()
            },
            body: JSON.stringify(payload)
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