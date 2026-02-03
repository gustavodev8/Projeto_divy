/* ========================================
   SISTEMA DE SUBTAREFAS - JavaScript
   Integrado com IA do Google Gemini
   ======================================== */

// ===== URL DA API (detecta automaticamente localhost ou produção) =====
const SUBTASKS_API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// ===== VARIÁVEIS GLOBAIS =====
let currentTaskSubtasks = [];
let currentTaskIdForSubtasks = null;

// ===== CARREGAR SUBTAREFAS =====
async function loadSubtasks(taskId) {
    currentTaskIdForSubtasks = taskId;
    
    try {
        console.log(`📋 Carregando subtarefas da tarefa ${taskId}`);
        
        const response = await fetch(`${SUBTASKS_API_URL}/subtasks/${taskId}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar subtarefas');
        }
        
        const subtasks = await response.json();
        console.log(`✅ ${subtasks.length} subtarefas carregadas:`, subtasks);
        
        currentTaskSubtasks = subtasks;
        renderSubtasks(subtasks);
        updateSubtasksProgress();
        
    } catch (error) {
        console.error('❌ Erro ao carregar subtarefas:', error);
        showNotification('Erro ao carregar subtarefas', 'error');
    }
}

// ===== RENDERIZAR SUBTAREFAS =====
function renderSubtasks(subtasks) {
    const container = document.getElementById('subtasksList');
    const progressContainer = document.getElementById('subtasksProgress');
    const countBadge = document.getElementById('subtasksCount');
    const addButton = document.getElementById('btnAddSubtask');
    const generateButton = document.getElementById('btnGenerateSubtasks');
    
    if (!container) return;
    
    // ✅ VERIFICAR MODO SOMENTE LEITURA
    const isReadOnly = !!window.currentSmartFilter;
    
    // Atualizar contador
    if (countBadge) {
        countBadge.textContent = subtasks.length;
    }
    
    // Mostrar/ocultar barra de progresso
    if (progressContainer) {
        progressContainer.style.display = subtasks.length > 0 ? 'flex' : 'none';
    }
    
    // ✅ BLOQUEAR BOTÕES DE ADICIONAR E GERAR SE READ-ONLY
    if (addButton) {
        if (isReadOnly) {
            addButton.style.display = 'none';
        } else {
            addButton.style.display = '';
        }
    }
    
    if (generateButton) {
        if (isReadOnly) {
            generateButton.style.display = 'none';
        } else {
            generateButton.style.display = '';
        }
    }
    
    // Limpar container
    container.innerHTML = '';
    
    // Se não há subtarefas, não renderizar nada
    if (subtasks.length === 0) {
        return;
    }
    
    // Ordenar por position
    subtasks.sort((a, b) => a.position - b.position);
    
    // Renderizar cada subtarefa
    subtasks.forEach(subtask => {
        const subtaskElement = createSubtaskElement(subtask, isReadOnly);
        container.appendChild(subtaskElement);
    });
}

// ===== CRIAR ELEMENTO DE SUBTAREFA =====
function createSubtaskElement(subtask, isReadOnly = false) {
    const div = document.createElement('div');
    div.className = 'subtask-item' + (subtask.completed ? ' completed' : '');
    div.dataset.subtaskId = subtask.id;
    
    div.innerHTML = `
        <label class="subtask-checkbox">
            <input 
                type="checkbox" 
                ${subtask.completed ? 'checked' : ''} 
                onchange="toggleSubtask(this)"
                ${isReadOnly ? 'disabled' : ''}
            >
            <span class="subtask-checkbox-mark"></span>
        </label>
        <div class="subtask-content">
            <span class="subtask-text">${escapeHtml(subtask.title)}</span>
        </div>
        <div class="subtask-actions" style="${isReadOnly ? 'display: none;' : ''}">
            <button class="btn-subtask-action edit" onclick="editSubtask(this)" title="Editar">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
            <button class="btn-subtask-action delete" onclick="deleteSubtask(this)" title="Excluir">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `;
    
    return div;
}

// ===== TOGGLE SUBTAREFA (COMPLETAR/DESCOMPLETAR) =====
async function toggleSubtask(checkbox) {
    // ✅ VERIFICAR SE ESTÁ EM MODO SOMENTE LEITURA
    const isReadOnly = !!window.currentSmartFilter;
    
    if (isReadOnly) {
        console.log('🔒 Não é possível marcar subtarefas em modo somente leitura');
        checkbox.checked = !checkbox.checked;
        if (typeof showNotification === 'function') {
            showNotification('🔒 Não é possível modificar subtarefas nesta visualização', 'error');
        }
        return;
    }
    
    const subtaskItem = checkbox.closest('.subtask-item');
    const subtaskId = parseInt(subtaskItem.dataset.subtaskId);
    const completed = checkbox.checked;
    
    try {
        console.log(`🔄 Toggle subtarefa ${subtaskId}: ${completed}`);
        
        const response = await fetch(`${SUBTASKS_API_URL}/subtasks/${subtaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao atualizar subtarefa');
        }
        
        // Atualizar visualmente
        if (completed) {
            subtaskItem.classList.add('completed');
        } else {
            subtaskItem.classList.remove('completed');
        }
        
        // Atualizar no array local
        const subtask = currentTaskSubtasks.find(s => s.id === subtaskId);
        if (subtask) {
            subtask.completed = completed;
        }
        
        // Atualizar progresso
        updateSubtasksProgress();
        
        console.log('✅ Subtarefa atualizada');
        
    } catch (error) {
        console.error('❌ Erro ao toggle subtarefa:', error);
        checkbox.checked = !completed; // Reverter
        showNotification('Erro ao atualizar subtarefa', 'error');
    }
}

// ===== MOSTRAR INPUT DE NOVA SUBTAREFA =====
function showSubtaskInput() {
    // ✅ VERIFICAR SE ESTÁ EM MODO SOMENTE LEITURA
    const isReadOnly = !!window.currentSmartFilter;
    
    if (isReadOnly) {
        console.log('🔒 Não é possível adicionar subtarefas em modo somente leitura');
        if (typeof showNotification === 'function') {
            showNotification('🔒 Não é possível adicionar subtarefas nesta visualização', 'error');
        }
        return;
    }
    
    const trigger = document.getElementById('btnAddSubtask');
    const container = document.getElementById('subtaskInputContainer');
    const input = document.getElementById('subtaskInput');
    
    if (!trigger || !container || !input) return;
    
    trigger.style.display = 'none';
    container.classList.add('active');
    input.focus();
}

// ===== OCULTAR INPUT DE NOVA SUBTAREFA =====
function hideSubtaskInput() {
    const trigger = document.getElementById('btnAddSubtask');
    const container = document.getElementById('subtaskInputContainer');
    const input = document.getElementById('subtaskInput');
    
    if (!trigger || !container || !input) return;
    
    trigger.style.display = 'flex';
    container.classList.remove('active');
    input.value = '';
}

// ===== HANDLE ENTER NO INPUT =====
function handleSubtaskInputKeypress(event) {
    if (event.key === 'Enter') {
        saveNewSubtask();
    } else if (event.key === 'Escape') {
        hideSubtaskInput();
    }
}

// ===== SALVAR NOVA SUBTAREFA =====
async function saveNewSubtask() {
    // ✅ VERIFICAR SE ESTÁ EM MODO SOMENTE LEITURA
    const isReadOnly = !!window.currentSmartFilter;
    
    if (isReadOnly) {
        console.log('🔒 Não é possível adicionar subtarefas em modo somente leitura');
        hideSubtaskInput();
        if (typeof showNotification === 'function') {
            showNotification('🔒 Não é possível adicionar subtarefas nesta visualização', 'error');
        }
        return;
    }
    
    const input = document.getElementById('subtaskInput');
    const title = input?.value?.trim();
    
    if (!title) {
        showNotification('Digite uma subtarefa', 'error');
        return;
    }
    
    if (!currentTaskIdForSubtasks) {
        showNotification('Nenhuma tarefa selecionada', 'error');
        return;
    }
    
    try {
        console.log(`💾 Salvando nova subtarefa: "${title}"`);
        
        const position = currentTaskSubtasks.length;
        
        // Obter user_id para verificação de limite
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');

        const response = await fetch(`${SUBTASKS_API_URL}/subtasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id: currentTaskIdForSubtasks,
                title: title,
                position: position,
                user_id: userData.id
            })
        });

        const result = await response.json();

        // Verificar se é erro de limite de plano
        if (!response.ok || result.code === 'PLAN_LIMIT_REACHED') {
            if (result.code === 'PLAN_LIMIT_REACHED' && window.PlanService) {
                hideSubtaskInput();

                // Pequeno delay para garantir que o input fechou
                setTimeout(() => {
                    window.PlanService.showUpgradeModal(
                        result.error || 'Você atingiu o limite de subtarefas do seu plano.',
                        result.plan || 'normal',
                        result.upgrade || 'pro'
                    );
                }, 100);
                return;
            }
            throw new Error(result.error || 'Erro ao criar subtarefa');
        }

        console.log('✅ Subtarefa criada:', result);

        // Adicionar ao array local
        currentTaskSubtasks.push(result);

        // Renderizar novamente
        renderSubtasks(currentTaskSubtasks);
        updateSubtasksProgress();

        // Limpar e ocultar input
        hideSubtaskInput();

        showNotification('Subtarefa adicionada!', 'success');

    } catch (error) {
        console.error('❌ Erro ao salvar subtarefa:', error);
        showNotification('Erro ao adicionar subtarefa', 'error');
    }
}

// ===== EDITAR SUBTAREFA =====
async function editSubtask(button) {
    // ✅ VERIFICAR SE ESTÁ EM MODO SOMENTE LEITURA
    const isReadOnly = !!window.currentSmartFilter;
    
    if (isReadOnly) {
        console.log('🔒 Não é possível editar subtarefas em modo somente leitura');
        if (typeof showNotification === 'function') {
            showNotification('🔒 Não é possível editar subtarefas nesta visualização', 'error');
        }
        return;
    }
    
    const subtaskItem = button.closest('.subtask-item');
    const subtaskId = parseInt(subtaskItem.dataset.subtaskId);
    const textElement = subtaskItem.querySelector('.subtask-text');
    const currentText = textElement.textContent;
    
    // Substituir texto por input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'subtask-input';
    input.style.margin = '0';
    input.style.padding = '4px 8px';
    
    const content = subtaskItem.querySelector('.subtask-content');
    content.innerHTML = '';
    content.appendChild(input);
    input.focus();
    input.select();
    
    // Salvar ao perder foco ou apertar Enter
    const saveEdit = async () => {
        const newTitle = input.value.trim();
        
        if (!newTitle) {
            content.innerHTML = `<span class="subtask-text">${escapeHtml(currentText)}</span>`;
            return;
        }
        
        if (newTitle === currentText) {
            content.innerHTML = `<span class="subtask-text">${escapeHtml(currentText)}</span>`;
            return;
        }
        
        try {
            console.log(`✏️ Editando subtarefa ${subtaskId}: "${newTitle}"`);
            
            const response = await fetch(`${SUBTASKS_API_URL}/subtasks/${subtaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao editar subtarefa');
            }
            
            // Atualizar no array local
            const subtask = currentTaskSubtasks.find(s => s.id === subtaskId);
            if (subtask) {
                subtask.title = newTitle;
            }
            
            // Atualizar visualmente
            content.innerHTML = `<span class="subtask-text">${escapeHtml(newTitle)}</span>`;
            
            console.log('✅ Subtarefa editada');
            
        } catch (error) {
            console.error('❌ Erro ao editar subtarefa:', error);
            content.innerHTML = `<span class="subtask-text">${escapeHtml(currentText)}</span>`;
            showNotification('Erro ao editar subtarefa', 'error');
        }
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            content.innerHTML = `<span class="subtask-text">${escapeHtml(currentText)}</span>`;
        }
    });
}

// ===== DELETAR SUBTAREFA =====
async function deleteSubtask(button) {
    // ✅ VERIFICAR SE ESTÁ EM MODO SOMENTE LEITURA
    const isReadOnly = !!window.currentSmartFilter;
    
    if (isReadOnly) {
        console.log('🔒 Não é possível excluir subtarefas em modo somente leitura');
        if (typeof showNotification === 'function') {
            showNotification('🔒 Não é possível excluir subtarefas nesta visualização', 'error');
        }
        return;
    }
    
    const subtaskItem = button.closest('.subtask-item');
    const subtaskId = parseInt(subtaskItem.dataset.subtaskId);
    
    if (!confirm('Deseja excluir esta subtarefa?')) {
        return;
    }
    
    try {
        console.log(`🗑️ Deletando subtarefa ${subtaskId}`);
        
        const response = await fetch(`${SUBTASKS_API_URL}/subtasks/${subtaskId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao deletar subtarefa');
        }
        
        // Remover do array local
        currentTaskSubtasks = currentTaskSubtasks.filter(s => s.id !== subtaskId);
        
        // Renderizar novamente
        renderSubtasks(currentTaskSubtasks);
        updateSubtasksProgress();
        
        console.log('✅ Subtarefa deletada');
        showNotification('Subtarefa excluída', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao deletar subtarefa:', error);
        showNotification('Erro ao excluir subtarefa', 'error');
    }
}

// ===== ATUALIZAR PROGRESSO =====
function updateSubtasksProgress() {
    const progressBar = document.getElementById('subtasksProgressBar');
    const progressText = document.getElementById('subtasksProgressText');
    
    if (!progressBar || !progressText) return;
    
    const total = currentTaskSubtasks.length;
    const completed = currentTaskSubtasks.filter(s => s.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${completed}/${total}`;
}

// ===== GERAR SUBTAREFAS COM IA =====
async function generateSubtasksWithAI() {
    // ✅ VERIFICAR SE ESTÁ EM MODO SOMENTE LEITURA
    const isReadOnly = !!window.currentSmartFilter;
    
    if (isReadOnly) {
        console.log('🔒 Não é possível gerar subtarefas em modo somente leitura');
        if (typeof showNotification === 'function') {
            showNotification('🔒 Não é possível gerar subtarefas nesta visualização', 'error');
        }
        return;
    }
    
    const taskTitle = document.getElementById('detailTaskTitle')?.value?.trim();
    const taskDescription = document.getElementById('detailTaskDescription')?.value?.trim();
    
    if (!taskTitle) {
        showNotification('A tarefa precisa ter um título', 'error');
        return;
    }
    
    if (!currentTaskIdForSubtasks) {
        showNotification('Nenhuma tarefa selecionada', 'error');
        return;
    }
    
    const btn = document.getElementById('btnGenerateSubtasks');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 11-6.219-8.56"></path>
            </svg>
            Gerando...
        `;
    }
    
    try {
        console.log('🤖 Gerando subtarefas com IA...');
        console.log(`Tarefa: "${taskTitle}"`);
        console.log(`Descrição: "${taskDescription}"`);
        
        const prompt = `Quebre a seguinte tarefa em subtarefas específicas e acionáveis:

Tarefa: ${taskTitle}
${taskDescription ? `Descrição: ${taskDescription}` : ''}

Retorne APENAS uma lista numerada de subtarefas práticas e objetivas, cada uma em uma linha. 
Não adicione explicações, apenas a lista.
Máximo 8 subtarefas.

Exemplo de formato:
1. Primeira subtarefa
2. Segunda subtarefa
3. Terceira subtarefa`;

        const response = await fetch(`${SUBTASKS_API_URL}/gemini/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
            throw new Error('Erro na API do Gemini');
        }
        
        const data = await response.json();
        const generatedText = data.text || '';
        
        console.log('✅ Resposta da IA:', generatedText);
        
        // Parsear subtarefas
        const subtaskTitles = parseSubtasksFromAI(generatedText);
        
        if (subtaskTitles.length === 0) {
            throw new Error('Nenhuma subtarefa gerada');
        }
        
        console.log(`📋 ${subtaskTitles.length} subtarefas parseadas:`, subtaskTitles);
        
        // Salvar todas as subtarefas
        const createdSubtasks = [];
        for (let i = 0; i < subtaskTitles.length; i++) {
            const title = subtaskTitles[i];
            const position = currentTaskSubtasks.length + i;
            
            const createResponse = await fetch(`${SUBTASKS_API_URL}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: currentTaskIdForSubtasks,
                    title: title,
                    position: position
                })
            });
            
            if (createResponse.ok) {
                const newSubtask = await createResponse.json();
                createdSubtasks.push(newSubtask);
            }
        }
        
        // Atualizar array local
        currentTaskSubtasks.push(...createdSubtasks);
        
        // Renderizar
        renderSubtasks(currentTaskSubtasks);
        updateSubtasksProgress();
        
        showNotification(`${createdSubtasks.length} subtarefas geradas com IA!`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao gerar subtarefas:', error);
        showNotification('Erro ao gerar subtarefas com IA', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
                Gerar com IA
            `;
        }
    }
}

// ===== PARSEAR SUBTAREFAS DA RESPOSTA DA IA =====
function parseSubtasksFromAI(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const subtasks = [];
    
    for (const line of lines) {
        // Remover numeração (1., 2., *, -, etc)
        let cleaned = line.trim()
            .replace(/^\d+[\.\)]\s*/, '')  // 1. ou 1)
            .replace(/^[\*\-\•]\s*/, '')    // * ou - ou •
            .trim();
        
        if (cleaned && cleaned.length > 3 && cleaned.length < 200) {
            subtasks.push(cleaned);
        }
    }
    
    return subtasks.slice(0, 8); // Máximo 8 subtarefas
}

// ===== UTILITY: ESCAPE HTML =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== EXPORTAR FUNÇÕES =====
window.loadSubtasks = loadSubtasks;
window.toggleSubtask = toggleSubtask;
window.showSubtaskInput = showSubtaskInput;
window.hideSubtaskInput = hideSubtaskInput;
window.handleSubtaskInputKeypress = handleSubtaskInputKeypress;
window.saveNewSubtask = saveNewSubtask;
window.editSubtask = editSubtask;
window.deleteSubtask = deleteSubtask;
window.generateSubtasksWithAI = generateSubtasksWithAI;

console.log('✅ subtasks.js carregado com proteção read-only');