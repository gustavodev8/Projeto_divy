// ===== NURA - SISTEMA DE LISTAS (MULTI-CADERNOS) =====

const LISTS_API = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api/lists'
    : `${window.location.origin}/api/lists`;

// Variável global para listas
window.userLists = [];
window.currentListId = null;

// ===== CARREGAR LISTAS =====
async function loadLists() {
    console.log('🔄 INICIANDO CARREGAMENTO DE LISTAS...');
    
    const user = getCurrentUser();
    console.log('👤 Usuário para carregar listas:', user);
    
    if (!user) {
        console.warn('⚠️ Usuário não identificado ao carregar listas');
        return;
    }
    try {
        const response = await fetch(`${LISTS_API}?user_id=${user.id}`, {
            headers: { 'x-user-id': user.id.toString() }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erro HTTP:', response.status, errorText);
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            window.userLists = data.lists;
            console.log(`📋 ${window.userLists.length} listas carregadas`);
            
            // Selecionar primeira lista ou lista padrão
            if (window.userLists.length > 0 && !window.currentListId) {
                const defaultList = window.userLists.find(l => l.is_default) || window.userLists[0];
                window.currentListId = defaultList.id;
            }

renderLists();
            console.log('✅ Listas renderizadas!');
            console.log('📋 Lista atual selecionada:', window.currentListId);
            console.log('📦 Total de listas:', window.userLists.length);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar listas:', error);
        showNotification('❌ Erro ao carregar listas');
    }
}

// ===== RENDERIZAR LISTAS NA SIDEBAR =====
function renderLists() {
    const container = document.querySelector('.lists-container');
    if (!container) return;

    container.innerHTML = '';

        console.log('🎨 RENDERIZANDO LISTAS:');
    console.log('   - Total:', window.userLists.length);
    console.log('   - Lista atual:', window.currentListId);

    window.userLists.forEach(list => {
        const isActive = list.id === window.currentListId;
        
        const listElement = document.createElement('div');
        listElement.className = `list-item ${isActive ? 'active' : ''}`;
        listElement.dataset.listId = list.id;
        
        listElement.innerHTML = `
            <div class="list-item-content" onclick="selectList(${list.id})">
                <span class="list-dot"></span>
                <span class="list-name">${list.name}</span>
                <span class="list-count">0</span>
            </div>
            <div class="list-item-actions">
                <button class="btn-icon-xs" onclick="editList(${list.id})" title="Editar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                ${!list.is_default ? `
                    <button class="btn-icon-xs" onclick="deleteList(${list.id})" title="Excluir">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(listElement);
    });

    // Atualizar contadores
    updateListTaskCounts();
}

// ===== SELECIONAR LISTA =====
async function selectList(listId) {
    console.log('📋 Selecionando lista:', listId);
    
    // ✅ Salvar lista atual
    window.currentListId = parseInt(listId);
    window.currentSmartFilter = null; // Limpar filtro inteligente
    
    localStorage.setItem('currentListId', listId);
    
    // ✅ Remover seleção de filtros inteligentes
    document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
        item.classList.remove('active');
    });
    
    // ✅ Atualizar UI das listas
    document.querySelectorAll('.list-item').forEach(item => {
        if (item.dataset.listId === listId.toString()) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // ✅ Carregar seções da lista
    if (typeof loadSections === 'function') {
        await loadSections(listId);
        console.log('📁 Seções carregadas para lista', listId);
    } else if (typeof loadSectionsForList === 'function') {
        await loadSectionsForList(listId);
        console.log('📁 Seções carregadas para lista', listId);
    }
    
    // ✅ Atualizar estado dos botões de adicionar tarefa
    if (typeof updateAddTaskButtonState === 'function') {
        updateAddTaskButtonState();
    } else if (typeof updateAddTaskButtonsState === 'function') {
        updateAddTaskButtonsState();
    }
    
    // ✅ Filtrar e renderizar tarefas
    if (typeof filterTasksByCurrentList === 'function') {
        filterTasksByCurrentList();
    }
    
    if (typeof renderAllTasks === 'function') {
        renderAllTasks();
    }
    
    // ✅ ATUALIZAR TÍTULO DA PÁGINA
    if (typeof updatePageTitle === 'function') {
        updatePageTitle();
    }
    
    console.log('✅ Lista selecionada:', listId);
}

// ===== CRIAR LISTA =====
async function createList(name, emoji = '📋', color = '#146551') {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const response = await fetch(LISTS_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': user.id.toString()
            },
            body: JSON.stringify({ user_id: user.id, name, emoji, color })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`✅ Lista "${name}" criada!`);
            await loadLists();
            return data.listId;
        }
    } catch (error) {
        console.error('❌ Erro ao criar lista:', error);
        showNotification('❌ Erro ao criar lista');
    }
    return null;
}

// ===== EDITAR LISTA =====
// ===== EDITAR LISTA =====
function editList(listId) {
    const list = window.userLists.find(l => l.id === listId);
    if (!list) return;

    console.log('📝 Editando lista:', list);

    // Remove foco atual
    document.activeElement?.blur();

    // Usa o modal que já existe no HTML
    const overlay = document.getElementById('editListModalOverlay');
    const modal = document.getElementById('editListModal');
    
    if (!overlay || !modal) {
        console.error('❌ Modal de editar lista não encontrado no HTML');
        return;
    }

    // Preenche os campos
    document.getElementById('editListName').value = list.name || '';
    document.getElementById('editListColor').value = list.color || '#146551';
    document.getElementById('editListEmojiBtn').textContent = list.emoji || '📋';

    // Guarda o ID da lista sendo editada
    window.editingListId = listId;
    console.log('✅ window.editingListId definido como:', window.editingListId);

    // Abre o modal
    overlay.style.display = 'flex';
    
    setTimeout(() => {
        overlay.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Foco no input
        setTimeout(() => {
            document.getElementById('editListName')?.focus();
        }, 100);
    }, 10);
}

async function submitEditList(listId) {
    const name = document.getElementById('editListName').value.trim();
    const emoji = document.getElementById('editListEmoji').value.trim() || '📋';
    const color = document.getElementById('editListColor').value;
    const user = getCurrentUser();

    if (!name) {
        alert('Digite um nome para a lista');
        return;
    }

    try {
        const response = await fetch(`${LISTS_API}/${listId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': user.id.toString()
            },
            body: JSON.stringify({ name, emoji, color })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('✅ Lista atualizada!');
            await loadLists();
            document.querySelector('.section-modal-overlay')?.remove();
        }
    } catch (error) {
        console.error('❌ Erro ao editar lista:', error);
        showNotification('❌ Erro ao editar lista');
    }
}

// ===== EXCLUIR LISTA =====
let pendingDeleteListId = null;

function deleteList(listId) {
    const list = window.userLists.find(l => l.id === listId);
    if (!list) return;

    if (list.is_default) {
        showNotification('❌ Não é possível excluir a lista padrão');
        return;
    }

    // Abrir modal de confirmação
    pendingDeleteListId = listId;
    showDeleteListModal(list.name);
}

// ===== MOSTRAR MODAL DE EXCLUIR LISTA =====
function showDeleteListModal(listName) {
    const overlay = document.getElementById('deleteListModalOverlay');
    const nameElement = document.getElementById('deleteListModalName');

    if (nameElement) {
        nameElement.textContent = listName;
    }

    if (overlay) {
        overlay.classList.add('active');
    }

    // Configurar botão de confirmar
    const confirmBtn = document.getElementById('confirmDeleteListBtn');
    if (confirmBtn) {
        confirmBtn.onclick = confirmDeleteList;
    }
}

// ===== FECHAR MODAL DE EXCLUIR LISTA =====
function closeDeleteListModal() {
    const overlay = document.getElementById('deleteListModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    pendingDeleteListId = null;
}

// ===== CONFIRMAR EXCLUSÃO DA LISTA =====
async function confirmDeleteList() {
    if (!pendingDeleteListId) return;

    const listId = pendingDeleteListId;
    const user = getCurrentUser();

    // Fechar modal
    closeDeleteListModal();

    try {
        const response = await fetch(`${LISTS_API}/${listId}?user_id=${user.id}`, {
            method: 'DELETE',
            headers: { 'x-user-id': user.id.toString() }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('🗑️ Lista excluída');

            // Se estava na lista excluída, voltar para lista padrão
            if (window.currentListId === listId) {
                const defaultList = window.userLists.find(l => l.is_default);
                if (defaultList) {
                    await selectList(defaultList.id);
                }
            }

            await loadLists();
        }
    } catch (error) {
        console.error('❌ Erro ao excluir lista:', error);
        showNotification('❌ Erro ao excluir lista');
    }
}

// ===== ATUALIZAR CONTADORES DE TAREFAS =====
function updateListTaskCounts() {
    if (!window.homeTasks || !window.userLists) return;
    
    window.userLists.forEach(list => {
        const count = window.homeTasks.filter(t => t.list_id === list.id).length;
        const listElement = document.querySelector(`[data-list-id="${list.id}"] .list-count`);
        if (listElement) {
            listElement.textContent = count;
        }
    });
}

/* ========================================
   CRIAR NOVA LISTA
   ======================================== */

function showCreateListModal() {
    const modalHTML = `
        <div class="list-modal-overlay active" id="listModalOverlay" onclick="closeCreateListModal()">
            <div class="list-modal" onclick="event.stopPropagation()">
                <div class="list-modal-header">
                    <h3 class="list-modal-title">Nova Lista</h3>
                    <button class="btn-close-modal" onclick="closeCreateListModal()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="list-modal-body">
                    <div class="list-form-field">
                        <label class="list-form-label">Nome da Lista</label>
                        <input
                            type="text"
                            id="listNameInput"
                            class="list-form-input"
                            placeholder="Ex: Trabalho, Estudos, Casa"
                            autocomplete="off"
                            onkeypress="if(event.key === 'Enter') saveNewList()"
                        />
                    </div>
                </div>

                <div class="list-modal-footer">
                    <button class="list-btn-cancel" onclick="closeCreateListModal()">
                        Cancelar
                    </button>
                    <button class="list-btn-save" onclick="saveNewList()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Criar Lista
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        document.getElementById('listNameInput')?.focus();
    }, 100);
}

function closeCreateListModal() {
    const overlay = document.getElementById('listModalOverlay');
    if (overlay) {
        overlay.remove();
    }
    document.body.style.overflow = '';
}

async function saveNewList() {
    console.log('💾 Salvando nova lista...');

    const nameInput = document.getElementById('listNameInput');
    const listName = nameInput?.value.trim();

    if (!listName) {
        alert('❌ Por favor, digite um nome para a lista');
        nameInput?.focus();
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        alert('❌ Usuário não encontrado. Faça login novamente.');
        return;
    }

    try {
        console.log('📤 Enviando lista para o servidor:', listName);

        const response = await fetch(`${API_URL}/api/lists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: listName,
                user_id: user.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Lista criada com sucesso:', result.list);

            // Fechar modal
            closeCreateListModal();

            // Recarregar listas na sidebar
            await loadLists();

            // Mostrar notificação
            showNotification('✅ Lista criada com sucesso!');

            // Selecionar a nova lista
            if (result.list && result.list.id) {
                await selectList(result.list.id);
            }

        } else {
            console.error('❌ Erro ao criar lista:', result.error);
            alert('❌ Erro ao criar lista: ' + (result.error || 'Erro desconhecido'));
        }
        
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
        alert('❌ Erro ao criar lista. Verifique sua conexão.');
    }
}

// Exportar funções globalmente
window.showCreateListModal = showCreateListModal;
window.closeCreateListModal = closeCreateListModal;
window.saveNewList = saveNewList;

// ===== EXPORTAR FUNÇÕES =====
window.loadLists = loadLists;
window.selectList = selectList;
window.createList = createList;
window.editList = editList;
window.deleteList = deleteList;
window.showDeleteListModal = showDeleteListModal;
window.closeDeleteListModal = closeDeleteListModal;
window.confirmDeleteList = confirmDeleteList;
window.showCreateListModal = showCreateListModal;
window.closeCreateListModal = closeCreateListModal;
window.saveNewList = saveNewList;
window.submitEditList = submitEditList;
window.updateListTaskCounts = updateListTaskCounts;

console.log('✅ lists.js carregado');