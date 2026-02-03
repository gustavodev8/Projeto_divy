// ===== NURA - SISTEMA DE SEÇÕES (TICKTICK STYLE) =====

const SECTIONS_API = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api/sections'
    : `${window.location.origin}/api/sections`;

// Variável global para seções (draggedTask está no sincro_telas.js)
window.userSections = [];

// ===== CARREGAR SEÇÕES (COM FILTRO DE LISTA) =====
async function loadSections(listId) {
    if (!listId) {
        console.warn('⚠️ loadSections: listId não fornecido');
        window.currentSections = [];
        return [];
    }

    const userId = getCurrentUser()?.id;
    if (!userId) {
        console.error('❌ Usuário não logado');
        window.currentSections = [];
        return [];
    }

    console.log('📡 Carregando seções:', `${API_URL}/api/sections?user_id=${userId}&list_id=${listId}`);

    try {
        const response = await fetch(`${API_URL}/api/sections?user_id=${userId}&list_id=${listId}`);
        const data = await response.json();

        if (data.success && data.sections) {
            // ✅ EXPORTAR GLOBALMENTE
            window.currentSections = data.sections;
            
            console.log(`✅ ${data.sections.length} seções carregadas (lista ${listId})`);
            console.log('📊 Seções:', data.sections);
            
            return data.sections;
        } else {
            console.warn('⚠️ Nenhuma seção encontrada');
            window.currentSections = [];
            return [];
        }
    } catch (error) {
        console.error('❌ Erro ao carregar seções:', error);
        window.currentSections = [];
        return [];
    }
}

// ===== CRIAR SEÇÃO (COM LISTA) =====
async function createSection(sectionName) {
    if (!sectionName || sectionName.trim() === '') {
        showNotification('❌ Digite um nome para a seção');
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        showNotification('❌ Usuário não autenticado');
        return;
    }

    // ✅ PEGAR LISTA ATUAL
    const currentListId = window.currentListId;
    
    if (!currentListId) {
        showNotification('❌ Nenhuma lista selecionada');
        console.error('❌ currentListId não definido');
        return;
    }

    console.log('📂 Criando seção:', sectionName, 'na lista:', currentListId);

    try {
        const response = await fetch(`${API_URL}/api/sections`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-User-ID': user.id.toString()
            },
            body: JSON.stringify({
                name: sectionName.trim(),
                user_id: user.id,
                list_id: currentListId,  // ✅ IMPORTANTE
                position: (window.currentSections?.length || 0)
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Seção criada:', result.section);
            
            // Adicionar à lista local
            if (!window.currentSections) {
                window.currentSections = [];
            }
            window.currentSections.push(result.section);

            showNotification('✅ Seção criada');
            
            // Re-renderizar
            if (typeof renderAllTasks === 'function') {
                renderAllTasks();
            }

        } else {
            console.error('❌ Erro do servidor:', result);

            // Verificar se é erro de limite de plano
            if (result.code === 'PLAN_LIMIT_REACHED' && window.PlanService) {
                // Fechar modal de criar seção primeiro (se existir)
                if (typeof closeCreateSectionModal === 'function') {
                    closeCreateSectionModal();
                }

                // Pequeno delay para garantir que o modal fechou
                setTimeout(() => {
                    window.PlanService.showUpgradeModal(
                        result.error || 'Você atingiu o limite de seções do seu plano.',
                        result.plan || 'normal',
                        result.upgrade || 'pro'
                    );
                }, 100);
            } else {
                showNotification('❌ ' + (result.error || 'Erro ao criar seção'));
            }
        }

    } catch (error) {
        console.error('❌ Erro ao criar seção:', error);
        showNotification('❌ Erro de conexão');
    }
}

// ===== VARIÁVEL PARA ARMAZENAR SEÇÃO PENDENTE DE EXCLUSÃO =====
let pendingDeleteSectionId = null;

// ===== MOSTRAR MODAL DE EXCLUIR SEÇÃO =====
function showDeleteSectionModal(sectionId, sectionName) {
    console.log('🗑️ Abrindo modal de excluir seção:', sectionId, sectionName);

    pendingDeleteSectionId = sectionId;

    const overlay = document.getElementById('deleteSectionModalOverlay');
    const nameElement = document.getElementById('deleteSectionModalName');

    if (nameElement) {
        nameElement.textContent = sectionName;
    }

    if (overlay) {
        overlay.classList.add('active');
    }

    // Configurar botão de confirmar
    const confirmBtn = document.getElementById('confirmDeleteSectionBtn');
    if (confirmBtn) {
        confirmBtn.onclick = confirmDeleteSection;
    }
}

// ===== FECHAR MODAL DE EXCLUIR SEÇÃO =====
function closeDeleteSectionModal() {
    const overlay = document.getElementById('deleteSectionModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    pendingDeleteSectionId = null;
}

// ===== CONFIRMAR EXCLUSÃO DA SEÇÃO =====
async function confirmDeleteSection() {
    if (!pendingDeleteSectionId) return;

    const sectionId = pendingDeleteSectionId;
    const user = getCurrentUser();

    if (!user) {
        showNotification('❌ Usuário não identificado');
        return;
    }

    // Fechar modal
    closeDeleteSectionModal();

    try {
        const response = await fetch(`${SECTIONS_API}/${sectionId}?user_id=${user.id}`, {
            method: 'DELETE',
            headers: { 'x-user-id': user.id.toString() }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('🗑️ Seção excluída');

            // Remover da lista local
            if (window.currentSections) {
                window.currentSections = window.currentSections.filter(s => s.id !== sectionId);
            }

            // Recarregar tarefas (as tarefas da seção agora ficam sem seção)
            if (typeof loadAndDisplayTasksFromDatabase === 'function') {
                await loadAndDisplayTasksFromDatabase();
            } else if (typeof renderAllTasks === 'function') {
                renderAllTasks();
            }
        } else {
            showNotification('❌ Erro ao excluir seção');
        }
    } catch (error) {
        console.error('❌ Erro ao excluir seção:', error);
        showNotification('❌ Erro de conexão');
    }
}

// ===== EXCLUIR SEÇÃO (LEGADO - COM CONFIRM) =====
async function deleteSection(sectionId) {
    const user = getCurrentUser();
    if (!user) return;

    const section = window.currentSections?.find(s => s.id === sectionId) ||
                    window.userSections?.find(s => s.id === sectionId);

    if (!confirm(`Excluir seção "${section?.name}"? As tarefas serão movidas para "Sem Seção".`)) return;

    try {
        const response = await fetch(`${SECTIONS_API}/${sectionId}?user_id=${user.id}`, {
            method: 'DELETE',
            headers: { 'x-user-id': user.id.toString() }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('🗑️ Seção excluída');
            await loadSections(window.currentListId);
            if (typeof renderAllTasks === 'function') {
                renderAllTasks();
            }
        }
    } catch (error) {
        console.error('❌ Erro ao excluir seção:', error);
    }
}

// ===== TOGGLE COLAPSAR SEÇÃO =====
async function toggleSectionCollapse(sectionId) {
    const user = getCurrentUser();
    if (!user) return;

    const section = window.userSections.find(s => s.id === sectionId);
    if (!section) return;

    const newState = !section.is_collapsed;

    try {
        await fetch(`${SECTIONS_API}/${sectionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': user.id.toString()
            },
            body: JSON.stringify({ 
                user_id: user.id, 
                is_collapsed: newState 
            })
        });

        section.is_collapsed = newState;

        // Toggle visual
        const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionElement) {
            sectionElement.classList.toggle('collapsed', newState);
        }
    } catch (error) {
        console.error('❌ Erro ao toggle seção:', error);
    }
}

// ===== EDITAR SEÇÃO =====
function editSection(sectionId) {
    const section = window.userSections.find(s => s.id === sectionId);
    if (!section) return;

    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal">
            <div class="section-modal-header">
                <h3>Editar Seção</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Emoji</label>
                    <input type="text" id="editSectionEmoji" value="${section.emoji || '📁'}" maxlength="2" style="width: 60px; text-align: center; font-size: 1.5rem;">
                </div>
                <div class="section-modal-field">
                    <label>Nome da Seção</label>
                    <input type="text" id="editSectionName" value="${section.name}" autofocus>
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitEditSection(${sectionId})">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('editSectionName').focus();
}

async function submitEditSection(sectionId) {
    const name = document.getElementById('editSectionName').value.trim();
    const emoji = document.getElementById('editSectionEmoji').value.trim() || '📁';
    const user = getCurrentUser();

    if (!name) {
        alert('Digite um nome para a seção');
        return;
    }

    try {
        const response = await fetch(`${SECTIONS_API}/${sectionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': user.id.toString()
            },
            body: JSON.stringify({ user_id: user.id, name, emoji })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('✅ Seção atualizada!');
            await loadSections(window.currentListId);
            if (typeof renderAllTasks === 'function') {
                renderAllTasks();
            }
            document.querySelector('.section-modal-overlay')?.remove();
        }
    } catch (error) {
        console.error('❌ Erro ao editar seção:', error);
    }
}

// ===== MODAL CRIAR SEÇÃO =====
function showCreateSectionModal() {
    console.log('🎨 Abrindo modal de criar seção');
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'createSectionModalOverlay';
    
    modal.innerHTML = `
        <div class="modal-container" style="max-width: 480px;">
            <div class="modal-header">
                <h3 class="modal-title">Nova Seção</h3>
                <button class="btn-close-modal" onclick="closeCreateSectionModal()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <div class="modal-body">
                <p class="modal-description">
                    As seções ajudam você a organizar suas tarefas em grupos dentro de uma lista.
                </p>
                
                <div class="form-field">
                    <label class="form-label">Nome da seção</label>
                    <input 
                        type="text" 
                        id="newSectionName" 
                        class="form-input" 
                        placeholder="Ex: Trabalho, Pessoal, Urgente..."
                        maxlength="50"
                        autocomplete="off"
                    />
                    <span class="form-hint">Máximo 50 caracteres</span>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-modal-secondary" onclick="closeCreateSectionModal()">
                    Cancelar
                </button>
                <button class="btn-modal-primary" onclick="submitCreateSection()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Criar Seção</span>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar com ESC
    document.addEventListener('keydown', handleCreateSectionEscape);
    
    // Focar no input
    setTimeout(() => {
        const input = document.getElementById('newSectionName');
        if (input) input.focus();
    }, 100);
    
    console.log('✅ Modal de criar seção aberto');
}

function handleCreateSectionEscape(e) {
    if (e.key === 'Escape') {
        closeCreateSectionModal();
    }
}

function closeCreateSectionModal() {
    const modal = document.getElementById('createSectionModalOverlay');
    if (modal) {
        modal.remove();
        document.removeEventListener('keydown', handleCreateSectionEscape);
    }
}

async function submitCreateSection() {
    const input = document.getElementById('newSectionName');
    const name = input?.value.trim();
    
    if (!name) {
        showNotification('❌ Digite um nome para a seção');
        input?.focus();
        return;
    }
    
    if (!window.currentListId) {
        showNotification('❌ Selecione uma lista primeiro');
        return;
    }
    
    const user = getCurrentUser();
    if (!user) {
        showNotification('❌ Usuário não identificado');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                list_id: window.currentListId,
                user_id: user.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Seção criada:', result.section);
            
            // Adicionar à lista local
            if (!window.currentSections) {
                window.currentSections = [];
            }
            window.currentSections.push(result.section);
            
            closeCreateSectionModal();
            
            // Recarregar tarefas para mostrar nova seção
            if (typeof loadAndDisplayTasksFromDatabase === 'function') {
                await loadAndDisplayTasksFromDatabase();
            }
            
            showNotification('✅ Seção criada com sucesso!');
        } else {
            // Verificar se é erro de limite de plano
            if (result.code === 'PLAN_LIMIT_REACHED' && window.PlanService) {
                closeCreateSectionModal();

                // Pequeno delay para garantir que o modal fechou
                setTimeout(() => {
                    window.PlanService.showUpgradeModal(
                        result.error || 'Você atingiu o limite de seções do seu plano.',
                        result.plan || 'normal',
                        result.upgrade || 'pro'
                    );
                }, 100);
            } else {
                showNotification('❌ ' + (result.error || 'Erro ao criar seção'));
            }
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('❌ Erro de conexão');
    }
}


// ===== RENDERIZAR SEÇÕES (PLACEHOLDER) =====
function renderSections(sections, listId) {
    // Esta função é chamada em modo lista, mas não no Kanban
    // No Kanban, a renderização é feita por renderKanbanView()
    console.log('📋 renderSections chamada (modo lista)');
    
    // Se estiver no modo Kanban, não fazer nada
    const settings = window.nuraSettingsFunctions?.getSettings() || {};
    if (settings.viewMode === 'kanban') {
        console.log('⏭️ Pulando renderSections (modo Kanban)');
        return;
    }
    
    // Aqui viria a lógica de renderizar seções no modo lista
    // Por enquanto, apenas log
    console.log(`📊 Renderizar ${sections.length} seções para lista ${listId}`);
}

// ===== VARIÁVEL GLOBAL PARA ARMAZENAR ID DA SEÇÃO SENDO EDITADA =====
let currentEditingSectionId = null;

// ===== ABRIR MODAL DE EDITAR SEÇÃO =====
function openEditSectionModal(sectionId) {
    console.log('✏️ Abrindo modal de editar seção:', sectionId);
    
    const section = window.currentSections?.find(s => s.id === sectionId);
    
    if (!section) {
        console.error('❌ Seção não encontrada:', sectionId);
        showNotification('❌ Seção não encontrada');
        return;
    }

    currentEditingSectionId = sectionId;
    
    const modal = document.getElementById('editSectionModal');
    const overlay = document.getElementById('editSectionModalOverlay');
    const input = document.getElementById('editSectionNameInput');
    
    if (!modal || !overlay || !input) {
        console.error('❌ Elementos do modal não encontrados');
        return;
    }

    // Preencher input com nome atual
    input.value = section.name;
    
    // Mostrar modal
    overlay.classList.add('active');
    modal.classList.add('active');
    
    // Focar no input
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
    
    console.log('✅ Modal de editar seção aberto');
}

// ===== FECHAR MODAL =====
function closeEditSectionModal() {
    const modal = document.getElementById('editSectionModal');
    const overlay = document.getElementById('editSectionModalOverlay');
    
    if (!modal || !overlay) return;

    modal.classList.remove('active');
    overlay.classList.remove('active');
    
    // Limpar
    setTimeout(() => {
        document.getElementById('editSectionNameInput').value = '';
        currentEditingSectionId = null;
    }, 300);
    
    console.log('✅ Modal de editar seção fechado');
}

// ===== SALVAR NOME EDITADO =====
async function saveEditedSectionName() {
    if (!currentEditingSectionId) {
        console.error('❌ Nenhuma seção sendo editada');
        return;
    }

    const newName = document.getElementById('editSectionNameInput').value.trim();
    
    if (!newName) {
        showNotification('❌ Digite um nome para a seção');
        document.getElementById('editSectionNameInput').focus();
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        showNotification('❌ Usuário não logado');
        return;
    }

    console.log('💾 Salvando novo nome:', newName);

    try {
        const response = await fetch(`${API_URL}/api/sections/${currentEditingSectionId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-User-ID': user.id.toString()
            },
            body: JSON.stringify({
                name: newName,
                user_id: user.id
            })
        });

        const result = await response.json();

        if (result.success) {
            // Atualizar localmente
            const section = window.currentSections.find(s => s.id === currentEditingSectionId);
            if (section) {
                section.name = newName;
            }

            showNotification('✅ Seção renomeada');
            closeEditSectionModal();
            
            // Re-renderizar
            if (typeof renderAllTasks === 'function') {
                renderAllTasks();
            }
            
            console.log('✅ Seção renomeada com sucesso');
        } else {
            showNotification('❌ Erro ao renomear seção');
            console.error('Erro:', result);
        }
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        showNotification('❌ Erro de conexão');
    }
}

// ===== FECHAR COM ESC =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Fechar modal de editar seção
        const editModal = document.getElementById('editSectionModal');
        if (editModal && editModal.classList.contains('active')) {
            closeEditSectionModal();
            return;
        }

        // Fechar modal de excluir seção
        const deleteModal = document.getElementById('deleteSectionModalOverlay');
        if (deleteModal && deleteModal.classList.contains('active')) {
            closeDeleteSectionModal();
            return;
        }
    }
});

async function saveEditedSection() {
    const sectionId = window.editingSectionId;
    const newName = document.getElementById('editSectionNameInput')?.value?.trim();
    
    if (!sectionId) {
        console.error('❌ ID da seção não encontrado');
        showNotification('Erro ao identificar seção', 'error');
        return;
    }
    
    if (!newName) {
        console.error('❌ Nome da seção vazio');
        showNotification('Digite um nome para a seção', 'error');
        return;
    }
    
    try {
        console.log(`📝 Salvando edição da seção ${sectionId}: "${newName}"`);
        
        const baseUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin;
        const response = await fetch(`${baseUrl}/sections/${sectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        console.log('✅ Seção atualizada:', result);
        
        const section = window.sections?.find(s => s.id === sectionId);
        if (section) {
            section.name = newName;
        }
        
        closeEditSectionModal();
        
        if (window.currentListId && typeof carregarTarefasDaLista === 'function') {
            await carregarTarefasDaLista(window.currentListId);
        }
        
        if (typeof showNotification === 'function') {
            showNotification('Seção atualizada!', 'success');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
        if (typeof showNotification === 'function') {
            showNotification('Erro ao atualizar seção', 'error');
        }
    }
}

window.saveEditedSection = saveEditedSection;

// ===== EXPORTAR FUNÇÕES =====
window.openEditSectionModal = openEditSectionModal;
window.closeEditSectionModal = closeEditSectionModal;
window.saveEditedSectionName = saveEditedSectionName;

console.log('✅ Funções de edição de seção exportadas');

// Exportar
window.renderSections = renderSections;

// ===== EXPORTAR FUNÇÕES =====
window.currentSections = [];
// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.loadSections = loadSections;
window.createSection = createSection;
window.renderSections = renderSections;
window.toggleSectionCollapse = toggleSectionCollapse;
window.deleteSection = deleteSection;
window.showCreateSectionModal = showCreateSectionModal;
window.closeCreateSectionModal = closeCreateSectionModal;
window.submitCreateSection = submitCreateSection;
window.showDeleteSectionModal = showDeleteSectionModal;
window.closeDeleteSectionModal = closeDeleteSectionModal;
window.confirmDeleteSection = confirmDeleteSection;

console.log('✅ sections.js carregado');