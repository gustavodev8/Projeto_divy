/* ========================================
   TAREFAS CONCLUÍDAS - JavaScript
   ======================================== */

const API_URL = 'http://localhost:3000';
let completedTasks = [];
let currentFilter = 'all';

// ===== CARREGAR TAREFAS CONCLUÍDAS =====
async function loadCompletedTasks() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'Tela_Login.html';
        return;
    }
    
    try {
        console.log('📋 Carregando tarefas concluídas...');
        
        const response = await fetch(`${API_URL}/api/tasks/completed?user_id=${user.id}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar tarefas');
        }
        
        const data = await response.json();
        
        if (data.success) {
            completedTasks = data.tasks || [];
            console.log(`✅ ${completedTasks.length} tarefas concluídas carregadas`);
            
            updateStats();
            renderCompletedTasks();
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar tarefas:', error);
        document.getElementById('emptyState').style.display = 'flex';
        document.getElementById('completedCount').textContent = '0';
    }
}

// ===== ATUALIZAR ESTATÍSTICAS =====
function updateStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisWeek = completedTasks.filter(t => {
        const updated = new Date(t.updated_at);
        return updated >= weekAgo;
    }).length;
    
    const thisMonth = completedTasks.filter(t => {
        const updated = new Date(t.updated_at);
        return updated >= monthStart;
    }).length;
    
    document.getElementById('totalCompleted').textContent = completedTasks.length;
    document.getElementById('thisWeek').textContent = thisWeek;
    document.getElementById('thisMonth').textContent = thisMonth;
    document.getElementById('completedCount').textContent = completedTasks.length;
}

// ===== RENDERIZAR TAREFAS =====
function renderCompletedTasks() {
    const container = document.getElementById('completedTasksList');
    const emptyState = document.getElementById('emptyState');
    
    let filtered = [...completedTasks];
    
    // Aplicar filtro
    if (currentFilter !== 'all') {
        filtered = applyFilterLogic(filtered);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Agrupar por período
    const groups = groupTasksByPeriod(filtered);
    
    container.innerHTML = Object.entries(groups).map(([period, tasks]) => `
        <div class="task-group">
            <div class="task-group-header">
                <span class="task-group-title">${period}</span>
                <span class="task-group-count">${tasks.length}</span>
            </div>
            ${tasks.map(task => createTaskHTML(task)).join('')}
        </div>
    `).join('');
}

// ===== CRIAR HTML DA TAREFA =====
function createTaskHTML(task) {
    const updatedDate = new Date(task.updated_at);
    const daysAgo = getDaysAgo(updatedDate);
    
    const priorityClass = task.priority || 'medium';
    const priorityLabels = {
        high: 'Alta',
        medium: 'Média',
        low: 'Baixa'
    };
    
    return `
        <div class="task-item" data-task-id="${task.id}">
            <label class="task-checkbox">
                <input type="checkbox" checked onchange="reactivateTask(${task.id})">
                <span class="check"></span>
            </label>
            
            <div class="task-body" onclick="openTaskModal(${task.id})" style="cursor: pointer;">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-meta">
                    <span class="task-date">Concluída ${daysAgo}</span>
                    ${task.priority ? `
                        <span class="task-priority ${priorityClass}">
                            <span class="priority-indicator ${priorityClass}"></span>
                            ${priorityLabels[priorityClass]}
                        </span>
                    ` : ''}
                </div>
            </div>
            
            <div class="task-actions">
                <button class="task-action-btn" onclick="event.stopPropagation(); openTaskModal(${task.id})" title="Ver detalhes">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
                <button class="task-action-btn delete" onclick="event.stopPropagation(); deleteTask(${task.id})" title="Excluir permanentemente">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ===== AGRUPAR POR PERÍODO =====
function groupTasksByPeriod(tasks) {
    const now = new Date();
    const groups = {
        'Hoje': [],
        'Esta Semana': [],
        'Este Mês': [],
        'Mais Antigas': []
    };
    
    tasks.forEach(task => {
        const updated = new Date(task.updated_at);
        const daysDiff = getDaysAgoNumber(updated);
        
        if (daysDiff === 0) {
            groups['Hoje'].push(task);
        } else if (daysDiff <= 7) {
            groups['Esta Semana'].push(task);
        } else if (daysDiff <= 30) {
            groups['Este Mês'].push(task);
        } else {
            groups['Mais Antigas'].push(task);
        }
    });
    
    // Remover grupos vazios
    return Object.fromEntries(
        Object.entries(groups).filter(([_, tasks]) => tasks.length > 0)
    );
}

// ===== APLICAR FILTRO =====
function applyFilter(filter) {
    currentFilter = filter;
    
    // Atualizar UI dos botões
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    
    renderCompletedTasks();
}

function applyFilterLogic(tasks) {
    const now = new Date();
    
    switch (currentFilter) {
        case 'recent':
            return tasks.filter(t => {
                const updated = new Date(t.updated_at);
                return getDaysAgoNumber(updated) <= 7;
            });
        case 'old':
            return tasks.filter(t => {
                const updated = new Date(t.updated_at);
                return getDaysAgoNumber(updated) > 7;
            });
        case 'high':
            return tasks.filter(t => t.priority === 'high');
        case 'medium':
            return tasks.filter(t => t.priority === 'medium');
        case 'low':
            return tasks.filter(t => t.priority === 'low');
        default:
            return tasks;
    }
}

// ===== REATIVAR TAREFA =====
async function reactivateTask(taskId) {
    if (!confirm('Deseja reativar esta tarefa?')) {
        return;
    }
    
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'pending',
                user_id: user.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            completedTasks = completedTasks.filter(t => t.id !== taskId);
            updateStats();
            renderCompletedTasks();
            showNotification('Tarefa reativada com sucesso');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('Erro ao reativar tarefa');
    }
}

// ===== DELETAR TAREFA =====
async function deleteTask(taskId) {
    if (!confirm('Deseja excluir esta tarefa permanentemente? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}?user_id=${user.id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            completedTasks = completedTasks.filter(t => t.id !== taskId);
            updateStats();
            renderCompletedTasks();
            showNotification('Tarefa excluída permanentemente');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('Erro ao excluir tarefa');
    }
}

// ===== UTILITÁRIOS =====
function getDaysAgo(date) {
    const days = getDaysAgoNumber(date);
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    return `há ${days} dias`;
}

function getDaysAgoNumber(date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message) {
    console.log('📢', message);
    // Você pode adicionar uma notificação visual aqui
}

// ===== INICIALIZAR =====
window.addEventListener('DOMContentLoaded', () => {
    loadCompletedTasks();
});

// ===== VARIÁVEL GLOBAL PARA TAREFA ATUAL =====
let currentTaskId = null;

// ===== ABRIR MODAL COM DETALHES DA TAREFA =====
async function openTaskModal(taskId) {
    currentTaskId = taskId;
    const task = completedTasks.find(t => t.id === taskId);
    
    if (!task) {
        console.error('Tarefa não encontrada');
        return;
    }
    
    console.log('📋 Abrindo detalhes da tarefa:', task);
    
    // Preencher título
    document.getElementById('modalTaskTitle').textContent = task.title;
    
    // Preencher prioridade
    const priorityLabels = {
        high: 'Alta',
        medium: 'Média',
        low: 'Baixa'
    };
    
    if (task.priority) {
        document.getElementById('modalPrioritySection').style.display = 'flex';
        const priorityElement = document.getElementById('modalPriority');
        priorityElement.textContent = priorityLabels[task.priority] || task.priority;
        priorityElement.className = `modal-value priority-badge ${task.priority}`;
    } else {
        document.getElementById('modalPrioritySection').style.display = 'none';
    }
    
    // Preencher data de vencimento
    if (task.due_date) {
        document.getElementById('modalDueDateSection').style.display = 'flex';
        const dueDate = new Date(task.due_date);
        document.getElementById('modalDueDate').textContent = dueDate.toLocaleDateString('pt-BR');
    } else {
        document.getElementById('modalDueDateSection').style.display = 'none';
    }
    
    // Preencher data de conclusão
    const completedDate = new Date(task.updated_at);
    document.getElementById('modalCompletedDate').textContent = 
        completedDate.toLocaleDateString('pt-BR') + ' às ' + completedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Preencher descrição
    if (task.description && task.description.trim()) {
        document.getElementById('modalDescriptionSection').style.display = 'flex';
        document.getElementById('modalDescription').textContent = task.description;
    } else {
        document.getElementById('modalDescriptionSection').style.display = 'none';
    }
    
    // Carregar subtarefas
    await loadSubtasks(taskId);
    
    // Mostrar modal
    document.getElementById('taskModalOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// ===== CARREGAR SUBTAREFAS =====
async function loadSubtasks(taskId) {
    try {
        const response = await fetch(`${API_URL}/subtasks/${taskId}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar subtarefas');
        }
        
        const subtasks = await response.json();
        
        if (subtasks && subtasks.length > 0) {
            document.getElementById('modalSubtasksSection').style.display = 'flex';
            document.getElementById('modalSubtaskCount').textContent = subtasks.length;
            
            const subtasksList = document.getElementById('modalSubtasksList');
            subtasksList.innerHTML = subtasks.map(sub => `
                <div class="modal-subtask-item ${sub.completed ? 'completed' : ''}">
                    <div class="modal-subtask-checkbox ${sub.completed ? 'completed' : 'uncompleted'}">
                        ${sub.completed ? `
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        ` : ''}
                    </div>
                    <span class="modal-subtask-title">${escapeHtml(sub.title)}</span>
                </div>
            `).join('');
        } else {
            document.getElementById('modalSubtasksSection').style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar subtarefas:', error);
        document.getElementById('modalSubtasksSection').style.display = 'none';
    }
}

// ===== FECHAR MODAL =====
function closeTaskModal() {
    document.getElementById('taskModalOverlay').style.display = 'none';
    document.body.style.overflow = '';
    currentTaskId = null;
}

// ===== REATIVAR TAREFA DO MODAL =====
async function reactivateTaskFromModal() {
    if (!currentTaskId) return;
    
    if (!confirm('Deseja reativar esta tarefa?')) {
        return;
    }
    
    await reactivateTask(currentTaskId);
    closeTaskModal();
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('taskModalOverlay');
    if (e.target === overlay) {
        closeTaskModal();
    }
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeTaskModal();
    }
});

// Exportar funções globais
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.reactivateTaskFromModal = reactivateTaskFromModal;

// Exportar funções globais
window.applyFilter = applyFilter;
window.reactivateTask = reactivateTask;
window.deleteTask = deleteTask;