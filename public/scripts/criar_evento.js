/* ========================================
   SISTEMA DE GERENCIAMENTO DE TAREFAS - COM BANCO DE DADOS
   Arquivo: criar_evento.js ATUALIZADO E CORRIGIDO
   Agora salva no SQLite via API com user_id
   ======================================== */

// ===== VARIÁVEIS GLOBAIS =====
let tasks = [];
let currentEditingTask = null;
let currentUser = null;
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// ===== OBTER USUÁRIO LOGADO =====
async function getCurrentUser() {
  try {
    const response = await fetch(`${API_URL}/api/usuario-logado`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.usuario;
    }
    return null;
  } catch (error) {
    console.error('❌ Erro ao verificar autenticação:', error);
    return null;
  }
}

// ===== CARREGAR TAREFAS DO BANCO =====
async function loadTasksFromDatabase() {
  if (!currentUser) {
    console.error('❌ Nenhum usuário logado!');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/tasks?user_id=${currentUser.id}`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      tasks = data.tasks;
      renderAllTasks();
      updateTaskCounts();
      console.log(`✅ ${tasks.length} tarefas carregadas do usuário: ${currentUser.nome}`);
    } else {
      console.error('❌ Erro ao carregar tarefas:', data.error);
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error);
  }
}

// ===== SALVAR TAREFA NO BANCO =====
async function saveTaskToDatabase(taskData) {
  if (!currentUser) {
    console.error('❌ Nenhum usuário logado!');
    return null;
  }
  
  try {
    const dataToSend = {
      title: taskData.title || taskData.name,
      description: taskData.description || '',
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      user_id: currentUser.id
    };
    
    console.log('📤 Enviando para API:', dataToSend);
    console.log('👤 Usuário:', currentUser.nome);
    
    const response = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(dataToSend)
    });
    
    const result = await response.json();
    console.log('📥 Resposta da API:', result);
    
    return result.success ? result.taskId : null;
    
  } catch (error) {
    console.error('❌ Erro ao salvar tarefa no banco:', error);
    return null;
  }
}

// ===== ATUALIZAR TAREFA NO BANCO =====
async function updateTaskInDatabase(taskId, updates) {
  if (!currentUser) {
    console.error('❌ Nenhum usuário logado!');
    return false;
  }
  
  try {
    const dataToSend = {
      ...updates,
      user_id: currentUser.id
    };
    
    console.log(`📝 Atualizando tarefa ${taskId} do usuário: ${currentUser.nome}`);
    
    const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(dataToSend)
    });
    
    const result = await response.json();
    return result.success;
    
  } catch (error) {
    console.error('❌ Erro ao atualizar tarefa:', error);
    return false;
  }
}

// ===== EXCLUIR TAREFA DO BANCO =====
async function deleteTaskFromDatabase(taskId) {
  if (!currentUser) {
    console.error('❌ Nenhum usuário logado!');
    return false;
  }
  
  try {
    console.log(`🗑️ Excluindo tarefa ${taskId} do usuário: ${currentUser.nome}`);
    
    const response = await fetch(`${API_URL}/api/tasks/${taskId}?user_id=${currentUser.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const result = await response.json();
    return result.success;
    
  } catch (error) {
    console.error('❌ Erro ao excluir tarefa:', error);
    return false;
  }
}

// ===== RENDERIZAR TODAS AS TAREFAS =====
function renderAllTasks() {
  document.querySelectorAll('.task-row').forEach(row => row.remove());
  tasks.forEach(task => {
    renderTask(task);
  });
}

// ===== RENDERIZAR TAREFA =====
function renderTask(task) {
  const statusMap = {
    'pending': 'pendente',
    'in_progress': 'progresso',
    'completed': 'concluido',
    'pendente': 'pendente',
    'progresso': 'progresso',
    'concluido': 'concluido'
  };
  
  const mappedStatus = statusMap[task.status] || 'pendente';
  
  const taskGroup = document.querySelector(`.task-group[data-status="${mappedStatus}"]`);
  if (!taskGroup) {
    console.error('❌ Grupo não encontrado para status:', mappedStatus);
    return;
  }
  
  const taskTable = taskGroup.querySelector('.task-table');
  const addTaskBtn = taskTable.querySelector('.add-task');
  
  const taskRow = document.createElement('div');
  taskRow.className = 'task-row';
  taskRow.setAttribute('data-task-id', task.id);
  
  const dateObj = new Date(task.dueDate + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('pt-BR');
  
  const priorityClass = `priority-${task.priority}`;
  const priorityText = {
    'high': 'Alta',
    'medium': 'Média',
    'low': 'Baixa'
  }[task.priority];
  
  const statusClass = mappedStatus === 'progresso' ? 'progress' : mappedStatus === 'pendente' ? 'pending' : 'completed';
  const statusText = {
    'progresso': 'Em Progresso',
    'pendente': 'Pendente',
    'concluido': 'Concluído'
  }[mappedStatus];
  
  const responsible = task.responsible || 'Sem responsável';
  const avatarLetter = responsible.charAt(0).toUpperCase();
  
  const taskName = task.title || task.name || 'Sem título';
  
  taskRow.innerHTML = `
    <div class="task-checkbox ${mappedStatus === 'concluido' ? 'checked' : ''}" onclick="toggleTaskComplete(${task.id})"></div>
    <div class="task-name">${taskName}</div>
    <div class="task-assignee">
      <div class="avatar">${avatarLetter}</div>
      <span>${responsible}</span>
    </div>
    <div class="task-date">
      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      ${formattedDate}
    </div>
    <div>
      <span class="priority-badge ${priorityClass}">${priorityText}</span>
    </div>
    <div>
      <span class="status-badge ${statusClass}">${statusText}</span>
    </div>
    <div>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteTask(${task.id})">
        🗑️ Excluir
      </button>
    </div>
  `;
  
  taskTable.insertBefore(taskRow, addTaskBtn);
}

// ===== ATUALIZAR CONTADORES =====
function updateTaskCounts() {
  const statusMapping = {
    'pending': 'pendente',
    'in_progress': 'progresso',
    'completed': 'concluido',
    'pendente': 'pendente',
    'progresso': 'progresso',
    'concluido': 'concluido'
  };
  
  const statuses = ['pendente', 'progresso', 'concluido'];
  
  statuses.forEach(status => {
    const count = tasks.filter(t => {
      const mappedStatus = statusMapping[t.status] || t.status;
      return mappedStatus === status;
    }).length;
    
    const group = document.querySelector(`.task-group[data-status="${status}"]`);
    if (group) {
      const countElement = group.querySelector('.group-count');
      if (countElement) {
        countElement.textContent = count;
      }
    }
  });
}

// ===== ALTERNAR CONCLUSÃO =====
async function toggleTaskComplete(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  const statusMap = {
    'completed': 'pending',
    'concluido': 'pending',
    'pending': 'completed',
    'pendente': 'completed',
    'in_progress': 'completed',
    'progresso': 'completed'
  };
  
  const newStatus = statusMap[task.status] || 'pending';
  
  const success = await updateTaskInDatabase(taskId, { status: newStatus });
  
  if (success) {
    task.status = newStatus;
    
    const taskRow = document.querySelector(`.task-row[data-task-id="${taskId}"]`);
    if (taskRow) {
      taskRow.remove();
    }
    
    renderTask(task);
    updateTaskCounts();
    showNotification(newStatus === 'completed' ? '✅ Tarefa concluída!' : '⏳ Tarefa reaberta!');
  } else {
    showNotification('❌ Erro ao atualizar tarefa');
  }
}

// ===== EXCLUIR TAREFA =====
async function deleteTask(taskId) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
  
  const success = await deleteTaskFromDatabase(taskId);
  
  if (success) {
    tasks = tasks.filter(t => t.id !== taskId);
    const taskRow = document.querySelector(`.task-row[data-task-id="${taskId}"]`);
    if (taskRow) {
      taskRow.remove();
    }
    updateTaskCounts();
    showNotification('🗑️ Tarefa excluída!');
  } else {
    showNotification('❌ Erro ao excluir tarefa');
  }
}

// ===== LIMPAR TODAS AS TAREFAS =====
async function clearAllTasks() {
  if (!currentUser) {
    console.error('❌ Nenhum usuário logado!');
    return;
  }
  
  if (!confirm('⚠️ Deseja realmente excluir TODAS as suas tarefas? Esta ação não pode ser desfeita!')) return;
  
  try {
    console.log(`🗑️ Excluindo todas as tarefas do usuário: ${currentUser.nome}`);
    
    for (const task of tasks) {
      await deleteTaskFromDatabase(task.id);
    }
    
    tasks = [];
    renderAllTasks();
    updateTaskCounts();
    
    showNotification('🗑️ Todas as suas tarefas foram excluídas!');
    
  } catch (error) {
    console.error('❌ Erro ao limpar tarefas:', error);
    showNotification('❌ Erro ao excluir tarefas');
  }
}

// ===== INICIALIZAÇÃO =====
function initializeEventListeners() {
  const btnAdicionar = document.getElementById('btnAdicionar');
  if (btnAdicionar) {
    btnAdicionar.addEventListener('click', showAddOptions);
  }
}

function initializeGroupToggles() {
  const groupHeaders = document.querySelectorAll('.group-header');
  
  groupHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const taskTable = this.nextElementSibling;
      const toggle = this.querySelector('.group-toggle');
      
      if (taskTable.style.display === 'none') {
        taskTable.style.display = 'block';
        toggle.textContent = '▼';
      } else {
        taskTable.style.display = 'none';
        toggle.textContent = '▶';
      }
    });
  });
}

function initializeMenuToggle() {
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', function() {
      navMenu.classList.toggle('show');
    });
  }
}

// ===== MODAL DE OPÇÕES DE CRIAÇÃO =====
function showAddOptions() {
  const modal = createModal({
    title: '➕ Criar Nova Tarefa',
    content: `
      <div style="text-align: center; padding: 1rem;">
        <p style="margin-bottom: 1.5rem; color: var(--gray);">Como deseja criar sua tarefa?</p>
        <div style="display: grid; gap: 0.75rem;">
          <button class="btn btn-primary" onclick="closeModal(); addNewTask();" style="justify-content: center;">
            📝 Criar Manualmente
          </button>
          <button class="btn btn-outline-primary" onclick="closeModal(); showAIModal();" style="justify-content: center;">
            🤖 Assistente IA
          </button>
        </div>
      </div>
    `,
    buttons: [
      {
        text: 'Cancelar',
        class: 'btn-secondary',
        onClick: () => closeModal()
      }
    ]
  });
}

// ===== CRIAR NOVA TAREFA =====
function addNewTask() {
  currentEditingTask = null;
  showNameModal();
}

// ===== MODAIS DE CRIAÇÃO =====
function showNameModal() {
  const modal = createModal({
    title: '📝 Nome da Tarefa',
    content: `
      <input 
        type="text" 
        id="taskNameInput" 
        class="modal-input" 
        placeholder="Digite o nome da tarefa..."
        maxlength="100"
      />
    `,
    buttons: [
      {
        text: 'Próximo',
        class: 'btn-primary',
        onClick: () => {
          const name = document.getElementById('taskNameInput').value.trim();
          if (name) {
            currentEditingTask = { name: name };
            closeModal();
            showResponsibleModal();
          } else {
            alert('Por favor, digite um nome para a tarefa!');
          }
        }
      },
      {
        text: 'Cancelar',
        class: 'btn-secondary',
        onClick: () => {
          closeModal();
          currentEditingTask = null;
        }
      }
    ]
  });
  
  setTimeout(() => {
    const input = document.getElementById('taskNameInput');
    if (input) input.focus();
  }, 100);
}

function showResponsibleModal() {
  const modal = createModal({
    title: '👤 Responsável',
    content: `
      <input 
        type="text" 
        id="taskResponsibleInput" 
        class="modal-input" 
        placeholder="Digite o nome do responsável..."
        maxlength="50"
        value="${currentEditingTask.responsible || 'Eu'}"
      />
    `,
    buttons: [
      {
        text: 'Próximo',
        class: 'btn-primary',
        onClick: () => {
          const responsible = document.getElementById('taskResponsibleInput').value.trim();
          if (responsible) {
            currentEditingTask.responsible = responsible;
            closeModal();
            showDateModal();
          } else {
            alert('Por favor, digite o nome do responsável!');
          }
        }
      },
      {
        text: 'Voltar',
        class: 'btn-secondary',
        onClick: () => {
          closeModal();
          showNameModal();
        }
      }
    ]
  });
  
  setTimeout(() => {
    const input = document.getElementById('taskResponsibleInput');
    if (input) input.focus();
  }, 100);
}

function showDateModal() {
  const today = new Date().toISOString().split('T')[0];
  
  const modal = createModal({
    title: '📅 Data de Vencimento',
    content: `
      <input 
        type="date" 
        id="taskDateInput" 
        class="modal-input" 
        min="${today}"
        value="${currentEditingTask.dueDate || today}"
      />
      <p style="font-size: 0.9rem; color: var(--gray); margin-top: 0.5rem;">
        📌 Data selecionada: <span id="selectedDateDisplay">${formatDate(currentEditingTask.dueDate || today)}</span>
      </p>
    `,
    buttons: [
      {
        text: 'Próximo',
        class: 'btn-primary',
        onClick: () => {
          handleDateConfirm();
        }
      },
      {
        text: 'Voltar',
        class: 'btn-secondary',
        onClick: () => {
          closeModal();
          showResponsibleModal();
        }
      }
    ]
  });
  
  setTimeout(() => {
    const input = document.getElementById('taskDateInput');
    const display = document.getElementById('selectedDateDisplay');
    
    if (input && display) {
      input.addEventListener('change', function() {
        display.textContent = formatDate(this.value);
      });
    }
  }, 100);
}

function handleDateConfirm() {
  const dateInput = document.getElementById('taskDateInput');
  
  if (!dateInput) {
    alert('Erro ao carregar o campo de data. Tente novamente!');
    return;
  }
  
  const date = dateInput.value;
  
  if (!date || date === '') {
    alert('Por favor, escolha uma data!');
    return;
  }
  
  currentEditingTask.dueDate = date;
  closeModal();
  showPriorityModal();
}

function formatDate(dateString) {
  if (!dateString) return 'Não selecionada';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

function showPriorityModal() {
  const modal = createModal({
    title: '⚡ Prioridade',
    content: `
      <div class="priority-options">
        <button class="priority-option priority-high" data-priority="high">
          🔴 Alta
        </button>
        <button class="priority-option priority-medium" data-priority="medium">
          🟡 Média
        </button>
        <button class="priority-option priority-low" data-priority="low">
          🟢 Baixa
        </button>
      </div>
    `,
    buttons: [
      {
        text: 'Voltar',
        class: 'btn-secondary',
        onClick: () => {
          closeModal();
          showDateModal();
        }
      }
    ]
  });
  
  const priorityOptions = document.querySelectorAll('.priority-option');
  priorityOptions.forEach(option => {
    option.addEventListener('click', function() {
      const priority = this.getAttribute('data-priority');
      currentEditingTask.priority = priority;
      closeModal();
      showStatusModal();
    });
  });
}

function showStatusModal() {
  const modal = createModal({
    title: '📊 Status da Tarefa',
    content: `
      <div class="status-options">
        <button class="status-option status-progress" data-status="in_progress">
          🔄 Em Progresso
        </button>
        <button class="status-option status-pending" data-status="pending">
          ⏳ Pendente
        </button>
        <button class="status-option status-completed" data-status="completed">
          ✅ Concluído
        </button>
      </div>
    `,
    buttons: [
      {
        text: 'Voltar',
        class: 'btn-secondary',
        onClick: () => {
          closeModal();
          showPriorityModal();
        }
      }
    ]
  });
  
  const statusOptions = document.querySelectorAll('.status-option');
  statusOptions.forEach(option => {
    option.addEventListener('click', function() {
      const status = this.getAttribute('data-status');
      currentEditingTask.status = status;
      closeModal();
      saveTask();
    });
  });
}

// ===== SALVAR TAREFA =====
async function saveTask() {
  if (!currentUser) {
    console.error('❌ Nenhum usuário logado!');
    showNotification('❌ Você precisa estar logado');
    return;
  }

  try {
    // Verificar se deve gerar descrição automática
    let description = currentEditingTask.description || '';

    // Se não há descrição e a IA está habilitada, gerar automaticamente
    if (!description && window.aiSettings) {
      const aiConfig = window.aiSettings.get();

      if (aiConfig.descriptionsEnabled) {
        showNotification('🤖 Gerando descrição com IA...');

        const aiDescription = await window.aiSettings.generateDescription(currentEditingTask.name);

        if (aiDescription) {
          description = aiDescription;
          currentEditingTask.description = aiDescription;
          showNotification('✅ Descrição gerada pela IA!');
        }
      }
    }

    const taskToSave = {
      title: currentEditingTask.name,
      description: description,
      user_id: currentUser.id,
      status: currentEditingTask.status,
      priority: currentEditingTask.priority,
      dueDate: currentEditingTask.dueDate
    };

    console.log('💾 Salvando tarefa:', taskToSave);
    console.log('👤 Usuário:', currentUser.nome);

    const taskId = await saveTaskToDatabase(taskToSave);

    if (taskId) {
      currentEditingTask.id = taskId;
      currentEditingTask.title = currentEditingTask.name;
      tasks.push(currentEditingTask);

      renderTask(currentEditingTask);
      updateTaskCounts();

      showNotification('✅ Tarefa salva no banco!');
    } else {
      showNotification('❌ Erro ao salvar tarefa');
    }

    currentEditingTask = null;

  } catch (error) {
    console.error('❌ Erro ao salvar tarefa:', error);
    showNotification('❌ Erro ao salvar tarefa');
  }
}

// ===== MODAL DE IA =====
function showAIModal() {
  const modal = createModal({
    title: '🤖 Assistente IA - Criar Rotina',
    content: `
      <div style="margin-bottom: 1rem;">
        <label for="aiDescription" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
          Descreva seu dia:
        </label>
        <textarea 
          id="aiDescription" 
          class="modal-input" 
          placeholder="Ex: Preciso estudar para prova de matemática, fazer exercícios físicos, almoçar, revisar conteúdo da faculdade e terminar projeto do trabalho..."
          rows="4"
          style="width: 100%; resize: vertical;"
        ></textarea>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.8rem; color: var(--gray);">Início</label>
          <input type="time" id="aiStartTime" class="modal-input" value="08:00">
        </div>
        <div>
          <label style="font-size: 0.8rem; color: var(--gray);">Fim</label>
          <input type="time" id="aiEndTime" class="modal-input" value="18:00">
        </div>
      </div>
      <div id="aiLoading" style="display: none; text-align: center; padding: 1rem;">
        <div style="color: var(--primary);">🧠 Gerando sua rotina inteligente...</div>
        <div style="font-size: 0.8rem; color: var(--gray); margin-top: 0.5rem;">Isso pode levar alguns segundos</div>
      </div>
      <div id="aiResult" style="display: none;"></div>
    `,
    buttons: [
      {
        text: '✨ Gerar Rotina',
        class: 'btn-primary',
        onClick: () => generateRoutineFromAI()
      },
      {
        text: 'Cancelar',
        class: 'btn-secondary',
        onClick: () => closeModal()
      }
    ]
  });
}

async function generateRoutineFromAI() {
  const description = document.getElementById('aiDescription').value.trim();
  const startTime = document.getElementById('aiStartTime').value;
  const endTime = document.getElementById('aiEndTime').value;
  
  if (!description) {
    alert('Por favor, descreva como será seu dia!');
    return;
  }
  
  const loadingElement = document.getElementById('aiLoading');
  const resultElement = document.getElementById('aiResult');
  const generateBtn = document.querySelector('.modal-buttons .btn-primary');
  
  loadingElement.style.display = 'block';
  generateBtn.disabled = true;
  generateBtn.textContent = 'Gerando...';
  
  try {
    const response = await fetch(`${API_URL}/api/gerar-rotina`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        descricao: description,
        horaInicio: startTime,
        horaFim: endTime
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.rotina) {
      loadingElement.style.display = 'none';
      resultElement.style.display = 'block';
      resultElement.innerHTML = `
        <div style="background: var(--light-bg); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--primary);">📅 Sua Rotina Gerada:</h4>
          <div style="white-space: pre-line; font-size: 0.9rem; line-height: 1.4;">${data.rotina}</div>
        </div>
        <button class="btn btn-success" onclick="importRoutineAsTasks(\`${data.rotina.replace(/`/g, '\\`')}\`)" style="width: 100%;">
          ✅ Importar como Tarefas
        </button>
      `;
      
      generateBtn.style.display = 'none';
    } else {
      throw new Error(data.error || 'Erro desconhecido da IA');
    }
    
  } catch (error) {
    console.error('❌ Erro ao gerar rotina:', error);
    loadingElement.style.display = 'none';
    resultElement.style.display = 'block';
    resultElement.innerHTML = `
      <div style="color: var(--danger); text-align: center; padding: 1rem;">
        ❌ Erro ao conectar com o assistente IA<br>
        <small>Verifique se o servidor está rodando</small>
      </div>
    `;
    generateBtn.disabled = false;
    generateBtn.textContent = '✨ Gerar Rotina';
  }
}

async function importRoutineAsTasks(rotinaText) {
  try {
    const lines = rotinaText.split('\n').filter(line => line.trim());
    let tasksCreated = 0;
    
    for (const line of lines) {
      if (line.includes('→') || line.match(/\d{1,2}:\d{2}/)) {
        let activityName = line.split('→')[1] || line;
        activityName = activityName.trim();
        activityName = activityName.replace(/[🔴🟡🟢🕗🕙🕛🕑🕓🕕📚💪☕🍽️📊🚀🎯]/g, '').trim();
        
        if (activityName && activityName.length > 2) {
          const newTask = {
            title: activityName,
            description: 'Importado da rotina IA',
            responsible: 'Eu',
            dueDate: new Date().toISOString().split('T')[0],
            priority: 'medium',
            status: 'pending'
          };
          
          const taskId = await saveTaskToDatabase(newTask);
          if (taskId) {
            tasksCreated++;
          }
        }
      }
    }
    
    await loadTasksFromDatabase();
    updateTaskCounts();
    closeModal();
    
    showNotification(`✅ ${tasksCreated} tarefas salvas no banco!`);
    
  } catch (error) {
    console.error('❌ Erro ao importar rotina:', error);
    showNotification('❌ Erro ao importar rotina');
  }
}

// ===== SISTEMA DE MODAIS =====
function createModal({ title, content, buttons }) {
  const existingModal = document.getElementById('dynamicModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'dynamicModal';
  modal.className = 'modal';
  
  const buttonsHTML = buttons.map((btn, index) => 
    `<button class="btn ${btn.class}" data-btn-index="${index}">${btn.text}</button>`
  ).join('');
  
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${title}</h3>
      ${content}
      <div class="modal-buttons">
        ${buttonsHTML}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  buttons.forEach((btn, index) => {
    const btnElement = modal.querySelector(`[data-btn-index="${index}"]`);
    if (btnElement) {
      btnElement.addEventListener('click', btn.onClick);
    }
  });
  
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
      currentEditingTask = null;
    }
  });
  
  return modal;
}

function closeModal() {
  const modal = document.getElementById('dynamicModal');
  if (modal) {
    modal.remove();
  }
}

// ===== NOTIFICAÇÕES =====
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ===== PLACEHOLDERS =====
function addNewStatus() {
  alert('Funcionalidade em desenvolvimento!');
}

function toggleView() {
  alert('Visualizações alternativas em desenvolvimento!');
}

// ===== INICIALIZAÇÃO DO SISTEMA (ÚLTIMA) =====
document.addEventListener('DOMContentLoaded', async function() {
  // ✅ PRIMEIRO: Verifica autenticação
  currentUser = await getCurrentUser();
  
  if (!currentUser) {
    console.warn('⚠️ Usuário não autenticado! Redirecionando...');
    window.location.href = '/login.html';
    return;
  }
  
  console.log('👤 Usuário logado:', currentUser.nome);
  
  // Carrega tarefas do usuário
  await loadTasksFromDatabase();
  initializeEventListeners();
  initializeGroupToggles();
  initializeMenuToggle();
});

window.toggleTaskComplete = toggleTaskComplete;
window.deleteTask = deleteTask;
window.showAIModal = showAIModal;
window.generateRoutineFromAI = generateRoutineFromAI;
window.importRoutineAsTasks = importRoutineAsTasks;
window.clearAllTasks = clearAllTasks;