/* ========================================
   VISUALIZAÇÃO KANBAN PROFISSIONAL
   Colunas baseadas em SEÇÕES (como TickTick)
   ======================================== */

// ===== RENDERIZAR VISUALIZAÇÃO KANBAN =====
function renderKanbanView(container) {
    console.log('🎯 Renderizando visualização Kanban');
    
    if (!container) {
        console.error('❌ Container não encontrado');
        return;
    }

    // ✅ VERIFICAR CONFIGURAÇÕES LOGO NO INÍCIO
    const settings = window.nuraSettingsFunctions ? window.nuraSettingsFunctions.getSettings() : {};
    console.log('👁️ Kanban - Configurações:');
    console.log('   showDetails:', settings.showDetails);
    console.log('   viewMode:', settings.viewMode);

    // Limpar container
    container.innerHTML = '';
    container.className = 'kanban-board';

    // ✅ DECIDIR QUAIS TAREFAS USAR
    let tasks = [];
    
    if (window.currentSmartFilter) {
        // Usar filtro inteligente
        tasks = filterTasksBySmartFilter(window.currentSmartFilter);
        console.log('📊 Kanban com filtro inteligente:', window.currentSmartFilter, '→', tasks.length, 'tarefas');
    } else {
        // Usar tarefas da lista atual
        tasks = window.currentListTasks || [];
        console.log('📊 Kanban com lista:', window.currentListId, '→', tasks.length, 'tarefas');
    }
    
    const sections = window.currentSections || [];
    
    console.log('📊 Total:', tasks.length, 'tarefas |', sections.length, 'seções');

    // Criar wrapper de colunas
    const columnsWrapper = document.createElement('div');
    columnsWrapper.className = 'kanban-columns';

    // ✅ SE ESTÁ EM FILTRO INTELIGENTE → USAR COLUNAS DE STATUS
    if (window.currentSmartFilter) {
        console.log('🎯 Modo Kanban: Filtro Inteligente (colunas por status)');
        
        const statusColumns = {
            pending: { title: '📋 Pendente', color: '#f39c12', tasks: [] },
            in_progress: { title: '🔄 Em Progresso', color: '#3498db', tasks: [] },
            completed: { title: '✅ Concluído', color: '#2ecc71', tasks: [] }
        };

        tasks.forEach(task => {
            let status = task.status.toLowerCase();
            
            if (status === 'concluída' || status === 'concluido') {
                status = 'completed';
            } else if (status === 'progresso' || status === 'in_progress') {
                status = 'in_progress';
            } else {
                status = 'pending';
            }
            
            if (statusColumns[status]) {
                statusColumns[status].tasks.push(task);
            } else {
                statusColumns.pending.tasks.push(task);
            }
        });

        Object.keys(statusColumns).forEach(statusKey => {
            const column = statusColumns[statusKey];
            const columnDiv = createStatusKanbanColumn(statusKey, column);
            columnsWrapper.appendChild(columnDiv);
        });
    } 
    // ✅ SENÃO → USAR COLUNAS DE SEÇÕES
    else {
        console.log('📁 Modo Kanban: Lista (colunas por seções)');
        
        // Seção "Sem seção" (tarefas sem section_id)
        const noSectionTasks = tasks.filter(t => !t.section_id);
        if (noSectionTasks.length > 0 || sections.length === 0) {
            columnsWrapper.appendChild(createKanbanColumn({
                id: null,
                name: 'Tarefas',
                emoji: null
            }, noSectionTasks));
        }

        // Criar coluna para cada seção
        sections.forEach(section => {
            const sectionTasks = tasks.filter(t => t.section_id === section.id);
            columnsWrapper.appendChild(createKanbanColumn(section, sectionTasks));
        });

        // Botão de adicionar nova seção (apenas se estiver em lista)
        if (window.currentListId) {
            const addSectionBtn = document.createElement('div');
            addSectionBtn.className = 'kanban-add-column';
            
            const button = document.createElement('button');
            button.className = 'btn-add-kanban-column';
            button.onclick = () => {
                if (typeof showCreateSectionModal === 'function') {
                    showCreateSectionModal();
                }
            };
            
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Nova seção</span>
            `;
            
            addSectionBtn.appendChild(button);
            columnsWrapper.appendChild(addSectionBtn);
        }
    }

    container.appendChild(columnsWrapper);

    // Inicializar drag & drop (apenas se não estiver em filtro)
    if (!window.currentSmartFilter) {
        initKanbanDragDrop();
    }
    
    console.log('✅ Kanban renderizado');
}

// ===== CRIAR COLUNA KANBAN POR STATUS (FILTROS) =====
function createStatusKanbanColumn(statusKey, column) {
    const columnDiv = document.createElement('div');
    columnDiv.className = 'kanban-column';
    columnDiv.setAttribute('data-kanban-status', statusKey);
    
    // Header
    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.style.borderBottom = `3px solid ${column.color}`;
    
    const title = document.createElement('h3');
    title.className = 'kanban-column-title';
    title.textContent = column.title;
    
    const count = document.createElement('span');
    count.className = 'kanban-column-count';
    count.style.background = column.color;
    count.textContent = column.tasks.length;
    
    header.appendChild(title);
    header.appendChild(count);
    columnDiv.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.className = 'kanban-column-content';
    
    if (column.tasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'kanban-empty';
        empty.textContent = 'Nenhuma tarefa';
        content.appendChild(empty);
    } else {
        column.tasks.forEach(task => {
            const card = createKanbanCard(task);
            content.appendChild(card);
        });
    }
    
    columnDiv.appendChild(content);
    
    return columnDiv;
}

// ===== CRIAR COLUNA KANBAN (POR SEÇÃO) =====
function createKanbanColumn(section, tasks) {
    const columnDiv = document.createElement('div');
    columnDiv.className = 'kanban-column';
    columnDiv.setAttribute('data-section-id', section.id || 'none');
    
    // Header
    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    
    const info = document.createElement('div');
    info.className = 'kanban-column-info';
    
    const title = document.createElement('h3');
    title.className = 'kanban-column-title';
    title.textContent = section.emoji ? `${section.emoji} ${section.name}` : section.name;
    
    const count = document.createElement('span');
    count.className = 'kanban-column-count';
    const pendingCount = tasks.filter(t => t.status !== 'completed').length;
    count.textContent = pendingCount;
    
    info.appendChild(title);
    info.appendChild(count);
    header.appendChild(info);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'kanban-column-actions';
    
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn-kanban-icon';
    btnAdd.title = 'Adicionar tarefa';
    btnAdd.onclick = () => addTaskToKanbanSection(section.id || null);
    btnAdd.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    actions.appendChild(btnAdd);
    
    if (section.id) {
        const btnMore = document.createElement('button');
        btnMore.className = 'btn-kanban-icon';
        btnMore.title = 'Mais opções';
        btnMore.onclick = (e) => toggleKanbanSectionMenu(e, section.id);
        btnMore.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
            </svg>
        `;
        actions.appendChild(btnMore);
    }
    
    header.appendChild(actions);
    columnDiv.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.className = 'kanban-cards-container';
    content.setAttribute('data-section-drop', section.id || 'none');
    
    if (tasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'kanban-empty-state';
        empty.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <p>Nenhuma tarefa</p>
        `;
        content.appendChild(empty);
    } else {
        tasks.forEach(task => {
            const card = createKanbanCard(task);
            content.appendChild(card);
        });
    }
    
    columnDiv.appendChild(content);
    
    return columnDiv;
}

// ===== CRIAR CARD KANBAN =====
// ===== CRIAR CARD KANBAN =====
function createKanbanCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-priority', task.priority || 'medium');
    card.setAttribute('draggable', 'true');
    
    // ✅ VERIFICAR SE DEVE MOSTRAR DETALHES
    let showDetails = false;
    
    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.getSettings === 'function') {
        const settings = window.nuraSettingsFunctions.getSettings();
        showDetails = settings.showDetails || false;
    }
    
    // Header (vazio, apenas para estrutura)
    const cardHeader = document.createElement('div');
    cardHeader.className = 'kanban-card-header';
    card.appendChild(cardHeader);
    
    // Title
    const title = document.createElement('h4');
    title.className = 'kanban-card-title';
    title.textContent = task.title || task.name;
    card.appendChild(title);
    
    // Description (apenas se showDetails estiver ativo E tarefa tiver descrição)
    if (showDetails && task.description) {
        const desc = document.createElement('p');
        desc.className = 'kanban-card-description';
        desc.textContent = task.description;
        card.appendChild(desc);
    }
    
    // Meta (apenas se showDetails estiver ativo E tarefa tiver data)
    if (showDetails && task.due_date) {
        const meta = document.createElement('div');
        meta.className = 'kanban-card-meta';
        
        const date = document.createElement('span');
        date.className = 'kanban-card-date';
        date.textContent = `📅 ${formatDate(task.due_date)}`;
        
        meta.appendChild(date);
        card.appendChild(meta);
    }
    
    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'kanban-card-actions';
    
    const btnEdit = document.createElement('button');
    btnEdit.className = 'kanban-card-btn';
    btnEdit.title = 'Abrir detalhes';
    btnEdit.onclick = (e) => {
        e.stopPropagation();
        if (typeof openTaskDetailPanel === 'function') {
            openTaskDetailPanel(task.id);
        }
    };
    btnEdit.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
    `;
    
    const btnDelete = document.createElement('button');
    btnDelete.className = 'kanban-card-btn btn-delete';
    btnDelete.title = 'Excluir';
    btnDelete.onclick = (e) => {
        e.stopPropagation();
        console.log('🗑️ Botão delete clicado no Kanban, task:', task.id, task.title);
        
        // ✅ CHAMAR FUNÇÃO CORRETA
        if (typeof showConfirmDeleteModal === 'function') {
            showConfirmDeleteModal(task.id, task.title || task.name);
        } else {
            console.error('❌ showConfirmDeleteModal não está disponível');
        }
    };
    btnDelete.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    `;
    
    actionsDiv.appendChild(btnEdit);
    actionsDiv.appendChild(btnDelete);
    card.appendChild(actionsDiv);
    
    // Click no card
    card.addEventListener('click', () => {
        if (typeof openTaskDetailPanel === 'function') {
            openTaskDetailPanel(task.id);
        }
    });
    
    return card;
}

// ===== FILTRAR TAREFAS POR FILTRO INTELIGENTE =====
function filterTasksBySmartFilter(filterType) {
    if (!filterType) return window.homeTasks || [];
    
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    switch (filterType) {
        case 'inbox':
            return window.homeTasks.filter(t => !t.due_date && t.status !== 'completed');
        
        case 'today':
            return window.homeTasks.filter(t => t.due_date === today && t.status !== 'completed');
        
        case 'next7days':
            return window.homeTasks.filter(t => {
                if (!t.due_date || t.status === 'completed') return false;
                const dueDate = new Date(t.due_date);
                return dueDate >= new Date() && dueDate <= nextWeek;
            });
        
        case 'all':
            return window.homeTasks || [];
        
        default:
            return window.homeTasks || [];
    }
}

// ===== DRAG & DROP =====
let kanbanDraggedCard = null;

function initKanbanDragDrop() {
    console.log('🎯 Inicializando drag & drop Kanban');
    
    document.querySelectorAll('.kanban-card[draggable="true"]').forEach(card => {
        card.addEventListener('dragstart', handleKanbanDragStart);
        card.addEventListener('dragend', handleKanbanDragEnd);
    });

    document.querySelectorAll('[data-section-drop]').forEach(zone => {
        zone.addEventListener('dragover', handleKanbanDragOver);
        zone.addEventListener('dragleave', handleKanbanDragLeave);
        zone.addEventListener('drop', handleKanbanDrop);
    });
}

function handleKanbanDragStart(e) {
    kanbanDraggedCard = e.target;
    e.target.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
}

function handleKanbanDragEnd(e) {
    e.target.classList.remove('is-dragging');
    document.querySelectorAll('.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
    kanbanDraggedCard = null;
}

function handleKanbanDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('is-drag-over');
}

function handleKanbanDragLeave(e) {
    e.currentTarget.classList.remove('is-drag-over');
}

async function handleKanbanDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('is-drag-over');

    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    const targetSectionId = e.currentTarget.dataset.sectionDrop;
    const finalSectionId = targetSectionId === 'none' ? null : parseInt(targetSectionId);

    if (kanbanDraggedCard) {
        const emptyState = e.currentTarget.querySelector('.kanban-empty-state');
        if (emptyState) emptyState.remove();
        
        e.currentTarget.appendChild(kanbanDraggedCard);
        await moveTaskToSectionKanban(taskId, finalSectionId);
        updateKanbanColumnCounts();
    }
}

async function moveTaskToSectionKanban(taskId, sectionId) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-User-ID': user.id.toString()
            },
            body: JSON.stringify({
                section_id: sectionId,
                user_id: user.id
            })
        });

        const result = await response.json();

        if (result.success) {
            const task = window.homeTasks.find(t => t.id === taskId);
            if (task) task.section_id = sectionId;
            
            const currentTask = window.currentListTasks?.find(t => t.id === taskId);
            if (currentTask) currentTask.section_id = sectionId;
        }
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

function updateKanbanColumnCounts() {
    document.querySelectorAll('.kanban-column').forEach(column => {
        const cards = column.querySelectorAll('.kanban-card:not(.is-completed)');
        const countEl = column.querySelector('.kanban-column-count');
        if (countEl) countEl.textContent = cards.length;
    });
}

function addTaskToKanbanSection(sectionId) {
    window.preSelectedSectionId = sectionId;
    if (typeof openTaskModal === 'function') {
        openTaskModal();
    }
}

function toggleKanbanSectionMenu(event, sectionId) {
    event.stopPropagation();
    showNotification('🔜 Menu em desenvolvimento');
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString.split('T')[0] + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCompare = new Date(date);
    dateToCompare.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((dateToCompare - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays === -1) return 'Ontem';
    if (diffDays < 0) return `${Math.abs(diffDays)} dias atrás`;
    if (diffDays < 7) return `Em ${diffDays} dias`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ===== EXPORTAR =====
window.addTaskToKanbanSection = addTaskToKanbanSection;
window.toggleKanbanSectionMenu = toggleKanbanSectionMenu;
window.filterTasksBySmartFilter = filterTasksBySmartFilter;

console.log('✅ kanban-view.js carregado (profissional)');