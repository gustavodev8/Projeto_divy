/* ========================================
   MENU DE OPÇÕES DE VISUALIZAÇÃO
   Integrado com settings.js e Tela de Ajustes
   ======================================== */

// ===== TOGGLE MENU =====
function toggleViewOptionsMenu() {
    const menu = document.getElementById('viewOptionsMenu');
    const isActive = menu.classList.contains('active');
    
    if (isActive) {
        closeViewOptionsMenu();
    } else {
        openViewOptionsMenu();
    }
}

function openViewOptionsMenu() {
    const menu = document.getElementById('viewOptionsMenu');
    menu.classList.add('active');
    
    // Criar overlay
    let overlay = document.getElementById('viewOptionsOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'viewOptionsOverlay';
        overlay.className = 'view-options-overlay';
        overlay.onclick = closeViewOptionsMenu;
        document.body.appendChild(overlay);
    }
    overlay.classList.add('active');
    
    // ✅ Atualizar estado dos checkboxes com dados reais
    updateMenuState();
    
    console.log('📋 Menu de opções aberto');
}

function closeViewOptionsMenu() {
    const menu = document.getElementById('viewOptionsMenu');
    const overlay = document.getElementById('viewOptionsOverlay');
    
    menu.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    console.log('📋 Menu de opções fechado');
}

// ===== ATUALIZAR ESTADO DO MENU =====
function updateMenuState() {
    console.log('🔄 Atualizando estado do menu...');
    
    // ✅ Tentar pegar do settings.js PRIMEIRO
    let settings = null;
    
    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.getSettings === 'function') {
        settings = window.nuraSettingsFunctions.getSettings();
        console.log('✅ Settings do nuraSettingsFunctions:', settings);
    } else {
        // ✅ FALLBACK: localStorage
        const stored = localStorage.getItem('nura_settings');
        if (stored) {
            try {
                settings = JSON.parse(stored);
                console.log('✅ Settings do localStorage:', settings);
            } catch (e) {
                console.error('❌ Erro ao parsear localStorage:', e);
            }
        }
    }
    
    // ✅ FALLBACK FINAL: valores padrão
    if (!settings) {
        settings = {
            viewMode: 'lista',
            hideCompleted: false,
            showDetails: true,
            highlightUrgent: false
        };
        console.log('⚠️ Usando settings padrão:', settings);
    }
    
    // Atualizar modo de visualização ativo
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.remove('active');
    });

    // Prioridade: window.currentViewMode > settings.viewMode > localStorage > 'lista'
    let currentView = window.currentViewMode
        || settings.viewMode
        || localStorage.getItem('nura_viewMode')
        || 'lista';

    // Normalizar para lowercase
    currentView = currentView.toLowerCase();

    const activeViewBtn = document.querySelector(`[data-view="${currentView}"]`);
    if (activeViewBtn) {
        activeViewBtn.classList.add('active');
        console.log('✅ Modo ativo:', currentView);
    } else {
        // Se não encontrou, marcar 'lista' como padrão
        const listaBtn = document.querySelector('[data-view="lista"]');
        if (listaBtn) listaBtn.classList.add('active');
    }
    
    // ✅ Atualizar checkbox "Esconder concluídas"
    const hideCompletedCheckbox = document.getElementById('toggleHideCompletedCheckbox');
    if (hideCompletedCheckbox) {
        // Verificar também localStorage individual
        const localHideCompleted = localStorage.getItem('nura_hideCompleted');
        const hideCompletedValue = localHideCompleted !== null
            ? localHideCompleted === 'true'
            : (settings.hideCompleted || false);

        hideCompletedCheckbox.checked = hideCompletedValue;
        console.log('✅ Esconder concluídas:', hideCompletedValue);
    }
    
    // ✅ Atualizar checkbox "Mostrar detalhes"
    const showDetailsCheckbox = document.getElementById('toggleShowDetailsCheckbox');
    if (showDetailsCheckbox) {
        showDetailsCheckbox.checked = settings.showDetails !== false; // padrão true
        console.log('✅ Mostrar detalhes:', settings.showDetails);
    }
}

// ===== MUDAR MODO DE VISUALIZAÇÃO =====
async function changeViewMode(mode) {
    console.log('🔄 Mudando modo de visualização para:', mode);

    // Atualizar variável global
    window.currentViewMode = mode;

    // Salvar nas configurações via settings.js (salva no banco de dados)
    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.setViewMode === 'function') {
        await window.nuraSettingsFunctions.setViewMode(mode);
        console.log('✅ Modo salvo no banco de dados:', mode);
    } else {
        // Fallback: salvar no localStorage
        localStorage.setItem('nura_viewMode', mode);

        // Atualizar objeto de settings se existir
        if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.getSettings === 'function') {
            const settings = window.nuraSettingsFunctions.getSettings();
            settings.viewMode = mode;
        }

        console.log('⚠️ Modo salvo apenas no localStorage:', mode);
    }

    // Atualizar indicadores visuais no menu
    document.querySelectorAll('.menu-item[data-view]').forEach(item => {
        const itemView = item.getAttribute('data-view');
        if (itemView === mode) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Fechar menu
    closeViewOptionsMenu();

    // Renderizar com o novo modo
    console.log('📊 Chamando renderAllTasks com modo:', mode);
    if (typeof renderAllTasks === 'function') {
        renderAllTasks();
    } else if (typeof window.renderAllTasks === 'function') {
        window.renderAllTasks();
    } else {
        console.error('❌ renderAllTasks não encontrado!');
    }
}

// Exportar função
window.changeViewMode = changeViewMode;

// ===== ESCONDER CONCLUÍDAS =====
async function toggleHideCompleted() {
    console.log('👁️ Toggle: Esconder concluídas (menu 3 pontinhos)');

    // Pegar valor atual
    let currentValue = false;

    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.getSettings === 'function') {
        currentValue = window.nuraSettingsFunctions.getSettings().hideCompleted;
    } else {
        const stored = localStorage.getItem('nura_hideCompleted');
        currentValue = stored === 'true';
    }

    const newValue = !currentValue;
    console.log('   Valor atual:', currentValue);
    console.log('   Novo valor:', newValue);

    // Usar settings.js se disponível
    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.toggleHideCompleted === 'function') {
        await window.nuraSettingsFunctions.toggleHideCompleted(newValue);
    } else {
        // FALLBACK: salvar no localStorage e aplicar
        localStorage.setItem('nura_hideCompleted', newValue.toString());

        // Aplicar diretamente
        document.querySelectorAll('[data-task-status="completed"]').forEach(task => {
            task.style.display = newValue ? 'none' : '';
        });

        const completedColumn = document.querySelector('[data-kanban-column="completed"]');
        if (completedColumn) {
            completedColumn.style.display = newValue ? 'none' : '';
        }

        // Re-renderizar se possível
        if (typeof renderAllTasks === 'function') {
            renderAllTasks();
        }

        showNotification(newValue ? '👁️ Tarefas concluídas ocultadas' : '👁️ Tarefas concluídas visíveis');
    }

    // Atualizar estado do menu
    updateMenuState();

    // Fechar menu após toggle
    closeViewOptionsMenu();
}

// ===== MOSTRAR DETALHES =====
async function toggleShowDetails() {
    console.log('👁️ Toggle: Mostrar detalhes');
    
    // ✅ Salvar via settings.js
    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.getSettings === 'function') {
        const settings = window.nuraSettingsFunctions.getSettings();
        const newValue = !settings.showDetails;
        
        console.log('   Valor atual:', settings.showDetails);
        console.log('   Novo valor:', newValue);
        
        // Atualizar localmente PRIMEIRO
        settings.showDetails = newValue;
        localStorage.setItem('nura_showDetails', newValue.toString());
        
        // Salvar no banco
        try {
            await window.nuraSettingsFunctions.saveSettingsToDatabase();
            console.log('✅ Settings salvas no banco');
            
            // Aguardar 200ms para garantir
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verificar se salvou
            const verificacao = window.nuraSettingsFunctions.getSettings();
            console.log('🔍 Verificação após salvar:', verificacao.showDetails);
            
            // Atualizar checkbox visualmente
            const checkbox = document.getElementById('toggleShowDetailsCheckbox');
            if (checkbox) {
                checkbox.checked = newValue;
                console.log('✅ Checkbox atualizado para:', newValue);
            }
            
            // Atualizar estado do menu
            updateMenuState();
            
            // RE-RENDERIZAR tarefas
            console.log('🎨 Iniciando re-renderização...');
            if (typeof renderAllTasks === 'function') {
                renderAllTasks();
            } else {
                console.error('❌ renderAllTasks não disponível');
            }
            
            const message = newValue ? 'Detalhes visíveis' : 'Apenas títulos';
            showNotification(`✅ ${message}`);
            
        } catch (error) {
            console.error('❌ Erro ao salvar settings:', error);
            showNotification('❌ Erro ao salvar configuração');
        }
    } else {
        // FALLBACK: localStorage
        const stored = localStorage.getItem('nura_settings') || '{}';
        const settings = JSON.parse(stored);
        settings.showDetails = !settings.showDetails;
        localStorage.setItem('nura_settings', JSON.stringify(settings));
        localStorage.setItem('nura_showDetails', settings.showDetails.toString());
        
        // Re-renderizar
        if (typeof renderAllTasks === 'function') {
            renderAllTasks();
        }
        
        updateMenuState();
        showNotification(`✅ ${settings.showDetails ? 'Detalhes visíveis' : 'Apenas títulos'}`);
    }
}

// ===== COMPARTILHAR =====
function shareList() {
    closeViewOptionsMenu();
    showNotification('🔗 Funcionalidade de compartilhamento em breve!');
}

// ===== ABRIR CONFIGURAÇÕES (Redireciona para Tela de Ajustes) =====
function openSettings() {
    closeViewOptionsMenu();
    
    // ✅ Redirecionar para tela de ajustes
    console.log('⚙️ Redirecionando para Tela de Ajustes...');
    window.location.href = 'Tela_Ajustes.html';
}

// ===== IMPRIMIR =====
function printList() {
    closeViewOptionsMenu();
    window.print();
}

// ===== SINCRONIZAÇÃO COM SETTINGS.JS =====
// Ouvir mudanças do settings.js
window.addEventListener('settingsUpdated', (event) => {
    console.log('🔔 Settings atualizados externamente:', event.detail);
    updateMenuState();
});

// ✅ OUVIR MUDANÇAS DE OUTRAS ABAS/PÁGINAS via localStorage
window.addEventListener('storage', (event) => {
    // Detectar mudança no hideCompleted
    if (event.key === 'nura_hideCompleted') {
        console.log('📢 Detectada mudança de hideCompleted em outra aba:', event.newValue);

        // Atualizar settings global
        if (window.nuraSettingsFunctions) {
            const currentSettings = window.nuraSettingsFunctions.getSettings();
            currentSettings.hideCompleted = event.newValue === 'true';
        }

        // Atualizar menu
        updateMenuState();

        // Re-renderizar tarefas
        if (typeof renderAllTasks === 'function') {
            renderAllTasks();
        }
        return;
    }

    if (event.key === 'nura_settings_update_trigger') {
        console.log('📢 Detectada mudança de settings em outra aba!');
        console.log('   Timestamp:', event.newValue);

        // Aguardar 300ms para localStorage estar atualizado
        setTimeout(() => {
            // Recarregar settings
            const stored = localStorage.getItem('nura_settings');
            if (stored) {
                try {
                    const newSettings = JSON.parse(stored);
                    console.log('📥 Novos settings:', newSettings);

                    // ✅ Atualizar objeto global se existe
                    if (window.nuraSettingsFunctions) {
                        const currentSettings = window.nuraSettingsFunctions.getSettings();
                        Object.assign(currentSettings, newSettings);
                        console.log('✅ Settings globais atualizados');
                    }
                    
                    // ✅ Atualizar menu
                    updateMenuState();
                    
                    // ✅ RE-RENDERIZAR tarefas
                    if (typeof renderAllTasks === 'function') {
                        console.log('🎨 Re-renderizando tarefas...');
                        renderAllTasks();
                    }
                    
                    console.log('✅ Sincronização completa!');
                } catch (e) {
                    console.error('❌ Erro ao parsear settings:', e);
                }
            }
        }, 300);
    }
});

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('⚙️ view-options-menu.js inicializando...');
    
    // Atualizar estado inicial após settings.js carregar
    setTimeout(() => {
        updateMenuState();
    }, 500);
});

// ===== EXPORTAR FUNÇÕES =====
window.toggleViewOptionsMenu = toggleViewOptionsMenu;
window.openViewOptionsMenu = openViewOptionsMenu;
window.closeViewOptionsMenu = closeViewOptionsMenu;
window.changeViewMode = changeViewMode;
window.toggleHideCompleted = toggleHideCompleted;
window.toggleShowDetails = toggleShowDetails;
window.shareList = shareList;
window.openSettings = openSettings;
window.printList = printList;
window.updateMenuState = updateMenuState;

console.log('✅ view-options-menu.js carregado e integrado com settings.js');