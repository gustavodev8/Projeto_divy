/* ========================================
   TAREFAS CONCLUÍDAS - JavaScript
   ======================================== */

// Detectar URL base automaticamente
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

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

        // Usa rota alternativa "done" para evitar bloqueio de ad blockers
        // A palavra "completed" é frequentemente bloqueada por extensões
        const response = await fetch(`${API_URL}/api/tasks/done?user_id=${user.id}`);
        
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

function showNotification(message, type = 'info') {
    // Remover emojis da mensagem
    const cleanMessage = message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2705}]|[\u{274C}]|[\u{26A0}]|[\u{2139}]/gu, '').trim();

    // Detectar tipo baseado na mensagem original
    if (message.includes('✅') || message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('reativada')) type = 'success';
    else if (message.includes('❌') || message.toLowerCase().includes('erro')) type = 'error';
    else if (message.includes('⚠️') || message.toLowerCase().includes('excluída')) type = 'warning';

    // Ícones SVG por tipo
    const icons = {
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    // Cores por tipo
    const colors = {
        success: { bg: '#0f172a', border: '#22c55e', icon: '#22c55e' },
        error: { bg: '#0f172a', border: '#ef4444', icon: '#ef4444' },
        warning: { bg: '#0f172a', border: '#f59e0b', icon: '#f59e0b' },
        info: { bg: '#0f172a', border: '#3b82f6', icon: '#3b82f6' }
    };

    const color = colors[type] || colors.info;
    const icon = icons[type] || icons.info;

    // Remover notificação anterior
    const existingNotification = document.querySelector('.divy-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Criar notificação
    const notification = document.createElement('div');
    notification.className = 'divy-notification';
    notification.innerHTML = `
        <div class="notification-icon" style="color: ${color.icon}">${icon}</div>
        <span class="notification-message">${cleanMessage}</span>
    `;

    // Estilos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color.bg};
        color: #e2e8f0;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 0.875rem;
        font-weight: 500;
        border-left: 3px solid ${color.border};
        animation: slideInNotification 0.3s ease;
        max-width: 320px;
    `;

    // Adicionar estilos de animação se não existirem
    if (!document.getElementById('divy-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'divy-notification-styles';
        style.textContent = `
            @keyframes slideInNotification {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideOutNotification {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(20px); }
            }
            .divy-notification .notification-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .divy-notification .notification-message {
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOutNotification 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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