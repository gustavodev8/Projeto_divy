/* ========================================
   SISTEMA DE TAREFAS - COM KANBAN E SEÇÕES
   Arquivo: sincro_telas.js
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

let homeTasks = [];
let currentUser = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando sistema de tarefas...');
    
    currentUser = getCurrentUser();
    
    if (!currentUser) {
        console.error('❌ Usuário não está logado!');
        window.location.href = '/login';
        return;
    }
    
    console.log('👤 Usuário logado:', currentUser.username);
    
    initializeTaskSystem();
    
    // Aguardar settings carregar
    if (window.nuraSettingsFunctions) {
        await window.nuraSettingsFunctions.loadSettingsFromDatabase();
    }
    
    // Carregar seções primeiro
    if (typeof loadSections === 'function') {
        await loadSections();
    }
    
    loadAndDisplayTasksFromDatabase();
});

// ===== INICIALIZAR SISTEMA DE TAREFAS =====
function initializeTaskSystem() {
    const btnAdicionar = document.getElementById('btnAdicionar');
    const blocoTarefas = document.getElementById('blocoTarefas');
    const textareaTarefa = document.getElementById('textareaTarefa');
    const btnSalvar = document.getElementById('btnSalvar');
    const btnCancelar = document.getElementById('btnCancelar');
    const listaTarefas = document.getElementById('listaTarefas');

    if (!btnAdicionar || !blocoTarefas || !textareaTarefa || !btnSalvar || !btnCancelar || !listaTarefas) {
        console.error('❌ Elementos do sistema de tarefas não encontrados!');
        return;
    }

    btnAdicionar.addEventListener('click', () => {
        blocoTarefas.classList.remove('escondido');
        textareaTarefa.focus();
    });

    btnCancelar.addEventListener('click', () => {
        blocoTarefas.classList.add('escondido');
        textareaTarefa.value = '';
    });

    btnSalvar.addEventListener('click', async () => {
        const texto = textareaTarefa.value.trim();
        
        if (!texto) {
            alert('Por favor, digite uma tarefa!');
            return;
        }

        if (!currentUser) {
            alert('❌ Erro: Usuário não identificado!');
            return;
        }

        try {
            const tarefaData = {
                title: texto,
                description: 'Tarefa criada na página inicial',
                status: 'pending',
                priority: 'medium',
                user_id: currentUser.id
            };

            console.log('📤 Enviando tarefa:', tarefaData);

            const response = await fetch(`${API_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tarefaData)
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Tarefa salva!');
                
                textareaTarefa.value = '';
                blocoTarefas.classList.add('escondido');
                
                loadAndDisplayTasksFromDatabase();
                showNotification('✅ Tarefa criada com sucesso!');
            } else {
                console.error('❌ Erro:', result.error);
                showNotification('❌ Erro ao salvar: ' + (result.error || 'Erro desconhecido'));
            }

        } catch (error) {
            console.error('💥 Erro de conexão:', error);
            showNotification('❌ Erro de conexão com o servidor');
        }
    });

    textareaTarefa.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            btnSalvar.click();
        }
    });

    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('show');
        });
    }
}

// ===== CARREGAR TAREFAS DO USUÁRIO =====
async function loadAndDisplayTasksFromDatabase() {
    if (!currentUser) {
        console.error('❌ Usuário não identificado!');
        return;
    }

    try {
        console.log(`📥 Carregando tarefas do usuário ${currentUser.username}...`);
        
        const response = await fetch(`${API_URL}/api/tasks?user_id=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            homeTasks = data.tasks;
            console.log(`✅ ${homeTasks.length} tarefas carregadas`);
            
            renderAllTasks();
            applyTaskFilters();
        } else {
            console.error('❌ Erro:', data.error);
            showEmptyState();
        }
    } catch (error) {
        console.error('❌ Erro de conexão:', error);
        showEmptyState();
    }
}

// ===== RENDERIZAR TAREFAS (LISTA OU KANBAN) =====
function renderAllTasks() {
    const container = document.getElementById('listaTarefas');
    if (!container) {
        console.error('❌ Container não encontrado!');
        return;
    }

    if (homeTasks.length === 0) {
        showEmptyState();
        return;
    }

    // Obter modo de visualização
    const settings = window.nuraSettingsFunctions ? window.nuraSettingsFunctions.getSettings() : { viewMode: 'lista' };
    const viewMode = settings.viewMode || 'lista';
    
    console.log('📊 Modo de visualização:', viewMode);

    if (viewMode.toLowerCase() === 'kanban') {
        renderKanbanView(container);
    } else {
        renderListView(container);
    }
    
    // Aplicar destaques após renderizar
    setTimeout(() => {
        forceApplyHighlights();
    }, 100);
}

// ===== RENDERIZAR VISTA EM LISTA (COM SEÇÕES) =====
function renderListView(container) {
    container.innerHTML = '';
    container.style.display = 'block';
    container.style.flexDirection = '';
    container.style.gap = '';

    // Verificar se tem seções para usar o novo sistema
    if (typeof window.userSections !== 'undefined' && window.userSections && window.userSections.length > 0) {
        console.log('📁 Renderizando com seções...');
        renderTasksWithSections(container);
        return;
    }

    // Fallback: renderização sem seções (ordenada por prioridade)
    console.log('📋 Renderizando lista simples...');
    
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    
    const sortedTasks = [...homeTasks].sort((a, b) => {
        const aCompleted = a.status === 'completed' || a.status === 'concluido' || a.status === 'concluída';
        const bCompleted = b.status === 'completed' || b.status === 'concluido' || b.status === 'concluída';
        
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
        
        if (!aCompleted && !bCompleted) {
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
        }
        
        return new Date(b.created_at) - new Date(a.created_at);
    });

    sortedTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        container.appendChild(taskElement);
    });

    // Adicionar botão de criar seção se o sistema de seções estiver disponível
    if (typeof showCreateSectionModal === 'function') {
        const addSectionBtn = document.createElement('button');
        addSectionBtn.className = 'add-section-btn';
        addSectionBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Seção
        `;
        addSectionBtn.onclick = showCreateSectionModal;
        container.appendChild(addSectionBtn);
    }
}

// ===== RENDERIZAR TAREFAS COM SEÇÕES =====
function renderTasksWithSections(container) {
    if (!container) return;

    container.innerHTML = '';
    container.className = 'tasks-container';

    // Agrupar tarefas por seção
    const tasksBySection = {};
    const tasksWithoutSection = [];

    homeTasks.forEach(task => {
        if (task.section_id) {
            if (!tasksBySection[task.section_id]) {
                tasksBySection[task.section_id] = [];
            }
            tasksBySection[task.section_id].push(task);
        } else {
            tasksWithoutSection.push(task);
        }
    });

    // Ordenar tarefas por prioridade dentro de cada grupo
    const sortTasks = (tasks) => {
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return tasks.sort((a, b) => {
            const aCompleted = a.status === 'completed';
            const bCompleted = b.status === 'completed';
            if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
            return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        });
    };

    // Renderizar tarefas sem seção primeiro
    if (tasksWithoutSection.length > 0) {
        const noSectionDiv = createSectionElement(null, 'Tarefas', '📋', sortTasks(tasksWithoutSection));
        container.appendChild(noSectionDiv);
    }

    // Renderizar cada seção
    if (window.userSections) {
        window.userSections.forEach(section => {
            const sectionTasks = tasksBySection[section.id] || [];
            const sectionDiv = createSectionElement(section.id, section.name, section.emoji, sortTasks(sectionTasks), section.is_collapsed);
            container.appendChild(sectionDiv);
        });
    }

    // Botão para adicionar seção
    if (typeof showCreateSectionModal === 'function') {
        const addSectionBtn = document.createElement('button');
        addSectionBtn.className = 'add-section-btn';
        addSectionBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Seção
        `;
        addSectionBtn.onclick = showCreateSectionModal;
        container.appendChild(addSectionBtn);
    }

    // Inicializar drag & drop
    initDragAndDrop();
}

// ===== CRIAR ELEMENTO DE SEÇÃO =====
function createSectionElement(sectionId, name, emoji, tasks, isCollapsed = false) {
    const section = document.createElement('div');
    section.className = `task-section ${isCollapsed ? 'collapsed' : ''}`;
    section.setAttribute('data-section-id', sectionId || 'none');

    const headerClick = sectionId ? `toggleSectionCollapse(${sectionId})` : '';

    section.innerHTML = `
        <div class="section-header" ${headerClick ? `onclick="${headerClick}"` : ''}>
            <div class="section-header-left">
                <svg class="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span class="section-emoji">${emoji}</span>
                <span class="section-name">${name}</span>
                <span class="section-count">${tasks.length}</span>
            </div>
            ${sectionId ? `
                <div class="section-actions">
                    <button class="section-action-btn" onclick="event.stopPropagation(); editSection(${sectionId})" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="section-action-btn btn-delete" onclick="event.stopPropagation(); deleteSection(${sectionId})" title="Excluir">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>
        <div class="section-tasks" data-section-drop="${sectionId || 'none'}">
            ${tasks.length > 0 ? tasks.map(task => createTaskHTML(task)).join('') : '<div class="section-empty">Arraste tarefas para cá</div>'}
        </div>
    `;

    return section;
}

// ===== CRIAR HTML DA TAREFA (NOVO DESIGN) =====
function createTaskHTML(task) {
    const isCompleted = task.status === 'completed' || task.status === 'concluido' || task.status === 'concluída';
    const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };

    return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" 
             data-task-id="${task.id}" 
             data-task-status="${isCompleted ? 'completed' : 'pending'}"
             data-priority="${task.priority || 'medium'}"
             draggable="true">
            
            <label class="task-checkbox">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleTaskFromHome(${task.id})">
                <span class="checkmark"></span>
            </label>
            
            <div class="task-content">
                <p class="task-title">${escapeHtml(task.title || task.name)}</p>
                ${task.description ? `<p class="task-subtitle">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-meta">
                    ${task.priority && task.priority !== 'medium' ? `
                        <span class="task-tag priority-${task.priority}">${priorityLabels[task.priority] || task.priority}</span>
                    ` : ''}
                </div>
            </div>
            
            <div class="task-actions">
                <button class="task-action-btn" onclick="editarTarefa(${task.id})" title="Editar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="task-action-btn btn-delete" onclick="deleteTaskFromHome(${task.id})" title="Excluir">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ===== CRIAR ELEMENTO DE TAREFA (FALLBACK) =====
function createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.innerHTML = createTaskHTML(task);
    return taskDiv.firstElementChild;
}

// ===== DRAG & DROP =====
let draggedTask = null;

function initDragAndDrop() {
    const taskItems = document.querySelectorAll('.task-item[draggable="true"]');
    const dropZones = document.querySelectorAll('[data-section-drop]');

    taskItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedTask = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedTask = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    const sectionId = e.currentTarget.dataset.sectionDrop;
    const targetSectionId = sectionId === 'none' ? null : parseInt(sectionId);

    if (draggedTask) {
        // Mover visualmente
        const emptyMsg = e.currentTarget.querySelector('.section-empty');
        if (emptyMsg) emptyMsg.remove();
        e.currentTarget.appendChild(draggedTask);

        // Salvar no banco
        await moveTaskToSection(taskId, targetSectionId);

        // Atualizar contadores
        updateSectionCounts();
    }
}

function updateSectionCounts() {
    document.querySelectorAll('.task-section').forEach(section => {
        const count = section.querySelectorAll('.task-item').length;
        const countEl = section.querySelector('.section-count');
        if (countEl) countEl.textContent = count;
    });
}

// ===== MOVER TAREFA PARA SEÇÃO =====
async function moveTaskToSection(taskId, sectionId, position = 0) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, section_id: sectionId, position })
        });

        const data = await response.json();

        if (data.success) {
            // Atualizar localmente
            const task = homeTasks.find(t => t.id === taskId);
            if (task) {
                task.section_id = sectionId;
                task.position = position;
            }
            console.log(`✅ Tarefa movida para seção ${sectionId}`);
        }
    } catch (error) {
        console.error('❌ Erro ao mover tarefa:', error);
    }
}

// ===== RENDERIZAR VISTA KANBAN =====
function renderKanbanView(container) {
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.gap = '20px';
    container.style.alignItems = 'flex-start';

    const columns = {
        pending: { title: '📋 Pendente', color: '#f39c12', tasks: [] },
        in_progress: { title: '🔄 Em Progresso', color: '#3498db', tasks: [] },
        completed: { title: '✅ Concluído', color: '#2ecc71', tasks: [] }
    };

    homeTasks.forEach(task => {
        let status = task.status.toLowerCase();
        
        if (status === 'concluída' || status === 'concluido') {
            status = 'completed';
        } else if (status === 'progresso') {
            status = 'in_progress';
        } else if (status === 'pendente') {
            status = 'pending';
        }
        
        if (columns[status]) {
            columns[status].tasks.push(task);
        } else {
            columns.pending.tasks.push(task);
        }
    });

    Object.keys(columns).forEach(columnKey => {
        const column = columns[columnKey];
        
        const columnDiv = document.createElement('div');
        columnDiv.className = 'kanban-column';
        columnDiv.setAttribute('data-kanban-column', columnKey);
        columnDiv.style.cssText = `
            flex: 1;
            background: var(--surface-secondary, #f8f9fa);
            border-radius: 8px;
            padding: 16px;
            min-width: 280px;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 3px solid ${column.color};
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span>${column.title}</span>
            <span style="background: ${column.color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                ${column.tasks.length}
            </span>
        `;

        columnDiv.appendChild(header);

        const priorityOrder = { high: 1, medium: 2, low: 3 };
        const sortedColumnTasks = column.tasks.sort((a, b) => {
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            return new Date(b.created_at) - new Date(a.created_at);
        });

        sortedColumnTasks.forEach(task => {
            const card = createKanbanCard(task, columnKey);
            columnDiv.appendChild(card);
        });

        container.appendChild(columnDiv);
    });
}

// ===== CRIAR CARD KANBAN =====
function createKanbanCard(task, currentStatus) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-task-status', currentStatus);
    card.setAttribute('data-task-priority', task.priority || 'medium');
    
    card.style.cssText = `
        background: var(--surface-main, white);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        cursor: pointer;
        transition: all 0.2s;
    `;

    card.addEventListener('mouseenter', () => {
        card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        card.style.transform = 'translateY(-2px)';
    });

    card.addEventListener('mouseleave', () => {
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        card.style.transform = 'translateY(0)';
    });

    const priorityColors = {
        high: '#e74c3c',
        medium: '#f39c12',
        low: '#2ecc71'
    };

    const priorityColor = priorityColors[task.priority] || '#999';

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <strong style="flex: 1; font-size: 14px;">${task.title || task.name}</strong>
            <span style="background: ${priorityColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap; margin-left: 8px;">
                ${task.priority?.toUpperCase() || 'MED'}
            </span>
        </div>
        ${task.description ? `<p style="font-size: 12px; color: var(--text-muted, #666); margin-bottom: 10px;">${task.description}</p>` : ''}
        <div style="display: flex; gap: 6px; margin-top: 10px;">
            ${currentStatus !== 'in_progress' ? 
                `<button onclick="changeTaskStatus(${task.id}, 'in_progress')" style="flex: 1; padding: 6px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    🔄 Progresso
                </button>` : ''}
            ${currentStatus !== 'completed' ? 
                `<button onclick="changeTaskStatus(${task.id}, 'completed')" style="flex: 1; padding: 6px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    ✓ Concluir
                </button>` : ''}
            ${currentStatus === 'completed' ? 
                `<button onclick="changeTaskStatus(${task.id}, 'pending')" style="flex: 1; padding: 6px; background: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    ↶ Reabrir
                </button>` : ''}
            <button onclick="deleteTaskFromHome(${task.id})" style="padding: 6px 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                🗑️
            </button>
        </div>
    `;

    return card;
}

// ===== MUDAR STATUS DA TAREFA (PARA KANBAN) =====
async function changeTaskStatus(taskId, newStatus) {
    if (!currentUser) {
        alert('❌ Erro: Usuário não identificado!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status: newStatus,
                user_id: currentUser.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const task = homeTasks.find(t => t.id === taskId);
            if (task) task.status = newStatus;
            
            renderAllTasks();
            applyTaskFilters();
            
            const statusNames = {
                pending: 'Pendente',
                in_progress: 'Em Progresso',
                completed: 'Concluído'
            };
            
            showNotification(`✅ Status alterado para: ${statusNames[newStatus]}`);
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('❌ Erro ao atualizar tarefa');
    }
}

// ===== APLICAR FILTROS DE CONFIGURAÇÃO =====
function applyTaskFilters() {
    if (!window.nuraSettingsFunctions) {
        console.log('⚠️ Sistema de configurações não carregado ainda');
        return;
    }

    const settings = window.nuraSettingsFunctions.getSettings();
    console.log('🔍 Aplicando filtros:', settings);

    // 1. Filtro: Ocultar tarefas concluídas
    if (settings.hideCompleted) {
        console.log('🙈 Ocultando tarefas concluídas');
        document.querySelectorAll('[data-task-status="completed"]').forEach(task => {
            task.style.display = 'none';
        });
        const completedColumn = document.querySelector('[data-kanban-column="completed"]');
        if (completedColumn) completedColumn.style.display = 'none';
    } else {
        console.log('👁️ Mostrando todas as tarefas');
        document.querySelectorAll('[data-task-status="completed"]').forEach(task => {
            task.style.display = '';
        });
        const completedColumn = document.querySelector('[data-kanban-column="completed"]');
        if (completedColumn) completedColumn.style.display = '';
    }

    // 2. Filtro: Destacar tarefas urgentes
    if (settings.highlightUrgent) {
        console.log('🚨 Ativando destaques urgentes');
        forceApplyHighlights();
    } else {
        console.log('➡️ Removendo destaque de tarefas');
        document.querySelectorAll('[data-task-priority], [data-priority]').forEach(task => {
            task.style.borderLeft = '';
            task.style.backgroundColor = '';
            if (task.classList.contains('kanban-card')) {
                task.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }
        });
    }
}

// ===== FORÇAR APLICAÇÃO DE DESTAQUES =====
function forceApplyHighlights() {
    console.log('🎨 Forçando destaques...');
    
    if (!window.nuraSettingsFunctions) {
        console.log('⚠️ Settings não carregado');
        return;
    }
    
    const settings = window.nuraSettingsFunctions.getSettings();
    
    if (!settings.highlightUrgent) {
        console.log('❌ Destaque desativado nas configurações');
        return;
    }
    
    console.log('✅ Destaque ATIVADO - aplicando...');
    
    // HIGH priority
    const highTasks = document.querySelectorAll('[data-task-priority="high"], [data-priority="high"]');
    console.log(`🔴 Aplicando em ${highTasks.length} tarefas HIGH`);
    highTasks.forEach(task => {
        if (task.classList.contains('kanban-card')) {
            task.style.borderLeft = '4px solid #e74c3c';
            task.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.3)';
        } else {
            task.style.borderLeft = '4px solid #e74c3c';
            task.style.backgroundColor = 'rgba(231, 76, 60, 0.04)';
        }
    });
    
    // MEDIUM priority
    const mediumTasks = document.querySelectorAll('[data-task-priority="medium"], [data-priority="medium"]');
    console.log(`🟡 Aplicando em ${mediumTasks.length} tarefas MEDIUM`);
    mediumTasks.forEach(task => {
        if (task.classList.contains('kanban-card')) {
            task.style.borderLeft = '4px solid #f39c12';
            task.style.boxShadow = '0 2px 8px rgba(243, 156, 18, 0.2)';
        }
    });
    
    // LOW priority
    const lowTasks = document.querySelectorAll('[data-task-priority="low"], [data-priority="low"]');
    console.log(`🟢 Aplicando em ${lowTasks.length} tarefas LOW`);
    lowTasks.forEach(task => {
        if (task.classList.contains('kanban-card')) {
            task.style.borderLeft = '4px solid #2ecc71';
            task.style.boxShadow = '0 2px 8px rgba(46, 204, 113, 0.2)';
        }
    });
    
    console.log('✅ Destaques aplicados com sucesso!');
}

// ===== ALTERAR STATUS (LISTA) =====
async function toggleTaskFromHome(id) {
    if (!currentUser) {
        alert('❌ Erro: Usuário não identificado!');
        return;
    }

    const task = homeTasks.find(t => t.id === id);
    if (!task) return;

    const isCompleted = task.status === 'completed' || task.status === 'concluido' || task.status === 'concluída';
    const newStatus = isCompleted ? 'pending' : 'completed';
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status: newStatus,
                user_id: currentUser.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            task.status = newStatus;
            renderAllTasks();
            applyTaskFilters();
            showNotification(newStatus === 'completed' ? '✅ Tarefa concluída!' : '⏳ Tarefa reaberta!');
        }
    } catch (error) {
        console.error('❌ Erro de conexão:', error);
        showNotification('❌ Erro de conexão com o servidor');
    }
}

// ===== EXCLUIR TAREFA =====
async function deleteTaskFromHome(id) {
    if (!currentUser) {
        alert('❌ Erro: Usuário não identificado!');
        return;
    }

    const task = homeTasks.find(t => t.id === id);
    const taskName = task ? (task.title || task.name || 'esta tarefa') : 'esta tarefa';
    
    if (!confirm(`⚠️ Excluir "${taskName}"?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/${id}?user_id=${currentUser.id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            homeTasks = homeTasks.filter(t => t.id !== id);
            renderAllTasks();
            applyTaskFilters();
            showNotification('🗑️ Tarefa excluída!');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('❌ Erro ao excluir');
    }
}

// ===== EDITAR TAREFA =====
function editarTarefa(id) {
    const task = homeTasks.find(t => t.id === id);
    if (!task) return;

    // Criar modal de edição
    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal" style="max-width: 500px;">
            <div class="section-modal-header">
                <h3>Editar Tarefa</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Título</label>
                    <input type="text" id="editTaskTitle" value="${escapeHtml(task.title || task.name)}">
                </div>
                <div class="section-modal-field">
                    <label>Descrição</label>
                    <textarea id="editTaskDesc" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-light); border-radius: 8px; resize: vertical;">${escapeHtml(task.description || '')}</textarea>
                </div>
                <div class="section-modal-field">
                    <label>Prioridade</label>
                    <select id="editTaskPriority" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-light); border-radius: 8px;">
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>🟢 Baixa</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>🟡 Média</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>🔴 Alta</option>
                    </select>
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitEditTask(${id})">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitEditTask(id) {
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDesc').value.trim();
    const priority = document.getElementById('editTaskPriority').value;

    if (!title) {
        alert('O título é obrigatório');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                priority,
                user_id: currentUser.id
            })
        });

        const result = await response.json();

        if (result.success) {
            const task = homeTasks.find(t => t.id === id);
            if (task) {
                task.title = title;
                task.description = description;
                task.priority = priority;
            }
            
            document.querySelector('.section-modal-overlay')?.remove();
            renderAllTasks();
            showNotification('✅ Tarefa atualizada!');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('❌ Erro ao atualizar tarefa');
    }
}

// ===== ESTADO VAZIO =====
function showEmptyState() {
    const container = document.getElementById('listaTarefas');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <svg class="empty-state-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                <path d="M9 14l2 2 4-4"></path>
            </svg>
            <h3 class="empty-state-title">Nenhuma tarefa ainda</h3>
            <p class="empty-state-text">Clique em "Adicionar Tarefa" para começar</p>
        </div>
    `;

    // Adicionar botão de criar seção mesmo sem tarefas
    if (typeof showCreateSectionModal === 'function') {
        const addSectionBtn = document.createElement('button');
        addSectionBtn.className = 'add-section-btn';
        addSectionBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Seção
        `;
        addSectionBtn.onclick = showCreateSectionModal;
        container.appendChild(addSectionBtn);
    }
}

// ===== NOTIFICAÇÃO =====
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--nura-primary, #146551);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== UTILITÁRIOS =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== ASSISTENTE IA =====
async function gerarRotinaInteligente() {
    const descricao = document.getElementById('descricaoRotina').value.trim();
    const horaInicio = document.getElementById('horaInicioRotina').value;
    const horaFim = document.getElementById('horaFimRotina').value;
    const resultadoDiv = document.getElementById('resultadoRotina');

    if (!descricao) {
        alert('Por favor, descreva seu dia!');
        return;
    }

    try {
        resultadoDiv.innerHTML = '<div class="ai-loading">🤖 Gerando sua rotina inteligente...</div>';
        resultadoDiv.style.display = 'block';

        const response = await fetch(`${API_URL}/api/gerar-rotina`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                descricao: descricao,
                horaInicio: horaInicio,
                horaFim: horaFim
            })
        });

        const result = await response.json();

        if (result.success) {
            resultadoDiv.innerHTML = `
                <div class="ai-success">
                    <h4>📅 Sua Rotina Inteligente</h4>
                    <div class="rotina-content">${formatarRotina(result.rotina)}</div>
                    <button class="btn btn-primary mt-3" onclick="salvarTarefasDaRotina(\`${result.rotina.replace(/`/g, '\\`')}\`)">
                        💾 Salvar Tarefas da Rotina
                    </button>
                </div>
            `;
        } else {
            resultadoDiv.innerHTML = `<div class="ai-error">❌ Erro: ${result.error}</div>`;
        }

    } catch (error) {
        console.error('Erro:', error);
        resultadoDiv.innerHTML = '<div class="ai-error">❌ Erro de conexão</div>';
    }
}

// ===== SALVAR TAREFAS DA ROTINA COM PRIORIDADE INTELIGENTE =====
async function salvarTarefasDaRotina(rotinaTexto) {
    if (!currentUser) {
        alert('❌ Erro: Usuário não identificado!');
        return;
    }

    const linhas = rotinaTexto.split('\n').filter(linha => linha.trim());
    let salvas = 0;
    
    console.log('🔍 Iniciando importação de', linhas.length, 'linhas');
    
    for (const linha of linhas) {
        if (linha.includes('→') || linha.match(/\d{1,2}:\d{2}/)) {
            let texto = linha.split('→')[1] || linha;
            texto = texto.replace(/[🔴🟡🟢🕗🕙🕛🕑🕓🕕📚💪☕🍽️📊🚀🎯]/g, '').trim();
            
            if (texto && texto.length > 2) {
                const priority = determinarPrioridade(texto);
                
                console.log('📝', texto, '→ Prioridade:', priority);
                
                const tarefa = {
                    title: texto.substring(0, 100),
                    description: 'Importado da rotina IA',
                    priority: priority,
                    status: 'pending',
                    user_id: currentUser.id
                };

                try {
                    const response = await fetch(`${API_URL}/api/tasks`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(tarefa)
                    });

                    const result = await response.json();
                    if (result.success) salvas++;
                } catch (error) {
                    console.error('❌ Erro ao salvar:', error);
                }
            }
        }
    }

    console.log('✅ Total salvo:', salvas, 'tarefas');
    showNotification(`✅ ${salvas} tarefas salvas!`);
    loadAndDisplayTasksFromDatabase();
}

// ===== DETERMINAR PRIORIDADE BASEADA NO CONTEÚDO =====
function determinarPrioridade(textoTarefa) {
    const texto = textoTarefa.toLowerCase();
    
    const palavrasAlta = [
        'urgente', 'importante', 'crítico', 'prazo', 'deadline', 
        'reunião', 'apresentação', 'entrega', 'cliente', 'projeto',
        'trabalho', 'estudo', 'prova', 'exame', 'compromisso',
        'pagamento', 'conta', 'vencimento', 'médico', 'saúde'
    ];
    
    const palavrasBaixa = [
        'descanso', 'relaxar', 'lazer', 'pausa', 'intervalo',
        'lanche', 'café', 'alongamento', 'caminhada', 'hobby',
        'série', 'jogo', 'música', 'leitura', 'entretenimento'
    ];
    
    for (const palavra of palavrasAlta) {
        if (texto.includes(palavra)) {
            return 'high';
        }
    }
    
    for (const palavra of palavrasBaixa) {
        if (texto.includes(palavra)) {
            return 'low';
        }
    }
    
    return 'medium';
}

function formatarRotina(texto) {
    return texto.split('\n').map(linha => {
        if (linha.trim()) {
            return `<div class="rotina-item">${linha}</div>`;
        }
        return '';
    }).join('');
}

// ===== TORNA FUNÇÕES GLOBAIS =====
window.toggleTaskFromHome = toggleTaskFromHome;
window.deleteTaskFromHome = deleteTaskFromHome;
window.changeTaskStatus = changeTaskStatus; 
window.renderAllTasks = renderAllTasks; 
window.applyTaskFilters = applyTaskFilters;
window.gerarRotinaInteligente = gerarRotinaInteligente; 
window.salvarTarefasDaRotina = salvarTarefasDaRotina;
window.forceApplyHighlights = forceApplyHighlights;
window.editarTarefa = editarTarefa;
window.submitEditTask = submitEditTask;
window.moveTaskToSection = moveTaskToSection;

console.log('✅ sincro_telas.js carregado com sistema de seções!');