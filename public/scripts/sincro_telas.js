/* ========================================
   SISTEMA DE TAREFAS - COM KANBAN
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
    
    // ✅ APLICAR DESTAQUES APÓS RENDERIZAR
    setTimeout(() => {
        forceApplyHighlights();
    }, 100);
}

// ===== RENDERIZAR VISTA EM LISTA =====
function renderListView(container) {
    container.innerHTML = '';
    container.style.display = 'block';
    container.style.flexDirection = '';
    container.style.gap = '';

    // ✅ ORDENAR POR PRIORIDADE E DEPOIS POR STATUS
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    
    const sortedTasks = [...homeTasks].sort((a, b) => {
        const aCompleted = a.status === 'completed' || a.status === 'concluido' || a.status === 'concluída';
        const bCompleted = b.status === 'completed' || b.status === 'concluido' || b.status === 'concluída';
        
        // 1. Tarefas concluídas vão para o final
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
        
        // 2. Se ambas não concluídas, ordenar por PRIORIDADE
        if (!aCompleted && !bCompleted) {
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority; // HIGH (1) vem antes de MEDIUM (2) vem antes de LOW (3)
            }
        }
        
        // 3. Se mesma prioridade, ordenar por data (mais recente primeiro)
        return new Date(b.created_at) - new Date(a.created_at);
    });

    console.log('📊 Tarefas ordenadas por prioridade:', sortedTasks.map(t => `${t.title} (${t.priority})`));

    sortedTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        container.appendChild(taskElement);
    });
}

// ===== RENDERIZAR VISTA KANBAN =====
function renderKanbanView(container) {
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.gap = '20px';
    container.style.alignItems = 'flex-start';

    // Criar 3 colunas
    const columns = {
        pending: { title: '📋 Pendente', color: '#f39c12', tasks: [] },
        in_progress: { title: '🔄 Em Progresso', color: '#3498db', tasks: [] },
        completed: { title: '✅ Concluído', color: '#2ecc71', tasks: [] }
    };

    // Separar tarefas por status
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

    // Criar colunas
    Object.keys(columns).forEach(columnKey => {
        const column = columns[columnKey];
        
        const columnDiv = document.createElement('div');
        columnDiv.className = 'kanban-column';
        columnDiv.setAttribute('data-kanban-column', columnKey);
        columnDiv.style.cssText = `
            flex: 1;
            background: #f8f9fa;
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

// Adicionar tarefas ordenadas
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
        background: white;
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
        const settings = window.nuraSettingsFunctions ? window.nuraSettingsFunctions.getSettings() : { highlightUrgent: false };
        if (settings.highlightUrgent) {
            // Manter o box-shadow dos destaques
            const priority = task.priority || 'medium';
            if (priority === 'high') {
                card.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.3)';
            } else if (priority === 'medium') {
                card.style.boxShadow = '0 2px 8px rgba(243, 156, 18, 0.2)';
            } else {
                card.style.boxShadow = '0 2px 8px rgba(46, 204, 113, 0.2)';
            }
        } else {
            card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        }
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
        ${task.description ? `<p style="font-size: 12px; color: #666; margin-bottom: 10px;">${task.description}</p>` : ''}
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

// ===== CRIAR ELEMENTO DE TAREFA (LISTA) =====
function createTaskElement(task) {
    const taskDiv = document.createElement('div');
    const isCompleted = task.status === 'completed' || task.status === 'concluido' || task.status === 'concluída';
    
    taskDiv.className = `list-group-item d-flex justify-content-between align-items-center ${isCompleted ? 'completed-task' : ''}`;
    taskDiv.setAttribute('data-task-id', task.id);
    taskDiv.setAttribute('data-task-status', isCompleted ? 'completed' : 'pending');
    taskDiv.setAttribute('data-task-priority', task.priority || 'medium');

    const taskTitle = task.title || task.name || 'Tarefa sem nome';

    const statusIcon = isCompleted ? '✅' : 
                      task.status === 'in_progress' || task.status === 'progresso' ? '🔄' : '⏳';

    taskDiv.innerHTML = `
        <div class="task-content" style="flex: 1;">
            <div class="d-flex justify-content-between align-items-center w-100">
                <div style="flex: 1;">
                    <h5 class="mb-1 ${isCompleted ? 'text-decoration-line-through text-muted' : ''}" style="font-size: 1.25rem; font-weight: 500;">
                        ${statusIcon} ${taskTitle}
                    </h5>
                    ${task.description ? `<p class="text-muted mb-0" style="font-size: 0.95rem;">${task.description}</p>` : ''}
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-outline-success" onclick="toggleTaskFromHome(${task.id})" title="${isCompleted ? 'Reabrir tarefa' : 'Concluir tarefa'}" style="font-size: 1.1rem; padding: 0.5rem 1rem;">
                        ${isCompleted ? '↶' : '✓'}
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteTaskFromHome(${task.id})" title="Excluir tarefa" style="font-size: 1.3rem; padding: 0.4rem 0.9rem;">
                        ×
                    </button>
                </div>
            </div>
        </div>
    `;

    return taskDiv;
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
        // Ocultar coluna completed no Kanban
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
        forceApplyHighlights(); // ✅ CHAMAR A FUNÇÃO
    } else {
        console.log('➡️ Removendo destaque de tarefas');
        document.querySelectorAll('[data-task-priority]').forEach(task => {
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
    const highTasks = document.querySelectorAll('[data-task-priority="high"]');
    console.log(`🔴 Aplicando em ${highTasks.length} tarefas HIGH`);
    highTasks.forEach(task => {
        if (task.classList.contains('kanban-card')) {
            task.style.borderLeft = '4px solid #e74c3c';
            task.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.3)';
        } else {
            task.style.borderLeft = '5px solid #e74c3c';
            task.style.backgroundColor = '#ffe8e8';
        }
    });
    
    // MEDIUM priority
    const mediumTasks = document.querySelectorAll('[data-task-priority="medium"]');
    console.log(`🟡 Aplicando em ${mediumTasks.length} tarefas MEDIUM`);
    mediumTasks.forEach(task => {
        if (task.classList.contains('kanban-card')) {
            task.style.borderLeft = '4px solid #f39c12';
            task.style.boxShadow = '0 2px 8px rgba(243, 156, 18, 0.2)';
        } else {
            task.style.borderLeft = '5px solid #f39c12';
            task.style.backgroundColor = '#fff5e6';
        }
    });
    
    // LOW priority
    const lowTasks = document.querySelectorAll('[data-task-priority="low"]');
    console.log(`🟢 Aplicando em ${lowTasks.length} tarefas LOW`);
    lowTasks.forEach(task => {
        if (task.classList.contains('kanban-card')) {
            task.style.borderLeft = '4px solid #2ecc71';
            task.style.boxShadow = '0 2px 8px rgba(46, 204, 113, 0.2)';
        } else {
            task.style.borderLeft = '5px solid #2ecc71';
            task.style.backgroundColor = '#f0fdf4';
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

// ===== ESTADO VAZIO =====
function showEmptyState() {
    const container = document.getElementById('listaTarefas');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-4">
            <p class="text-muted mb-1">🎯 Nenhuma tarefa cadastrada!</p>
            <small class="text-muted">Clique em "Adicionar Tarefa"</small>
        </div>
    `;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #49a09d;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
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
                // ✅ DETERMINAR PRIORIDADE INTELIGENTE
                const priority = determinarPrioridade(texto);
                
                console.log('📝', texto, '→ Prioridade:', priority);
                
                const tarefa = {
                    title: texto.substring(0, 100),
                    description: 'Importado da rotina IA',
                    priority: priority, // ✅ USAR PRIORIDADE DETERMINADA
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
    showNotification(`✅ ${salvas} tarefas salvas com prioridades definidas!`);
    loadAndDisplayTasksFromDatabase();
}

// ===== DETERMINAR PRIORIDADE BASEADA NO CONTEÚDO =====
function determinarPrioridade(textoTarefa) {
    const texto = textoTarefa.toLowerCase();
    
    console.log('🔍 Analisando:', texto);
    
    // Palavras-chave para ALTA prioridade
    const palavrasAlta = [
        'urgente', 'importante', 'crítico', 'prazo', 'deadline', 
        'reunião', 'apresentação', 'entrega', 'cliente', 'projeto',
        'trabalho', 'estudo', 'prova', 'exame', 'compromisso',
        'pagamento', 'conta', 'vencimento', 'médico', 'saúde'
    ];
    
    // Palavras-chave para BAIXA prioridade
    const palavrasBaixa = [
        'descanso', 'relaxar', 'lazer', 'pausa', 'intervalo',
        'lanche', 'café', 'alongamento', 'caminhada', 'hobby',
        'série', 'jogo', 'música', 'leitura', 'entretenimento'
    ];
    
    // Verificar alta prioridade
    for (const palavra of palavrasAlta) {
        if (texto.includes(palavra)) {
            console.log('✅ Palavra encontrada:', palavra, '→ HIGH');
            return 'high';
        }
    }
    
    // Verificar baixa prioridade
    for (const palavra of palavrasBaixa) {
        if (texto.includes(palavra)) {
            console.log('✅ Palavra encontrada:', palavra, '→ LOW');
            return 'low';
        }
    }
    
    console.log('➡️ Nenhuma palavra-chave → MEDIUM');
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
window.forceApplyHighlights = forceApplyHighlights; // ✅ EXPORTAR

console.log('✅ sincro_telas.js carregado com prioridade inteligente e destaques funcionando!');