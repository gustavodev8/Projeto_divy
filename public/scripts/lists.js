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

    window.userLists.forEach(list => {
        const isActive = list.id === window.currentListId;
        
        const listElement = document.createElement('div');
        listElement.className = `list-item ${isActive ? 'active' : ''}`;
        listElement.dataset.listId = list.id;
        
        listElement.innerHTML = `
            <div class="list-item-content" onclick="selectList(${list.id})">
                <span class="list-emoji">${list.emoji || '📋'}</span>
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
    window.currentListId = listId;
    
    // Atualizar visual da sidebar
    document.querySelectorAll('.list-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.listId) === listId);
    });

    // Carregar seções dessa lista
    if (typeof loadSections === 'function') {
        await loadSections(listId);
    }
    
    // Recarregar tarefas
    if (typeof loadAndDisplayTasksFromDatabase === 'function') {
        await loadAndDisplayTasksFromDatabase();
    }

    // Atualizar título da página
    const list = window.userLists.find(l => l.id === listId);
    if (list) {
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            const emoji = pageTitle.querySelector('.title-emoji');
            if (emoji) emoji.textContent = list.emoji || '📋';
            
            // Atualizar texto do título
            const titleText = Array.from(pageTitle.childNodes).find(node => node.nodeType === 3);
            if (titleText) {
                titleText.textContent = list.name;
            } else {
                pageTitle.innerHTML = `<span class="title-emoji">${list.emoji || '📋'}</span>${list.name}`;
            }
        }
    }
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
function editList(listId) {
    const list = window.userLists.find(l => l.id === listId);
    if (!list) return;

    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal">
            <div class="section-modal-header">
                <h3>Editar Lista</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Emoji</label>
                    <input type="text" id="editListEmoji" value="${list.emoji || '📋'}" maxlength="2">
                </div>
                <div class="section-modal-field">
                    <label>Nome da Lista</label>
                    <input type="text" id="editListName" value="${list.name}" autofocus>
                </div>
                <div class="section-modal-field">
                    <label>Cor</label>
                    <input type="color" id="editListColor" value="${list.color || '#146551'}">
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitEditList(${listId})">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('editListName').focus();
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
async function deleteList(listId) {
    const list = window.userLists.find(l => l.id === listId);
    if (!list) return;

    if (list.is_default) {
        alert('Não é possível excluir a lista padrão');
        return;
    }

    if (!confirm(`Excluir lista "${list.name}"? As tarefas e seções serão movidas para a lista padrão.`)) return;

    const user = getCurrentUser();

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

// ===== MODAL CRIAR LISTA =====
function showCreateListModal() {
    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal">
            <div class="section-modal-header">
                <h3>Nova Lista</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Emoji</label>
                    <input type="text" id="newListEmoji" value="📋" maxlength="2">
                </div>
                <div class="section-modal-field">
                    <label>Nome da Lista</label>
                    <input type="text" id="newListName" placeholder="Ex: Trabalho, Estudos, Casa..." autofocus>
                </div>
                <div class="section-modal-field">
                    <label>Cor</label>
                    <input type="color" id="newListColor" value="#146551">
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitCreateList()">Criar Lista</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('newListName').focus();
}

async function submitCreateList() {
    const name = document.getElementById('newListName').value.trim();
    const emoji = document.getElementById('newListEmoji').value.trim() || '📋';
    const color = document.getElementById('newListColor').value;

    if (!name) {
        alert('Digite um nome para a lista');
        return;
    }

    const listId = await createList(name, emoji, color);
    document.querySelector('.section-modal-overlay')?.remove();
    
    // Selecionar a nova lista
    if (listId) {
        await selectList(listId);
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

// ===== EXPORTAR FUNÇÕES =====
window.loadLists = loadLists;
window.selectList = selectList;
window.createList = createList;
window.editList = editList;
window.deleteList = deleteList;
window.showCreateListModal = showCreateListModal;
window.submitCreateList = submitCreateList;
window.submitEditList = submitEditList;
window.updateListTaskCounts = updateListTaskCounts;

console.log('✅ lists.js carregado');