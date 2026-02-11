/* ========================================
   SISTEMA DE TAREFAS COM BANCO DE DADOS - TELA PRINCIPAL
   Arquivo: localstorage.js ATUALIZADO
   Agora salva no SQLite via API
   ======================================== */

// ===== CONFIGURAÇÃO DA API =====
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// ===== VARIÁVEIS GLOBAIS =====
let tasks = [];

// ===== ESCONDER SPLASH SCREEN =====
// Executar imediatamente para garantir que funcione
(function hideSplashScreen() {
  const hide = () => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 500);
      }, 800);
    }
  };

  // Tentar esconder quando DOM estiver pronto ou imediatamente se já estiver
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hide);
  } else {
    hide();
  }

  // Fallback: esconder após 3 segundos de qualquer forma
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 500);
    }
  }, 3000);
})();

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
  loadTasksFromDatabase();
  initializeElements();
});

// ===== INICIALIZAR ELEMENTOS =====
function initializeElements() {
  const btnAdicionar = document.getElementById('btnAdicionar');
  const btnSalvar = document.getElementById('btnSalvar');
  const btnCancelar = document.getElementById('btnCancelar');
  //const blocoTarefas = document.getElementById('blocoTarefas');
  const textarea = document.getElementById('textareaTarefa');
  
  // Botão Adicionar - Mostra textarea
  if (btnAdicionar) {
    btnAdicionar.addEventListener('click', function() {
      blocoTarefas.classList.remove('escondido');
      blocoTarefas.classList.add('visivel');
      textarea.focus();
    });
  }
  
  // Botão Salvar - Cria tarefa no BANCO
  if (btnSalvar) {
    btnSalvar.addEventListener('click', async function() {
      const taskName = textarea.value.trim();
      
      if (taskName) {
        // Cria tarefa para salvar no BANCO
        const newTask = {
          name: taskName,
          responsible: 'Você',
          dueDate: new Date().toISOString().split('T')[0],
          priority: 'medium',
          status: 'pendente'
        };
        
        // ✅ SALVA NO BANCO (não no localStorage)
        const success = await saveTaskToDatabase(newTask);
        
        if (success) {
          // Limpa e esconde formulário
          textarea.value = '';
          blocoTarefas.classList.remove('visivel');
          blocoTarefas.classList.add('escondido');
          
          // Recarrega tarefas do banco
          await loadTasksFromDatabase();
          
          showNotification('✅ Tarefa salva no banco!');
        } else {
          showNotification('❌ Erro ao salvar tarefa');
        }
      } else {
        alert('Por favor, digite uma tarefa!');
      }
    });
  }
  
  // Botão Cancelar
  if (btnCancelar) {
    btnCancelar.addEventListener('click', function() {
      textarea.value = '';
      blocoTarefas.classList.remove('visivel');
      blocoTarefas.classList.add('escondido');
    });
  }
  
  // Enter para salvar
  if (textarea) {
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        btnSalvar.click();
      }
    });
  }
  
  // Menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', function() {
      navMenu.classList.toggle('show');
    });
  }
}

// ===== FUNÇÕES DE BANCO DE DADOS =====

// ✅ SALVAR TAREFA NO BANCO
async function saveTaskToDatabase(taskData) {
  try {
    const response = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    });
    
    const result = await response.json();
    return result.success;
    
  } catch (error) {
    console.error('❌ Erro ao salvar tarefa no banco:', error);
    return false;
  }
}

// ✅ CARREGAR TAREFAS DO BANCO
async function loadTasksFromDatabase() {
  try {
    const response = await fetch(`${API_URL}/api/tasks`);
    const data = await response.json();
    
    if (data.success) {
      tasks = data.tasks;
      renderSimpleTasks();
      console.log('✅ Tarefas carregadas do BANCO:', tasks.length);
    } else {
      console.error('❌ Erro ao carregar tarefas:', data.error);
      tasks = [];
    }
  } catch (error) {
    console.error('❌ Erro de conexão:', error);
    tasks = [];
  }
}

// ✅ ATUALIZAR TAREFA NO BANCO
async function updateTaskInDatabase(taskId, updates) {
  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    const result = await response.json();
    return result.success;
    
  } catch (error) {
    console.error('❌ Erro ao atualizar tarefa:', error);
    return false;
  }
}

// ✅ EXCLUIR TAREFA DO BANCO
async function deleteTaskFromDatabase(taskId) {
  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    return result.success;
    
  } catch (error) {
    console.error('❌ Erro ao excluir tarefa:', error);
    return false;
  }
}

// ===== RENDERIZAR TAREFAS =====
function renderSimpleTasks() {
  const listaTarefas = document.getElementById('listaTarefas');
  
  if (!listaTarefas) return;
  
  // Limpa lista
  listaTarefas.innerHTML = '';
  
  if (tasks.length === 0) {
    listaTarefas.innerHTML = '<p class="text-muted text-center">Nenhuma tarefa encontrada.</p>';
    return;
  }
  
  // Renderiza cada tarefa
  tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'list-group-item';
    item.setAttribute('data-task-id', task.id);
    
    // Ícone de status
    const statusIcon = task.status === 'concluido' ? '✅' : 
                       task.status === 'progresso' ? '🔄' : '⏳';
    
    item.innerHTML = `
      <span>${statusIcon} ${task.name}</span>
      <div class="btn-group">
        <button class="btn btn-sm btn-outline-success" onclick="completeSimpleTask(${task.id})">
          ✓
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteSimpleTask(${task.id})">
          🗑️
        </button>
      </div>
    `;
    
    listaTarefas.appendChild(item);
  });
}

// ===== COMPLETAR TAREFA (AGORA NO BANCO) =====
async function completeSimpleTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  // Alterna status
  const newStatus = task.status === 'concluido' ? 'pendente' : 'concluido';
  
  // ✅ ATUALIZA NO BANCO
  const success = await updateTaskInDatabase(taskId, { status: newStatus });
  
  if (success) {
    // Atualiza localmente
    task.status = newStatus;
    renderSimpleTasks();
    showNotification(newStatus === 'concluido' ? '✅ Tarefa concluída!' : '⏳ Tarefa reaberta!');
  } else {
    showNotification('❌ Erro ao atualizar tarefa');
  }
}

// ===== EXCLUIR TAREFA (AGORA NO BANCO) =====
async function deleteSimpleTask(taskId) {
  if (confirm('Deseja excluir esta tarefa?')) {
    // ✅ EXCLUI DO BANCO
    const success = await deleteTaskFromDatabase(taskId);
    
    if (success) {
      // Atualiza localmente
      tasks = tasks.filter(t => t.id !== taskId);
      renderSimpleTasks();
      showNotification('🗑️ Tarefa excluída!');
    } else {
      showNotification('❌ Erro ao excluir tarefa');
    }
  }
}

// ===== IMPORTAR TAREFAS DA ROTINA (CORRIGIDO) =====
async function importarParaTarefas() {
  try {
    const resultadoDiv = document.getElementById('resultadoRotina');
    const rotinaText = resultadoDiv.querySelector('pre').textContent;
    
    showNotification('🔄 Convertendo rotina em tarefas...');
    
    // Extrai atividades da rotina
    const atividades = extrairAtividadesDaRotina(rotinaText);
    
    // ✅ SALVA CADA TAREFA NO BANCO
    let tarefasCriadas = 0;
    
    for (const atividade of atividades) {
      if (atividade && atividade.trim().length > 2) {
        const novaTarefa = {
          name: atividade.trim(),
          responsible: 'Eu',
          dueDate: new Date().toISOString().split('T')[0],
          priority: determinarPrioridade(atividade),
          status: 'pendente'
        };
        
        // Salva no banco
        const success = await saveTaskToDatabase(novaTarefa);
        if (success) {
          tarefasCriadas++;
        }
      }
    }
    
    // Recarrega as tarefas do banco
    await loadTasksFromDatabase();
    
    showNotification(`✅ ${tarefasCriadas} tarefas salvas no banco!`);
    
    // Fecha o resultado da rotina
    setTimeout(() => {
      resultadoDiv.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('Erro ao importar tarefas:', error);
    showNotification('❌ Erro ao importar tarefas');
  }
}

// ===== FUNÇÕES AUXILIARES =====
function showNotification(message, type = 'info') {
    // Remover emojis da mensagem
    const cleanMessage = message.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2705}]|[\u{274C}]|[\u{26A0}]|[\u{2139}]/gu, '').trim();

    // Detectar tipo baseado na mensagem original
    if (message.includes('✅') || message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('salva') || message.toLowerCase().includes('concluída')) type = 'success';
    else if (message.includes('❌') || message.toLowerCase().includes('erro')) type = 'error';
    else if (message.includes('⚠️') || message.includes('🗑️') || message.toLowerCase().includes('excluída')) type = 'warning';

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

async function gerarRotinaInteligente() {
  const descricao = document.getElementById('descricaoRotina').value.trim();
  const horaInicio = document.getElementById('horaInicioRotina').value;
  const horaFim = document.getElementById('horaFimRotina').value;
  
  if (!descricao) {
    showNotification('⚠️ Descreva como será seu dia!');
    return;
  }
  
  try {
    showNotification('🧠 Analisando sua rotina...');
    
    const response = await fetch(`${API_URL}/api/gerar-rotina`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        descricao, 
        horaInicio, 
        horaFim 
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erro: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      exibirRotinaGerada(data);
    } else {
      throw new Error(data.error || 'Erro desconhecido');
    }
    
  } catch (error) {
    console.error('Erro:', error);
    showNotification('❌ Erro ao gerar rotina: ' + error.message);
  }
}

function exibirRotinaGerada(data) {
  const resultadoDiv = document.getElementById('resultadoRotina');
  
  // Pré-processa a rotina para extrair atividades
  const atividades = extrairAtividadesDaRotina(data.rotina);
  const totalAtividades = atividades.length;
  
  resultadoDiv.innerHTML = `
    <div class="rotina-gerada">
      <div class="rotina-header">
        <h4>📅 Sua Rotina Inteligente</h4>
        <span class="badge">${totalAtividades} atividades</span>
      </div>
      <div class="rotina-content">
        <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 1rem; border-radius: 8px; border-left: 4px solid #49a09d; font-size: 0.9rem; line-height: 1.4;">${data.rotina}</pre>
      </div>
      
      <!-- Preview das tarefas que serão criadas -->
      <div class="tarefas-preview" style="margin-top: 1rem; padding: 1rem; background: #fff; border-radius: 8px; border: 1px solid #e9ecef;">
        <h6 style="margin: 0 0 0.5rem 0; color: #495057;">📋 Tarefas que serão criadas:</h6>
        <div style="font-size: 0.8rem; color: #6c757d; max-height: 120px; overflow-y: auto;">
          ${atividades.map((atividade, index) => 
            `<div style="padding: 0.25rem 0; border-bottom: 1px solid #f8f9fa;">
              ${index + 1}. ${atividade}
            </div>`
          ).join('')}
        </div>
      </div>
      
      <div class="rotina-actions mt-3" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-success btn-sm" onclick="importarParaTarefas()" style="flex: 1;">
          ✅ Importar ${totalAtividades} Tarefas
        </button>
        <button class="btn btn-outline-secondary btn-sm" onclick="limparRotina()">
          🔄 Nova Rotina
        </button>
      </div>
    </div>
  `;
  
  resultadoDiv.style.display = 'block';
  showNotification(`✅ Rotina gerada com ${totalAtividades} atividades!`);
}

function limparRotina() {
  document.getElementById('descricaoRotina').value = '';
  document.getElementById('resultadoRotina').style.display = 'none';
  document.getElementById('resultadoRotina').innerHTML = '';
}

function extrairAtividadesDaRotina(rotinaText) {
  const linhas = rotinaText.split('\n').filter(linha => linha.trim());
  const atividades = [];
  
  linhas.forEach(linha => {
    if (linha.includes('→') || linha.match(/→\s*[🔴🟡🟢📚💪☕🍽️📊🚀🎯⛪🙏📱💼💊]/)) {
      const partes = linha.split('→');
      if (partes.length > 1) {
        let atividade = partes[1].trim();
        atividade = atividade.replace(/[🔴🟡🟢🕗🕙🕛🕑🕓🕕📚💪☕🍽️📊🚀🎯⛪🙏📱💼💊🏠🚗]/g, '').trim();
        atividade = atividade.replace(/\d{1,2}:\d{2}-\d{1,2}:\d{2}/g, '').trim();
        atividade = atividade.replace(/^[-•→]\s*/, '').trim();
        
        if (atividade && atividade.length > 2 && !atividade.match(/^\d/)) {
          atividades.push(atividade);
        }
      }
    } else if (linha.trim() && !linha.match(/🕗|🕙|🕛|🕑|🕓|🕕/) && linha.length > 10) {
      let atividade = linha.trim();
      atividade = atividade.replace(/[🔴🟡🟢🕗🕙🕛🕑🕓🕕]/g, '').trim();
      atividade = atividade.replace(/\d{1,2}:\d{2}-\d{1,2}:\d{2}/g, '').trim();
      
      if (atividade && atividade.length > 5) {
        atividades.push(atividade);
      }
    }
  });
  
  return atividades;
}

function determinarPrioridade(atividade) {
  const atividadeLower = atividade.toLowerCase();
  
  if (atividadeLower.includes('urgente') || 
      atividadeLower.includes('importante') || 
      atividadeLower.includes('reunião') ||
      atividadeLower.includes('trabalho') ||
      atividadeLower.includes('deadline')) {
    return 'high';
  } else if (atividadeLower.includes('estud') ||
             atividadeLower.includes('projeto') ||
             atividadeLower.includes('exercício')) {
    return 'medium';
  } else {
    return 'low';
  }
}

// ===== TORNA FUNÇÕES GLOBAIS =====
window.completeSimpleTask = completeSimpleTask;
window.deleteSimpleTask = deleteSimpleTask;
window.importarParaTarefas = importarParaTarefas;
window.gerarRotinaInteligente = gerarRotinaInteligente;
window.limparRotina = limparRotina;