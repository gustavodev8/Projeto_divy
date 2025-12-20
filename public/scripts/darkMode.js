// ===== MODO ESCURO - OTIMIZADO E SEM CONFLITOS =====
// Arquivo: public/scripts/darkMode.js

(function() {
    'use strict';
    
    const SETTINGS_API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin;
    
    let currentUserId = null;
    let isInitializing = false;
    
    // ===== OBTER ID DO USUÁRIO =====
    function getCurrentUserId() {
        if (!currentUserId) {
            const userData = localStorage.getItem('nura_user');
            if (userData) {
                try {
                    currentUserId = JSON.parse(userData).id;
                } catch (e) {
                    return null;
                }
            }
        }
        return currentUserId;
    }
    
    // ===== CARREGAR DARK MODE DO BANCO (UMA VEZ) =====
    async function loadDarkModeFromDatabase() {
        try {
            const userId = getCurrentUserId();
            
            if (!userId) {
                const saved = localStorage.getItem('darkMode');
                return saved === 'true';
            }
            
            const response = await fetch(`${SETTINGS_API_URL}/api/settings/${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.settings && data.settings.darkMode !== undefined) {
                    return data.settings.darkMode;
                }
            }
            
            const saved = localStorage.getItem('darkMode');
            return saved === 'true';
            
        } catch (err) {
            console.error('❌ Erro ao carregar:', err);
            const saved = localStorage.getItem('darkMode');
            return saved === 'true';
        }
    }
    
    // ===== APLICAR MODO ESCURO (RÁPIDO) =====
    function applyDarkMode(isDark) {
        // Aplicar classe no body
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Atualizar ícone da navbar
        const sunIcon = document.querySelector('#darkModeToggle .sun-icon');
        const moonIcon = document.querySelector('#darkModeToggle .moon-icon');
        
        if (sunIcon && moonIcon) {
            if (isDark) {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            } else {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            }
        }
        
        // Salvar no localStorage (para sincronização rápida)
        localStorage.setItem('darkMode', isDark);
    }
    
    // ===== TOGGLE DO MODO ESCURO (APENAS NAVBAR) =====
    async function toggleDarkMode() {
        const currentState = document.body.classList.contains('dark-mode');
        const newState = !currentState;
        
        // Aplicar IMEDIATAMENTE na UI
        applyDarkMode(newState);
        
        // Animar botão
        const navbarToggle = document.querySelector('.navbar #darkModeToggle');
        if (navbarToggle) {
            navbarToggle.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                navbarToggle.style.transform = 'rotate(0deg)';
            }, 300);
        }
        
        // Notificar settings.js (se estiver na página)
        if (window.nuraSettingsFunctions) {
            window.nuraSettingsFunctions.syncDarkMode(newState);
        }
    }
    
    // ===== SINCRONIZAR ENTRE ABAS =====
    window.addEventListener('storage', function(e) {
        if (e.key === 'darkMode' && e.newValue !== null && !isInitializing) {
            const isDark = e.newValue === 'true';
            const currentState = document.body.classList.contains('dark-mode');
            
            if (isDark !== currentState) {
                applyDarkMode(isDark);
                console.log('🔄 Sincronizado entre abas');
            }
        }
    });
    
    // ===== LISTENER PARA MUDANÇAS DO SETTINGS.JS =====
    window.addEventListener('darkModeUpdated', function(e) {
        if (e.detail && e.detail.isDark !== undefined) {
            applyDarkMode(e.detail.isDark);
        }
    });
    
    // ===== INICIALIZAR (UMA VEZ) =====
    async function init() {
        if (isInitializing) return;
        isInitializing = true;
        
        console.log('🚀 Inicializando darkMode.js...');
        
        // Carregar estado do banco
        const isDark = await loadDarkModeFromDatabase();
        applyDarkMode(isDark);
        
        // Event listener APENAS no botão da NAVBAR
        const navbarToggle = document.querySelector('.navbar #darkModeToggle');
        if (navbarToggle) {
            // Remover listeners antigos
            const newToggle = navbarToggle.cloneNode(true);
            navbarToggle.parentNode.replaceChild(newToggle, navbarToggle);
            
            newToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleDarkMode();
            });
            newToggle.style.transition = 'transform 0.3s ease';
            console.log('✅ Toggle da navbar inicializado');
        }
        
        console.log('✅ darkMode.js pronto!');
        isInitializing = false;
    }
    
    // Executar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // ===== API PÚBLICA =====
    window.darkMode = {
        set: applyDarkMode,
        get: () => document.body.classList.contains('dark-mode'),
        toggle: toggleDarkMode
    };
    
})();