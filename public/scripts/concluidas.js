/* ========================================
   TAREFAS CONCLUÍDAS - JavaScript
   ======================================== */

const API_URL = 'http://localhost:3000';
let completedTasks = [];
let currentFilter = 'all';

// ===== CARREGAR TAREFAS CONCLUÍDAS =====
// ===== CARREGAR TAREFAS CONCLUÍDAS =====
async function loadCompletedTasks() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '../pages/Tela_Login.html';
        return;
    }
    
    try {
        console.log('📋 Carregando tarefas concluídas...');
        
        // Buscar todas as tarefas concluídas
        const response = await fetch(`${API_URL}/api/tasks/completed?user_id=${user.id}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar tarefas');
        }
        
        completedTasks = await response.json();
        
        console.log(`✅ ${completedTasks.length} tarefas concluídas carregadas`);
        
        updateStats();
        renderCompletedTasks();
        
    } catch (error) {
        console.error('❌ Erro ao carregar tarefas:', error);
        document.getElementById('emptyState').style.display = 'flex';
    }
}
// ===== ATUALIZAR ESTATÍSTICAS =====
function updateStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisWeek = completedTasks.filter(t => {
        const completed = new Date(t.completed_at || t.updated_at);
        return completed >= weekAgo;
    }).length;
    
    const thisMonth = completedTasks.filter(t => {
        const completed = new Date(t.completed_at || t.updated_at);
        return completed >= monthStart;
    }).length;
    
    document.getElementById('totalCompleted').textContent = completedTasks.length;
    document.getElementById('thisWeek').textContent = thisWeek;
    document.getElementById('thisMonth').textContent = thisMonth;
    document.getElementById('completedCount').textContent = `${completedTasks.length} tarefa${completedTasks.length !== 1 ? 's' : ''}`;
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
        <div class="completed-task-group">
            <div class="completed-task-group-header">
                <span class="completed-task-group-title">${period}</span>
                <span class="completed-task-group-count">${tasks.length}</span>
            </div>
            ${tasks.map(task => createCompletedTaskHTML(task)).join('')}
        </div>
    `).join('');
}

// ===== CRIAR HTML DA TAREFA =====
function createCompletedTaskHTML(task) {
    const completedDate = new Date(task.completed_at || task.updated_at);
    const formattedDate = formatDate(completedDate);
    const daysAgo = getDaysAgo(completedDate);
    
    return `
        <div class="completed-task-item" data-task-id="${task.id}">
            <label class="completed-task-checkbox">
                <input type="checkbox" checked onchange="reactivateTask(${task.id})">
                <span class="checkmark"></span>
            </label>
            
            <div class="completed-task-content">
                <h4 class="completed-task-title">${task.title}</h4>
                <div class="completed-task-meta">
                    <span class="completed-task-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Concluída ${daysAgo}
                    </span>
                    ${task.priority ? `
                        <span class="completed-task-priority ${task.priority}">
                            ${task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
                            ${task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                    ` : ''}
                </div>
            </div>
            
            <div class="completed-task-actions">
                <button class="completed-task-btn delete" onclick="deleteTask(${task.id})" title="Excluir permanentemente">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        const completed = new Date(task.completed_at || task.updated_at);
        const daysDiff = getDaysAgoNumber(completed);
        
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
    
    // Atualizar UI dos chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    
    renderCompletedTasks();
}

function applyFilterLogic(tasks) {
    const now = new Date();
    
    switch (currentFilter) {
        case 'recent':
            return tasks.filter(t => {
                const completed = new Date(t.completed_at || t.updated_at);
                return getDaysAgoNumber(completed) <= 7;
            });
        case 'old':
            return tasks.filter(t => {
                const completed = new Date(t.completed_at || t.updated_at);
                return getDaysAgoNumber(completed) > 7;
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
        const response = await fetch(`${API_URL}/tasks/${taskId}`, {
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
            showNotification('✅ Tarefa reativada!', 'success');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

// ===== DELETAR TAREFA =====
async function deleteTask(taskId) {
    if (!confirm('Deseja excluir esta tarefa permanentemente?')) {
        return;
    }
    
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/tasks/${taskId}?user_id=${user.id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            completedTasks = completedTasks.filter(t => t.id !== taskId);
            updateStats();
            renderCompletedTasks();
            showNotification('🗑️ Tarefa excluída!', 'success');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

// ===== UTILITÁRIOS =====
function formatDate(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

function showNotification(message, type) {
    console.log(message);
    // Implementar notificação visual
}

// ===== INICIALIZAR =====
window.addEventListener('DOMContentLoaded', () => {
    loadCompletedTasks();
});