// ===== CONFIGURAÇÕES DE IA =====
// Gerencia as preferências de IA do usuário

const AI_SETTINGS_API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://basetestenura-3.onrender.com';

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

        const response = await fetch('https://basetestenura-3.onrender.com/api/ai/generate-description', {
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
function showNotification(message) {
    // Cria elemento de notificação se não existir
    let notification = document.querySelector('.ai-notification');

    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'ai-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #146551;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-size: 0.9rem;
            font-weight: 500;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(notification);
    }

    notification.textContent = message;

    // Anima entrada
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    // Remove após 3 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
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
