console.log('🚀 KANBAN-VIEW.JS INICIANDO...');

/* ========================================
   VISUALIZAÇÃO KANBAN PROFISSIONAL
   ======================================== */

(function() {
    'use strict';
    
    console.log('📦 Encapsulando kanban-view.js');
    
    // Variáveis privadas
    let editingSectionId = null;
    let draggedCard = null;

    // ===== RENDERIZAR KANBAN =====
    function renderKanbanView(container) {
        console.log('🎯 renderKanbanView() chamado');
        
        if (!container) {
            console.error('❌ Container não encontrado');
            return;
        }

        const settings = window.nuraSettingsFunctions ? window.nuraSettingsFunctions.getSettings() : {};
        
        container.innerHTML = '';
        container.className = 'kanban-board';

        let tasks = window.currentSmartFilter 
            ? filterTasksBySmartFilter(window.currentSmartFilter)
            : (window.currentListTasks || []);
        
        const sections = window.currentSections || [];
        
        console.log('📊 Kanban:', tasks.length, 'tarefas |', sections.length, 'seções');

        const columnsWrapper = document.createElement('div');
        columnsWrapper.className = 'kanban-columns';

        if (window.currentSmartFilter) {
            const statusColumns = {
                pending: { title: '📋 Pendente', color: '#f39c12', tasks: [] },
                in_progress: { title: '🔄 Em Progresso', color: '#3498db', tasks: [] },
                completed: { title: '✅ Concluído', color: '#2ecc71', tasks: [] }
            };

            tasks.forEach(task => {
                let status = task.status.toLowerCase();
                if (status === 'concluída' || status === 'concluido') status = 'completed';
                else if (status === 'progresso' || status === 'in_progress') status = 'in_progress';
                else status = 'pending';
                
                statusColumns[status].tasks.push(task);
            });

            Object.keys(statusColumns).forEach(key => {
                columnsWrapper.appendChild(createStatusColumn(key, statusColumns[key]));
            });
        } else {
            const noSectionTasks = tasks.filter(t => !t.section_id);
            if (noSectionTasks.length > 0 || sections.length === 0) {
                columnsWrapper.appendChild(createColumn({ id: null, name: 'Tarefas', emoji: null }, noSectionTasks));
            }

            sections.forEach(section => {
                const sectionTasks = tasks.filter(t => t.section_id === section.id);
                columnsWrapper.appendChild(createColumn(section, sectionTasks));
            });

            if (window.currentListId) {
                const addBtn = document.createElement('div');
                addBtn.className = 'kanban-add-column';
                addBtn.innerHTML = `
                    <button class="btn-add-kanban-column" onclick="showCreateSectionModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>Nova seção</span>
                    </button>
                `;
                columnsWrapper.appendChild(addBtn);
            }
        }

        container.appendChild(columnsWrapper);

        if (!window.currentSmartFilter) {
            initDragDrop();
        }
        
        console.log('✅ Kanban renderizado');
    }

    // ===== CRIAR COLUNA POR STATUS =====
    function createStatusColumn(statusKey, column) {
        const div = document.createElement('div');
        div.className = 'kanban-column';
        div.setAttribute('data-kanban-status', statusKey);
        
        div.innerHTML = `
            <div class="kanban-column-header" style="border-bottom: 3px solid ${column.color}">
                <h3 class="kanban-column-title">${column.title}</h3>
                <span class="kanban-column-count" style="background: ${column.color}">${column.tasks.length}</span>
            </div>
            <div class="kanban-column-content">
                ${column.tasks.length === 0 ? '<div class="kanban-empty">Nenhuma tarefa</div>' : ''}
            </div>
        `;
        
        const content = div.querySelector('.kanban-column-content');
        column.tasks.forEach(task => {
            content.appendChild(createCard(task));
        });
        
        return div;
    }

    // ===== CRIAR COLUNA POR SEÇÃO =====
    function createColumn(section, tasks) {
        const div = document.createElement('div');
        div.className = 'kanban-column';
        div.setAttribute('data-section-id', section.id || 'none');
        
        const header = document.createElement('div');
        header.className = 'kanban-column-header';
        header.innerHTML = `
            <div class="kanban-column-info">
                <h3 class="kanban-column-title">${section.emoji ? section.emoji + ' ' : ''}${section.name}</h3>
                <span class="kanban-column-count">${tasks.filter(t => t.status !== 'completed').length}</span>
            </div>
            <div class="kanban-column-actions">
                <button class="btn-kanban-icon" onclick="window.addTaskToKanbanSection(${section.id || null})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                ${section.id ? `
                    <button class="btn-kanban-icon" onclick="window.toggleKanbanSectionMenu(event, ${section.id})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
        
        const content = document.createElement('div');
        content.className = 'kanban-cards-container';
        content.setAttribute('data-section-drop', section.id || 'none');
        
        if (tasks.length === 0) {
            content.innerHTML = `
                <div class="kanban-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    </svg>
                    <p>Nenhuma tarefa</p>
                </div>
            `;
        } else {
            tasks.forEach(task => content.appendChild(createCard(task)));
        }
        
        div.appendChild(header);
        div.appendChild(content);
        return div;
    }

    // ===== CRIAR CARD COM CHECKBOX =====
// ===== CRIAR CARD COM MENU DE 3 PONTINHOS =====
function createCard(task) {
    const settings = window.nuraSettingsFunctions ? window.nuraSettingsFunctions.getSettings() : {};
    const showDetails = settings.showDetails || false;
    
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-priority', task.priority || 'medium');
    card.setAttribute('draggable', 'true');
    
    const isCompleted = task.status === 'completed' || task.status === 'concluída';
    if (isCompleted) {
        card.classList.add('is-completed');
    }
    
    // Header com checkbox
    const cardHeader = document.createElement('div');
    cardHeader.className = 'kanban-card-header';
    
    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'kanban-card-checkbox';
    checkboxLabel.onclick = (e) => e.stopPropagation();
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCompleted;
    checkbox.onchange = () => window.toggleTaskFromKanban(task.id);
    
    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';
    
    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkmark);
    cardHeader.appendChild(checkboxLabel);
    
    // Título
    const title = document.createElement('h4');
    title.className = 'kanban-card-title';
    if (isCompleted) title.classList.add('task-completed');
    title.textContent = task.title || task.name;
    cardHeader.appendChild(title);
    
    card.appendChild(cardHeader);
    
    // Descrição (opcional)
    if (showDetails && task.description) {
        const desc = document.createElement('p');
        desc.className = 'kanban-card-description';
        desc.textContent = task.description;
        card.appendChild(desc);
    }
    
    // Data (opcional)
    if (showDetails && task.due_date) {
        const meta = document.createElement('div');
        meta.className = 'kanban-card-meta';
        
        const date = document.createElement('span');
        date.className = 'kanban-card-date';
        date.textContent = `📅 ${formatDate(task.due_date)}`;
        
        meta.appendChild(date);
        card.appendChild(meta);
    }
    
    // ✅ BOTÃO DE MENU (3 PONTINHOS)
    const menuBtn = document.createElement('button');
    menuBtn.className = 'kanban-card-menu-btn';
    menuBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
        </svg>
    `;
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        showCardMenu(e, task);
    };
    card.appendChild(menuBtn);
    
    // Click no card
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.kanban-card-checkbox') && !e.target.closest('.kanban-card-menu-btn')) {
            if (typeof openTaskDetailPanel === 'function') openTaskDetailPanel(task.id);
        }
    });
    
    return card;
}

// ===== MENU DO CARD =====
function showCardMenu(event, task) {
    // Fechar menu existente
    const existingMenu = document.getElementById('kanbanCardMenu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.id = 'kanbanCardMenu';
    menu.className = 'kanban-card-dropdown';
    
    const rect = event.target.getBoundingClientRect();
    menu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 4}px;
        left: ${rect.left - 140}px;
        z-index: 1000;
    `;
    
    menu.innerHTML = `
        <button class="kanban-card-dropdown-item" onclick="openTaskDetailPanel(${task.id}); document.getElementById('kanbanCardMenu').remove();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Editar
        </button>
        <button class="kanban-card-dropdown-item danger" onclick="showConfirmDeleteModal(${task.id}, '${escapeHtml(task.title || task.name)}'); document.getElementById('kanbanCardMenu').remove();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Excluir
        </button>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', closeCardMenu);
    }, 0);
}

function closeCardMenu() {
    const menu = document.getElementById('kanbanCardMenu');
    if (menu) menu.remove();
    document.removeEventListener('click', closeCardMenu);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

    // ===== FILTROS =====
    function filterTasksBySmartFilter(filterType) {
        const tasks = window.homeTasks || [];
        const today = new Date().toISOString().split('T')[0];
        
        switch (filterType) {
            case 'inbox': return tasks.filter(t => !t.due_date && t.status !== 'completed');
            case 'today': return tasks.filter(t => t.due_date === today && t.status !== 'completed');
            case 'next7days': {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                return tasks.filter(t => {
                    if (!t.due_date || t.status === 'completed') return false;
                    const dueDate = new Date(t.due_date);
                    return dueDate >= new Date() && dueDate <= nextWeek;
                });
            }
            case 'all': return tasks;
            default: return tasks;
        }
    }

    // ===== DRAG & DROP =====
    function initDragDrop() {
        document.querySelectorAll('.kanban-card[draggable="true"]').forEach(card => {
            card.addEventListener('dragstart', e => {
                draggedCard = e.target;
                e.target.classList.add('is-dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            });
            card.addEventListener('dragend', e => {
                e.target.classList.remove('is-dragging');
                document.querySelectorAll('.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
            });
        });

        document.querySelectorAll('[data-section-drop]').forEach(zone => {
            zone.addEventListener('dragover', e => {
                e.preventDefault();
                e.currentTarget.classList.add('is-drag-over');
            });
            zone.addEventListener('dragleave', e => {
                e.currentTarget.classList.remove('is-drag-over');
            });
            zone.addEventListener('drop', async e => {
                e.preventDefault();
                e.currentTarget.classList.remove('is-drag-over');
                
                const taskId = parseInt(e.dataTransfer.getData('text/plain'));
                const sectionId = e.currentTarget.dataset.sectionDrop === 'none' ? null : parseInt(e.currentTarget.dataset.sectionDrop);
                
                if (draggedCard) {
                    const empty = e.currentTarget.querySelector('.kanban-empty-state');
                    if (empty) empty.remove();
                    e.currentTarget.appendChild(draggedCard);
                    
                    const user = getCurrentUser();
                    if (user) {
                        await fetch(`${API_URL}/api/tasks/${taskId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'X-User-ID': user.id.toString() },
                            body: JSON.stringify({ section_id: sectionId, user_id: user.id })
                        });
                    }
                    updateKanbanColumnCounts();
                }
            });
        });
    }

    // ===== TOGGLE TAREFA =====
    window.toggleTaskFromKanban = async function(taskId) {
        console.log('🔄 Toggle task Kanban:', taskId);
        
        const user = getCurrentUser();
        if (!user) return;
        
        try {
            const task = window.homeTasks?.find(t => t.id === taskId);
            if (!task) return;
            
            const isCompleted = task.status === 'completed' || task.status === 'concluída';
            const newStatus = isCompleted ? 'pending' : 'completed';
            
            const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': user.id.toString()
                },
                body: JSON.stringify({ status: newStatus, user_id: user.id })
            });
            
            const result = await response.json();
            
            if (result.success) {
                task.status = newStatus;
                
                const card = document.querySelector(`.kanban-card[data-task-id="${taskId}"]`);
                if (card) {
                    const title = card.querySelector('.kanban-card-title');
                    const checkbox = card.querySelector('input[type="checkbox"]');
                    
                    if (newStatus === 'completed') {
                        card.classList.add('is-completed');
                        if (title) title.classList.add('task-completed');
                        if (checkbox) checkbox.checked = true;
                    } else {
                        card.classList.remove('is-completed');
                        if (title) title.classList.remove('task-completed');
                        if (checkbox) checkbox.checked = false;
                    }
                }
                
                updateKanbanColumnCounts();
                if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
            }
        } catch (error) {
            console.error('❌ Erro:', error);
        }
    };

    // ===== ATUALIZAR CONTADORES =====
    function updateKanbanColumnCounts() {
        document.querySelectorAll('.kanban-column').forEach(column => {
            const cards = column.querySelectorAll('.kanban-card:not(.is-completed)');
            const countEl = column.querySelector('.kanban-column-count');
            if (countEl) countEl.textContent = cards.length;
        });
    }

    // ===== UTILITÁRIOS =====
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString.split('T')[0]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return 'Amanhã';
        if (diffDays === -1) return 'Ontem';
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    // ===== FUNÇÕES AUXILIARES =====
    window.addTaskToKanbanSection = function(sectionId) {
        window.preSelectedSectionId = sectionId;
        if (typeof openTaskModal === 'function') openTaskModal();
    };

    window.toggleKanbanSectionMenu = function(event, sectionId) {
        console.log('Menu da seção:', sectionId);
    };

    // ===== EXPORTAR =====
    window.renderKanbanView = renderKanbanView;
    
    console.log('✅ kanban-view.js carregado');
    console.log('✅ renderKanbanView:', typeof window.renderKanbanView);
})();