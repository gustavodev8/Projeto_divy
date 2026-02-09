// ===== CONFIGURAÇÕES DE IA =====
// Gerencia as preferências de IA do usuário

const AI_SETTINGS_API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// Configurações padrão
let aiSettings = {
    descriptionsEnabled: true,
    detailLevel: 'medio',
    optimizationEnabled: true
};

// Obter ID do usuário atual
function getCurrentUserId() {
    const userData = localStorage.getItem('nura_user');
    if (userData) {
        try {
            return JSON.parse(userData).id;
        } catch (e) {
            console.error('❌ Erro ao obter usuário:', e);
            return null;
        }
    }
    return null;
}

// Carregar configurações do banco de dados
async function loadAISettings() {
    const userId = getCurrentUserId();

    if (!userId) {
        console.warn('⚠️ Usuário não identificado, usando localStorage');
        return loadAISettingsFromLocalStorage();
    }

    try {
        const response = await fetch(`${AI_SETTINGS_API_URL}/api/settings/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (data.success && data.settings) {
                // Mapear configurações do banco para o formato local
                aiSettings = {
                    descriptionsEnabled: data.settings.aiDescriptionsEnabled !== false,
                    detailLevel: data.settings.aiDetailLevel || 'medio',
                    optimizationEnabled: data.settings.aiOptimizationEnabled !== false
                };
                console.log('✅ Configurações de IA carregadas do banco:', aiSettings);
                return aiSettings;
            }
        } else if (response.status === 404) {
            console.log('📝 Criando configurações de IA padrão no banco...');
            await saveAISettings();
            return aiSettings;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar configurações de IA do banco:', error);
    }

    // Fallback para localStorage
    return loadAISettingsFromLocalStorage();
}

// Carregar do localStorage (fallback)
function loadAISettingsFromLocalStorage() {
    const saved = localStorage.getItem('aiSettings');
    if (saved) {
        try {
            aiSettings = JSON.parse(saved);
        } catch (e) {
            console.error('Erro ao carregar configurações de IA do localStorage:', e);
        }
    }
    return aiSettings;
}

// Salvar configurações no banco de dados
async function saveAISettings() {
    const userId = getCurrentUserId();

    if (!userId) {
        console.warn('⚠️ Usuário não identificado, salvando no localStorage');
        localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
        return false;
    }

    try {
        // Carregar configurações atuais do banco
        const currentResponse = await fetch(`${AI_SETTINGS_API_URL}/api/settings/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            }
        });

        let allSettings = {
            // Valores padrão caso não exista configuração
            hideCompleted: false,
            highlightUrgent: true,
            autoSuggestions: true,
            detailLevel: 'Médio',
            darkMode: false,
            primaryColor: '#49a09d',
            currentPlan: 'pro',
            planRenewalDate: '30 de dezembro de 2025',
            viewMode: 'lista',
            emailNotifications: true,
            // Configurações de IA
            aiDescriptionsEnabled: aiSettings.descriptionsEnabled,
            aiDetailLevel: aiSettings.detailLevel,
            aiOptimizationEnabled: aiSettings.optimizationEnabled
        };

        // Se já existem configurações, mesclar com as existentes
        if (currentResponse.ok) {
            const currentData = await currentResponse.json();
            if (currentData.success && currentData.settings) {
                allSettings = {
                    ...currentData.settings,
                    // Sobrescrever apenas os campos de IA
                    aiDescriptionsEnabled: aiSettings.descriptionsEnabled,
                    aiDetailLevel: aiSettings.detailLevel,
                    aiOptimizationEnabled: aiSettings.optimizationEnabled
                };
            }
        }

        // Salvar no banco
        const response = await fetch(`${AI_SETTINGS_API_URL}/api/settings/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            },
            body: JSON.stringify({
                user_id: userId,
                settings: allSettings
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                console.log('✅ Configurações de IA salvas no banco');
                localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
                return true;
            }
        }

        const errorData = await response.json();
        console.error('❌ Erro ao salvar configurações de IA:', errorData);
        return false;

    } catch (error) {
        console.error('❌ Erro ao salvar configurações de IA:', error);
        localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
        return false;
    }
}

// Gerar descrição automática para uma tarefa
async function generateTaskDescription(taskTitle) {
    // Verifica se as descrições automáticas estão habilitadas
    if (!aiSettings.descriptionsEnabled) {
        return null;
    }

    try {
        console.log(`🤖 Solicitando descrição IA para: "${taskTitle}"`);

        const response = await fetch(`${AI_SETTINGS_API_URL}/api/ai/generate-description`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taskTitle: taskTitle,
                detailLevel: aiSettings.detailLevel
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Descrição gerada:', data.description);
            return data.description;
        } else {
            console.error('❌ Erro ao gerar descrição:', data.error);
            return null;
        }

    } catch (error) {
        console.error('💥 Erro na requisição de descrição:', error);
        return null;
    }
}

// Inicializar configurações na tela de ajustes
async function initAISettingsPage() {
    const descriptionsToggle = document.getElementById('aiDescriptionsToggle');
    const detailLevelSelect = document.getElementById('aiDetailLevel');
    const optimizationToggle = document.getElementById('aiOptimizationToggle');

    if (!descriptionsToggle || !detailLevelSelect || !optimizationToggle) {
        return; // Não está na página de ajustes
    }

    // Carregar configurações salvas (assíncrono)
    await loadAISettings();

    // Aplicar estado inicial
    if (aiSettings.descriptionsEnabled) {
        descriptionsToggle.classList.add('active');
    } else {
        descriptionsToggle.classList.remove('active');
    }

    detailLevelSelect.value = aiSettings.detailLevel;

    if (aiSettings.optimizationEnabled) {
        optimizationToggle.classList.add('active');
    } else {
        optimizationToggle.classList.remove('active');
    }

    // Event listeners
    descriptionsToggle.addEventListener('click', async () => {
        descriptionsToggle.classList.toggle('active');
        aiSettings.descriptionsEnabled = descriptionsToggle.classList.contains('active');
        await saveAISettings();
        showNotification(
            aiSettings.descriptionsEnabled
                ? '🤖 Descrições automáticas ativadas'
                : '🔕 Descrições automáticas desativadas'
        );
    });

    detailLevelSelect.addEventListener('change', async () => {
        aiSettings.detailLevel = detailLevelSelect.value;
        await saveAISettings();

        const levelNames = {
            'baixo': 'Baixo',
            'medio': 'Médio',
            'alto': 'Alto'
        };

        showNotification(`📊 Nível de detalhamento: ${levelNames[aiSettings.detailLevel]}`);
    });

    optimizationToggle.addEventListener('click', async () => {
        optimizationToggle.classList.toggle('active');
        aiSettings.optimizationEnabled = optimizationToggle.classList.contains('active');
        await saveAISettings();
        showNotification(
            aiSettings.optimizationEnabled
                ? '💡 Sugestões de otimização ativadas'
                : '🔕 Sugestões de otimização desativadas'
        );
    });
}

// Função auxiliar para mostrar notificações
function showNotification(message, type = 'info') {
    // Remover emojis da mensagem
    const cleanMessage = message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2705}]|[\u{274C}]|[\u{26A0}]|[\u{2139}]/gu, '').trim();

    // Detectar tipo baseado na mensagem original
    if (message.includes('✅') || message.toLowerCase().includes('ativad')) type = 'success';
    else if (message.includes('❌') || message.toLowerCase().includes('erro')) type = 'error';
    else if (message.includes('🔕') || message.toLowerCase().includes('desativad')) type = 'warning';

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

// Inicializar quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAISettingsPage);
} else {
    initAISettingsPage();
}

// Exportar funções para uso global
window.aiSettings = {
    load: loadAISettings,
    save: saveAISettings,
    generateDescription: generateTaskDescription,
    get: () => aiSettings
};
