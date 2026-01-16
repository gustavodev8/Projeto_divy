/* ========================================
   PAINEL LATERAL DE DETALHES DA TAREFA
   ======================================== */

let currentDetailTaskId = null;
let updateTimeout = null;
let descriptionDebounceTimer = null;
let titleDebounceTimer = null;
let taskToDelete = null;

// ===== ABRIR PAINEL DE DETALHES =====
async function openTaskDetailPanel(taskId) {
    const task = window.homeTasks.find(t => t.id === taskId);
    if (!task) {
        console.error('❌ Tarefa não encontrada:', taskId);
        return;
    }

    console.log('📋 Abrindo painel de detalhes da tarefa:', task.title);

    const isReadOnly = !!window.currentSmartFilter;
    
    if (isReadOnly) {
        console.log('🔒 Modo somente leitura - edição bloqueada');
    }

    currentDetailTaskId = taskId;

    // Preencher campos
    document.getElementById('detailTaskCheckbox').checked = task.status === 'completed';
    document.getElementById('detailTaskTitle').value = task.title || '';
    document.getElementById('detailTaskDescription').value = task.description || '';
    document.getElementById('detailTaskPriority').value = task.priority || 'medium';

    // Formatar data
    if (task.due_date) {
        let dateValue;
        if (typeof task.due_date === 'string') {
            dateValue = task.due_date.split('T')[0];
        } else if (task.due_date instanceof Date) {
            dateValue = task.due_date.toISOString().split('T')[0];
        }
        document.getElementById('detailTaskDueDate').value = dateValue || '';
    } else {
        document.getElementById('detailTaskDueDate').value = '';
    }

    // Carregar subtarefas
    if (typeof loadSubtasks === 'function') {
        await loadSubtasks(taskId);
    }

    // Aplicar modo somente leitura se necessário
    if (isReadOnly) {
        setTaskDetailReadOnly(true);
    } else {
        setTaskDetailReadOnly(false);
    }

    // Auto-resize textareas
    autoResizeTextarea(document.getElementById('detailTaskTitle'));
    autoResizeTextarea(document.getElementById('detailTaskDescription'));

    // Mostrar painel
    document.getElementById('taskDetailPanel').classList.add('active');
    document.getElementById('taskDetailOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Configurar auto-save
    setupTitleAutoSave();
    setupDescriptionAutoSave();
}

// ===== FECHAR PAINEL =====
function closeTaskDetailPanel() {
    document.getElementById('taskDetailPanel').classList.remove('active');
    document.getElementById('taskDetailOverlay').classList.remove('active');
    document.body.style.overflow = '';
    currentDetailTaskId = null;

    console.log('🚪 Painel de detalhes fechado');
}

// ===== AUTO RESIZE TEXTAREA =====
function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// ===== AUTO-SAVE TÍTULO =====
function setupTitleAutoSave() {
    const titleInput = document.getElementById('detailTaskTitle');
    
    if (!titleInput) return;
    
    titleInput.replaceWith(titleInput.cloneNode(true));
    const newTitleInput = document.getElementById('detailTaskTitle');
    
    newTitleInput.addEventListener('input', async () => {
        autoResizeTextarea(newTitleInput);
        
        if (titleDebounceTimer) {
            clearTimeout(titleDebounceTimer);
        }
        
        titleDebounceTimer = setTimeout(async () => {
            const taskId = currentDetailTaskId;
            const newTitle = newTitleInput.value.trim();
            
            if (!taskId || !newTitle) return;
            
            console.log('💾 Auto-salvando título:', newTitle);
            
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
                        title: newTitle,
                        user_id: user.id
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    const task = window.homeTasks.find(t => t.id === taskId);
                    if (task) {
                        task.title = newTitle;
                        task.name = newTitle;
                    }
                    
                    const currentTask = window.currentListTasks?.find(t => t.id === taskId);
                    if (currentTask) {
                        currentTask.title = newTitle;
                        currentTask.name = newTitle;
                    }
                    
                    console.log('✅ Título salvo automaticamente');
                    
                    if (typeof renderAllTasks === 'function') {
                        renderAllTasks();
                    }
                    
                    if (typeof updatePageTitle === 'function') {
                        updatePageTitle();
                    }
                    
                } else {
                    console.error('❌ Erro ao salvar título:', result);
                }
            } catch (error) {
                console.error('❌ Erro na requisição:', error);
            }
        }, 300);
    });
}

// ===== AUTO-SAVE DESCRIÇÃO =====
function setupDescriptionAutoSave() {
    const descInput = document.getElementById('detailTaskDescription');
    
    if (!descInput) return;
    
    descInput.replaceWith(descInput.cloneNode(true));
    const newDescInput = document.getElementById('detailTaskDescription');
    
    newDescInput.addEventListener('input', async () => {
        autoResizeTextarea(newDescInput);
        
        if (descriptionDebounceTimer) {
            clearTimeout(descriptionDebounceTimer);
        }
        
        descriptionDebounceTimer = setTimeout(async () => {
            const taskId = currentDetailTaskId;
            const newDescription = newDescInput.value.trim();
            
            if (!taskId) return;
            
            console.log('💾 Auto-salvando descrição:', newDescription);
            
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
                        description: newDescription,
                        user_id: user.id
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    const task = window.homeTasks.find(t => t.id === taskId);
                    if (task) {
                        task.description = newDescription;
                    }
                    
                    const currentTask = window.currentListTasks?.find(t => t.id === taskId);
                    if (currentTask) {
                        currentTask.description = newDescription;
                    }
                    
                    console.log('✅ Descrição salva automaticamente');
                    
                    if (typeof renderAllTasks === 'function') {
                        renderAllTasks();
                    }
                    
                } else {
                    console.error('❌ Erro ao salvar descrição:', result);
                }
            } catch (error) {
                console.error('❌ Erro na requisição:', error);
            }
        }, 300);
    });
}

// ===== ATUALIZAR DATA =====
function updateTaskDueDate() {
    const dueDate = document.getElementById('detailTaskDueDate').value;
    updateTaskField('due_date', dueDate || null);
}

// ===== ATUALIZAR PRIORIDADE =====
function updateTaskPriority() {
    const priority = document.getElementById('detailTaskPriority').value;
    console.log('🎯 Mudando prioridade para:', priority);
    
    const task = window.homeTasks.find(t => t.id === currentDetailTaskId);
    if (task) {
        task.priority = priority;
    }
    
    updateTaskVisualInList(currentDetailTaskId);
    updateTaskField('priority', priority);
}

// ===== ATUALIZAR CAMPO =====
async function updateTaskField(field, value) {
    if (!currentDetailTaskId || !currentUser) {
        console.error('❌ Falta currentDetailTaskId ou currentUser');
        return;
    }

    console.log('🔄 Atualizando campo:', field, '=', value);

    const task = window.homeTasks.find(t => t.id === currentDetailTaskId);
    if (task) {
        task[field] = value;
        console.log(`⚡ Atualização otimista: ${field} = ${value}`);
        updateTaskVisualInList(currentDetailTaskId);
    }

    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }

    updateTimeout = setTimeout(async () => {
        console.log(`💾 Salvando ${field} no servidor:`, value);

        try {
            const response = await fetch(`${API_URL}/api/tasks/${currentDetailTaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [field]: value,
                    user_id: currentUser.id
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ ${field} sincronizado com servidor`);
                
                if (field === 'due_date' && typeof updateSmartFilterBadges === 'function') {
                    updateSmartFilterBadges();
                }
            } else {
                console.error('❌ Erro ao salvar:', result.error);
            }
        } catch (error) {
            console.error('❌ Erro de conexão:', error);
        }
    }, 500);
}

// ===== TOGGLE STATUS =====
async function toggleTaskFromDetail() {
    const isChecked = document.getElementById('detailTaskCheckbox').checked;
    const newStatus = isChecked ? 'completed' : 'pending';

    console.log(`✅ Alterando status para: ${newStatus}`);

    const task = window.homeTasks.find(t => t.id === currentDetailTaskId);
    if (task) {
        task.status = newStatus;
        updateTaskVisualInList(currentDetailTaskId);
    }

    try {
        const response = await fetch(`${API_URL}/api/tasks/${currentDetailTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: newStatus,
                user_id: currentUser.id
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Status sincronizado com servidor');
            showNotification(newStatus === 'completed' ? '✅ Tarefa concluída!' : '⏳ Tarefa reaberta!');
            
            if (typeof updateSmartFilterBadges === 'function') {
                updateSmartFilterBadges();
            }
        } else {
            if (task) {
                task.status = isChecked ? 'pending' : 'completed';
                updateTaskVisualInList(currentDetailTaskId);
                document.getElementById('detailTaskCheckbox').checked = !isChecked;
            }
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        if (task) {
            task.status = isChecked ? 'pending' : 'completed';
            updateTaskVisualInList(currentDetailTaskId);
            document.getElementById('detailTaskCheckbox').checked = !isChecked;
        }
    }
}

// ===== DELETE TASK =====
async function deleteTaskFromDetail() {
    const task = window.homeTasks.find(t => t.id === currentDetailTaskId);
    const taskName = task ? task.title : 'Esta tarefa';
    
    showConfirmDeleteModal(currentDetailTaskId, taskName);
}

// ===== ATUALIZAR VISUAL =====
function updateTaskVisualInList(taskId) {
    console.log('🔄 updateTaskVisualInList chamada para tarefa:', taskId);
    
    if (typeof renderAllTasks === 'function') {
        renderAllTasks();
        console.log('✅ Lista/Kanban re-renderizado');
    }
}

// ===== MODO SOMENTE LEITURA =====
function setTaskDetailReadOnly(readOnly) {
    const checkbox = document.getElementById('detailTaskCheckbox');
    const title = document.getElementById('detailTaskTitle');
    const description = document.getElementById('detailTaskDescription');
    const dueDate = document.getElementById('detailTaskDueDate');
    const priority = document.getElementById('detailTaskPriority');
    const deleteBtn = document.querySelector('.btn-detail-delete');
    const panel = document.getElementById('taskDetailPanel');
    
    if (readOnly) {
        if (checkbox) checkbox.disabled = true;
        if (title) {
            title.readOnly = true;
            title.style.cursor = 'default';
        }
        if (description) {
            description.readOnly = true;
            description.style.cursor = 'default';
        }
        if (dueDate) dueDate.disabled = true;
        if (priority) priority.disabled = true;
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        panel.classList.add('read-only');
        
        console.log('🔒 Painel em modo somente leitura');
    } else {
        if (checkbox) checkbox.disabled = false;
        if (title) {
            title.readOnly = false;
            title.style.cursor = 'text';
        }
        if (description) {
            description.readOnly = false;
            description.style.cursor = 'text';
        }
        if (dueDate) dueDate.disabled = false;
        if (priority) priority.disabled = false;
        if (deleteBtn) deleteBtn.style.display = '';
        
        panel.classList.remove('read-only');
        
        console.log('✏️ Painel em modo edição');
    }
}

/* ========================================
   MODAL DE CONFIRMAÇÃO
   ======================================== */

function showConfirmDeleteModal(taskId, taskName) {
    console.log('🎯 showConfirmDeleteModal chamada!', taskId, taskName);
    
    taskToDelete = taskId;
    
    const overlay = document.getElementById('confirmModalOverlay');
    const taskNameElement = document.getElementById('confirmModalTaskName');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    
    console.log('   overlay:', !!overlay);
    console.log('   taskNameElement:', !!taskNameElement);
    console.log('   confirmBtn:', !!confirmBtn);
    
    if (taskNameElement) {
        taskNameElement.textContent = taskName || 'Esta tarefa';
    }
    
    if (overlay) {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal ABERTO!');
    } else {
        console.error('❌ Overlay não encontrado!');
    }
    
    if (confirmBtn) {
        confirmBtn.onclick = () => confirmDeleteTask();
    }
    
    document.addEventListener('keydown', handleConfirmModalEscape);
}

function closeConfirmModal() {
    const overlay = document.getElementById('confirmModalOverlay');
    
    if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    taskToDelete = null;
    document.removeEventListener('keydown', handleConfirmModalEscape);
}

function handleConfirmModalEscape(e) {
    if (e.key === 'Escape') {
        closeConfirmModal();
    }
}

async function confirmDeleteTask() {
    console.log('🗑️ Confirmando exclusão da tarefa:', taskToDelete);
    
    if (!taskToDelete) return;
    
    if (typeof confirmDeleteTaskFromHome === 'function' && !currentDetailTaskId) {
        await confirmDeleteTaskFromHome(taskToDelete);
        closeConfirmModal();
        return;
    }
    
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskToDelete}?user_id=${currentUser.id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            window.homeTasks = window.homeTasks.filter(t => t.id !== taskToDelete);
            closeConfirmModal();
            
            if (typeof closeTaskDetailPanel === 'function') {
                closeTaskDetailPanel();
            }
            
            if (typeof filterTasksByCurrentList === 'function') {
                filterTasksByCurrentList();
            }
            
            if (typeof renderAllTasks === 'function') {
                renderAllTasks();
            }
            
            if (typeof updatePageTitle === 'function') {
                updatePageTitle();
            }
            
            if (typeof updateSmartFilterBadges === 'function') {
                updateSmartFilterBadges();
            }
            
            showNotification('🗑️ Tarefa excluída!');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('❌ Erro ao excluir tarefa');
    }
}

// Fechar modal ao clicar no overlay
document.addEventListener('click', (e) => {
    if (e.target.id === 'confirmModalOverlay') {
        closeConfirmModal();
    }
});

// ===== EXPORTAR =====
window.openTaskDetailPanel = openTaskDetailPanel;
window.closeTaskDetailPanel = closeTaskDetailPanel;
window.autoResizeTextarea = autoResizeTextarea;
window.setupTitleAutoSave = setupTitleAutoSave;
window.setupDescriptionAutoSave = setupDescriptionAutoSave;
window.updateTaskDueDate = updateTaskDueDate;
window.updateTaskPriority = updateTaskPriority;
window.toggleTaskFromDetail = toggleTaskFromDetail;
window.deleteTaskFromDetail = deleteTaskFromDetail;
window.updateTaskVisualInList = updateTaskVisualInList;
window.setTaskDetailReadOnly = setTaskDetailReadOnly;
window.showConfirmDeleteModal = showConfirmDeleteModal;
window.closeConfirmModal = closeConfirmModal;
window.confirmDeleteTask = confirmDeleteTask;

console.log('✅ task-detail-panel.js carregado');