/* ========================================
   LIXEIRA - NURA
   Sistema de recuperação de tarefas excluídas
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// Estado global
let trashTasks = [];
let filteredTasks = [];
let currentFilter = 'all';
let currentTaskId = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🗑️ Iniciando página da lixeira...');
    loadTrashTasks();

    // Event listener para busca
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterTasks);
    }
});

// ===== CARREGAR TAREFAS DA LIXEIRA =====
async function loadTrashTasks() {
    try {
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        if (!userId) {
            console.warn('⚠️ Usuário não logado');
            return;
        }

        console.log('📡 Carregando lixeira...');

        const response = await fetch(`${API_URL}/api/trash?user_id=${userId}`);
        const data = await response.json();

        if (data.success) {
            trashTasks = data.tasks || [];
            filteredTasks = [...trashTasks];

            console.log(`✅ ${trashTasks.length} tarefas na lixeira`);

            updateStats();
            renderTasks();
            updateEmptyTrashButton();
        }

    } catch (error) {
        console.error('❌ Erro ao carregar lixeira:', error);
        showToast('Erro ao carregar lixeira', 'error');
    }
}

// ===== ATUALIZAR ESTATÍSTICAS =====
function updateStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recent = trashTasks.filter(t => new Date(t.deleted_at) >= sevenDaysAgo).length;
    const older = trashTasks.filter(t => new Date(t.deleted_at) < sevenDaysAgo).length;

    document.getElementById('totalTrash').textContent = trashTasks.length;
    document.getElementById('trashCount').textContent = trashTasks.length;
    document.getElementById('recentDeleted').textContent = recent;
    document.getElementById('olderDeleted').textContent = older;
}

// ===== ATUALIZAR BOTÃO ESVAZIAR LIXEIRA =====
function updateEmptyTrashButton() {
    const btn = document.getElementById('btnEmptyTrash');
    if (btn) {
        btn.disabled = trashTasks.length === 0;
    }
}

// ===== RENDERIZAR TAREFAS =====
function renderTasks() {
    const container = document.getElementById('trashTasksList');
    const emptyState = document.getElementById('emptyState');
    const noResultsState = document.getElementById('noResultsState');

    if (!container) return;

    // Verificar estados vazios
    if (trashTasks.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'flex';
        noResultsState.style.display = 'none';
        return;
    }

    if (filteredTasks.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'none';
        noResultsState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    noResultsState.style.display = 'none';

    // Agrupar por data de exclusão
    const groups = groupTasksByDeleteDate(filteredTasks);

    let html = '';

    for (const [groupName, tasks] of Object.entries(groups)) {
        html += `
            <div class="task-group">
                <div class="task-group-header">
                    <span class="task-group-title">${groupName}</span>
                    <span class="task-group-count">${tasks.length}</span>
                </div>
                ${tasks.map(task => renderTaskItem(task)).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

// ===== AGRUPAR POR DATA DE EXCLUSÃO =====
function groupTasksByDeleteDate(tasks) {
    const groups = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    tasks.forEach(task => {
        const deletedDate = new Date(task.deleted_at);
        const taskDate = new Date(deletedDate.getFullYear(), deletedDate.getMonth(), deletedDate.getDate());

        let groupName;

        if (taskDate.getTime() === today.getTime()) {
            groupName = 'Hoje';
        } else if (taskDate.getTime() === yesterday.getTime()) {
            groupName = 'Ontem';
        } else if (taskDate >= weekAgo) {
            groupName = 'Esta semana';
        } else {
            groupName = 'Mais antigas';
        }

        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(task);
    });

    // Ordenar grupos
    const orderedGroups = {};
    const order = ['Hoje', 'Ontem', 'Esta semana', 'Mais antigas'];

    order.forEach(name => {
        if (groups[name]) {
            orderedGroups[name] = groups[name];
        }
    });

    return orderedGroups;
}

// ===== RENDERIZAR ITEM DE TAREFA =====
function renderTaskItem(task) {
    const priorityLabels = {
        high: 'Alta',
        medium: 'Média',
        low: 'Baixa',
        alta: 'Alta',
        media: 'Média',
        baixa: 'Baixa'
    };

    const priorityClass = task.priority?.toLowerCase() || 'low';
    const priorityLabel = priorityLabels[priorityClass] || 'Baixa';

    const deletedDate = formatDate(task.deleted_at);

    return `
        <div class="task-item" data-task-id="${task.id}" onclick="openTaskModal(${task.id})">
            <div class="task-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </div>

            <div class="task-body">
                <span class="task-title">${escapeHtml(task.title)}</span>
                <div class="task-meta">
                    <span class="task-date">Excluída ${deletedDate}</span>
                    ${task.list_name ? `<span class="task-list">${escapeHtml(task.list_name)}</span>` : ''}
                    ${task.priority ? `
                        <span class="task-priority ${priorityClass}">
                            <span class="priority-indicator ${priorityClass}"></span>
                            ${priorityLabel}
                        </span>
                    ` : ''}
                </div>
            </div>

            <div class="task-actions" onclick="event.stopPropagation()">
                <button class="task-action-btn restore" onclick="restoreTask(${task.id})" title="Restaurar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                        <path d="M21 3v5h-5"></path>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                        <path d="M8 16H3v5"></path>
                    </svg>
                </button>
                <button class="task-action-btn delete" onclick="confirmDeleteTask(${task.id}, '${escapeHtml(task.title)}')" title="Excluir permanentemente">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ===== FILTROS =====
function applyFilter(filter) {
    // Atualizar botões de filtro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const clickedBtn = document.querySelector(`[data-filter="${filter}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }

    currentFilter = filter;
    filterTasks();
}

function filterTasks() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    const searchClear = document.getElementById('searchClear');

    // Mostrar/ocultar botão de limpar busca
    if (searchClear) {
        searchClear.style.display = searchTerm ? 'flex' : 'none';
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    filteredTasks = trashTasks.filter(task => {
        // Filtro de busca
        if (searchTerm && !task.title.toLowerCase().includes(searchTerm)) {
            return false;
        }

        const deletedDate = new Date(task.deleted_at);

        // Filtro de período
        switch (currentFilter) {
            case 'recent':
                if (deletedDate < sevenDaysAgo) return false;
                break;
            case 'old':
                if (deletedDate >= sevenDaysAgo) return false;
                break;
            case 'high':
            case 'medium':
            case 'low':
                const priority = task.priority?.toLowerCase() || 'low';
                const priorityMap = { 'alta': 'high', 'media': 'medium', 'baixa': 'low' };
                const normalizedPriority = priorityMap[priority] || priority;
                if (normalizedPriority !== currentFilter) return false;
                break;
        }

        return true;
    });

    renderTasks();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
        filterTasks();
    }
}

function clearAllFilters() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }

    currentFilter = 'all';

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const allBtn = document.querySelector('[data-filter="all"]');
    if (allBtn) {
        allBtn.classList.add('active');
    }

    filteredTasks = [...trashTasks];
    renderTasks();
}

// ===== RESTAURAR TAREFA =====
async function restoreTask(taskId) {
    try {
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        console.log(`♻️ Restaurando tarefa ${taskId}...`);

        const response = await fetch(`${API_URL}/api/trash/${taskId}/restore?user_id=${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast('Tarefa restaurada com sucesso!', 'success');
            await loadTrashTasks();
        } else {
            showToast(result.error || 'Erro ao restaurar tarefa', 'error');
        }

    } catch (error) {
        console.error('❌ Erro ao restaurar tarefa:', error);
        showToast('Erro ao restaurar tarefa', 'error');
    }
}

// ===== EXCLUIR PERMANENTEMENTE =====
function confirmDeleteTask(taskId, taskTitle) {
    currentTaskId = taskId;

    const nameElement = document.getElementById('deleteTaskName');
    if (nameElement) {
        nameElement.textContent = taskTitle;
    }

    const confirmBtn = document.getElementById('confirmDeleteTaskBtn');
    if (confirmBtn) {
        confirmBtn.onclick = () => deleteTaskPermanently(taskId);
    }

    document.getElementById('deleteTaskModalOverlay').classList.add('active');
}

function closeDeleteTaskModal() {
    document.getElementById('deleteTaskModalOverlay').classList.remove('active');
    currentTaskId = null;
}

async function deleteTaskPermanently(taskId) {
    try {
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        console.log(`🗑️ Excluindo permanentemente tarefa ${taskId}...`);

        const response = await fetch(`${API_URL}/api/tasks/${taskId}?user_id=${userId}&permanent=true`, {
            method: 'DELETE',
            headers: {
                'x-user-id': userId
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast('Tarefa excluída permanentemente!', 'success');
            closeDeleteTaskModal();
            closeTaskModal();
            await loadTrashTasks();
        } else {
            showToast(result.error || 'Erro ao excluir tarefa', 'error');
        }

    } catch (error) {
        console.error('❌ Erro ao excluir tarefa:', error);
        showToast('Erro ao excluir tarefa', 'error');
    }
}

// ===== ESVAZIAR LIXEIRA =====
function confirmEmptyTrash() {
    if (trashTasks.length === 0) return;
    document.getElementById('emptyTrashModalOverlay').classList.add('active');
}

function closeEmptyTrashModal() {
    document.getElementById('emptyTrashModalOverlay').classList.remove('active');
}

async function emptyTrash() {
    try {
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        console.log('🗑️ Esvaziando lixeira...');

        const response = await fetch(`${API_URL}/api/trash/empty?user_id=${userId}`, {
            method: 'DELETE',
            headers: {
                'x-user-id': userId
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast(`${result.deleted} tarefas excluídas permanentemente!`, 'success');
            closeEmptyTrashModal();
            await loadTrashTasks();
        } else {
            showToast(result.error || 'Erro ao esvaziar lixeira', 'error');
        }

    } catch (error) {
        console.error('❌ Erro ao esvaziar lixeira:', error);
        showToast('Erro ao esvaziar lixeira', 'error');
    }
}

// ===== MODAL DE DETALHES =====
function openTaskModal(taskId) {
    const task = trashTasks.find(t => t.id === taskId);
    if (!task) return;

    currentTaskId = taskId;

    // Preencher dados
    document.getElementById('modalTaskTitle').textContent = task.title;

    // Prioridade
    const priorityLabels = {
        high: 'Alta', medium: 'Média', low: 'Baixa',
        alta: 'Alta', media: 'Média', baixa: 'Baixa'
    };
    const priorityClass = task.priority?.toLowerCase() || 'low';
    const priorityLabel = priorityLabels[priorityClass] || 'Baixa';

    const priorityElement = document.getElementById('modalPriority');
    priorityElement.textContent = priorityLabel;
    priorityElement.className = `modal-value priority-badge ${priorityClass}`;

    // Lista
    const listElement = document.getElementById('modalList');
    if (task.list_name) {
        listElement.textContent = task.list_name;
        document.getElementById('modalListSection').style.display = 'flex';
    } else {
        document.getElementById('modalListSection').style.display = 'none';
    }

    // Data de exclusão
    document.getElementById('modalDeletedDate').textContent = formatDateFull(task.deleted_at);

    // Descrição
    const descSection = document.getElementById('modalDescriptionSection');
    const descElement = document.getElementById('modalDescription');
    if (task.description) {
        descElement.textContent = task.description;
        descSection.style.display = 'flex';
    } else {
        descSection.style.display = 'none';
    }

    // Mostrar modal
    document.getElementById('taskModalOverlay').style.display = 'flex';
}

function closeTaskModal() {
    document.getElementById('taskModalOverlay').style.display = 'none';
    currentTaskId = null;
}

function restoreTaskFromModal() {
    if (currentTaskId) {
        restoreTask(currentTaskId);
        closeTaskModal();
    }
}

function deleteTaskPermanentlyFromModal() {
    if (currentTaskId) {
        const task = trashTasks.find(t => t.id === currentTaskId);
        if (task) {
            confirmDeleteTask(currentTaskId, task.title);
        }
    }
}

// ===== UTILITÁRIOS =====
function formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'hoje';
    } else if (diffDays === 1) {
        return 'ontem';
    } else if (diffDays < 7) {
        return `há ${diffDays} dias`;
    } else {
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short'
        });
    }
}

function formatDateFull(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== FECHAR MODAIS COM ESC =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeTaskModal();
        closeDeleteTaskModal();
        closeEmptyTrashModal();
    }
});

// ===== FECHAR MODAIS AO CLICAR FORA =====
document.getElementById('taskModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'taskModalOverlay') {
        closeTaskModal();
    }
});

document.getElementById('deleteTaskModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'deleteTaskModalOverlay') {
        closeDeleteTaskModal();
    }
});

document.getElementById('emptyTrashModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'emptyTrashModalOverlay') {
        closeEmptyTrashModal();
    }
});

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.loadTrashTasks = loadTrashTasks;
window.applyFilter = applyFilter;
window.filterTasks = filterTasks;
window.clearSearch = clearSearch;
window.clearAllFilters = clearAllFilters;
window.restoreTask = restoreTask;
window.confirmDeleteTask = confirmDeleteTask;
window.closeDeleteTaskModal = closeDeleteTaskModal;
window.deleteTaskPermanently = deleteTaskPermanently;
window.confirmEmptyTrash = confirmEmptyTrash;
window.closeEmptyTrashModal = closeEmptyTrashModal;
window.emptyTrash = emptyTrash;
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.restoreTaskFromModal = restoreTaskFromModal;
window.deleteTaskPermanentlyFromModal = deleteTaskPermanentlyFromModal;

console.log('✅ lixeira.js carregado');
