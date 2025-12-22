// ===== NURA - SISTEMA DE SEÇÕES (TICKTICK STYLE) =====

const SECTIONS_API = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api/sections'
    : `${window.location.origin}/api/sections`;

let userSections = [];
let draggedTask = null;

// ===== CARREGAR SEÇÕES =====
async function loadSections() {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const response = await fetch(`${SECTIONS_API}?user_id=${user.id}`);
        const data = await response.json();

        if (data.success) {
            userSections = data.sections;
            console.log(`📁 ${userSections.length} seções carregadas`);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar seções:', error);
    }
}

// ===== CRIAR SEÇÃO =====
async function createSection(name, emoji = '📁') {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const response = await fetch(SECTIONS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, name, emoji })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`✅ Seção "${name}" criada!`);
            await loadSections();
            renderAllTasks();
            return data.sectionId;
        }
    } catch (error) {
        console.error('❌ Erro ao criar seção:', error);
        showNotification('❌ Erro ao criar seção');
    }
    return null;
}

// ===== EXCLUIR SEÇÃO =====
async function deleteSection(sectionId) {
    const user = getCurrentUser();
    if (!user) return;

    const section = userSections.find(s => s.id === sectionId);
    if (!confirm(`Excluir seção "${section?.name}"? As tarefas serão movidas para "Sem Seção".`)) return;

    try {
        const response = await fetch(`${SECTIONS_API}/${sectionId}?user_id=${user.id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('🗑️ Seção excluída');
            await loadSections();
            renderAllTasks();
        }
    } catch (error) {
        console.error('❌ Erro ao excluir seção:', error);
    }
}

// ===== TOGGLE COLAPSAR SEÇÃO =====
async function toggleSectionCollapse(sectionId) {
    const user = getCurrentUser();
    if (!user) return;

    const section = userSections.find(s => s.id === sectionId);
    if (!section) return;

    const newState = !section.is_collapsed;

    try {
        await fetch(`${SECTIONS_API}/${sectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, is_collapsed: newState })
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
    userSections.forEach(section => {
        const sectionTasks = tasksBySection[section.id] || [];
        const sectionDiv = createSectionElement(section.id, section.name, section.emoji, sortTasks(sectionTasks), section.is_collapsed);
        container.appendChild(sectionDiv);
    });

    // Botão para adicionar seção
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

    // Inicializar drag & drop
    initDragAndDrop();
}

// ===== CRIAR ELEMENTO DE SEÇÃO =====
function createSectionElement(sectionId, name, emoji, tasks, isCollapsed = false) {
    const section = document.createElement('div');
    section.className = `task-section ${isCollapsed ? 'collapsed' : ''}`;
    section.setAttribute('data-section-id', sectionId || 'none');

    section.innerHTML = `
        <div class="section-header" onclick="${sectionId ? `toggleSectionCollapse(${sectionId})` : ''}">
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
            ${tasks.map(task => createTaskHTML(task)).join('')}
            ${tasks.length === 0 ? '<div class="section-empty">Arraste tarefas para cá</div>' : ''}
        </div>
    `;

    return section;
}

// ===== CRIAR HTML DA TAREFA =====
function createTaskHTML(task) {
    const isCompleted = task.status === 'completed';
    const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };

    return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" 
             data-task-id="${task.id}" 
             data-priority="${task.priority || 'medium'}"
             draggable="true">
            
            <label class="task-checkbox">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleTaskFromHome(${task.id})">
                <span class="checkmark"></span>
            </label>
            
            <div class="task-content">
                <p class="task-title">${escapeHtml(task.title)}</p>
                ${task.description ? `<p class="task-subtitle">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-meta">
                    ${task.priority && task.priority !== 'medium' ? `
                        <span class="task-tag priority-${task.priority}">${priorityLabels[task.priority]}</span>
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

// ===== DRAG & DROP =====
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

// ===== MODAL CRIAR SEÇÃO =====
function showCreateSectionModal() {
    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal">
            <div class="section-modal-header">
                <h3>Nova Seção</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Emoji</label>
                    <input type="text" id="sectionEmoji" value="📁" maxlength="2" style="width: 60px; text-align: center; font-size: 1.5rem;">
                </div>
                <div class="section-modal-field">
                    <label>Nome da Seção</label>
                    <input type="text" id="sectionName" placeholder="Ex: Trabalho, Pessoal..." autofocus>
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitCreateSection()">Criar Seção</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('sectionName').focus();
}

async function submitCreateSection() {
    const name = document.getElementById('sectionName').value.trim();
    const emoji = document.getElementById('sectionEmoji').value.trim() || '📁';

    if (!name) {
        alert('Digite um nome para a seção');
        return;
    }

    await createSection(name, emoji);
    document.querySelector('.section-modal-overlay')?.remove();
}

// ===== UTILITÁRIOS =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== EXPORTAR FUNÇÕES =====
window.loadSections = loadSections;
window.createSection = createSection;
window.deleteSection = deleteSection;
window.toggleSectionCollapse = toggleSectionCollapse;
window.moveTaskToSection = moveTaskToSection;
window.renderTasksWithSections = renderTasksWithSections;
window.showCreateSectionModal = showCreateSectionModal;
window.submitCreateSection = submitCreateSection;

console.log('✅ sections.js carregado');