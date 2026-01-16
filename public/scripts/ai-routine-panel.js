/* ========================================
   PAINEL DE IA - GERADOR DE ROTINAS COM GEMINI
   Arquivo: ai-routine-panel.js
   ======================================== */

(function() {
    'use strict';
    
    // API URL local
    const AI_PANEL_API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin;

    let isGeneratingAIRoutine = false;

// ===== ABRIR PAINEL DE IA =====
function openAIRoutinePanel() {
    console.log('🤖 Abrindo painel de IA');
    
    const panel = document.getElementById('aiRoutinePanel');
    const overlay = document.getElementById('aiRoutinePanelOverlay');
    
    if (!panel || !overlay) {
        console.error('❌ Elementos do painel não encontrados');
        return;
    }
    
    // Mostrar painel
    panel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focar no campo de descrição
    setTimeout(() => {
        const descInput = document.getElementById('aiRoutineDescription');
        if (descInput) descInput.focus();
    }, 300);
    
    console.log('✅ Painel de IA aberto');
}

// ===== FECHAR PAINEL DE IA =====
function closeAIRoutinePanel() {
    console.log('🚪 Fechando painel de IA');
    
    const panel = document.getElementById('aiRoutinePanel');
    const overlay = document.getElementById('aiRoutinePanelOverlay');
    
    if (!panel || !overlay) return;
    
    panel.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    
    // Limpar campos após fechar
    setTimeout(() => {
        document.getElementById('aiRoutineDescription').value = '';
        document.getElementById('aiStartTime').value = '08:00';
        document.getElementById('aiEndTime').value = '18:00';
        document.getElementById('aiRoutineResult').innerHTML = '';
        document.getElementById('aiRoutineResult').style.display = 'none';
    }, 300);
    
    console.log('✅ Painel de IA fechado');
}

// ===== GERAR ROTINA COM IA =====
async function generateAIRoutine() {
    if (isGeneratingAIRoutine) {
        console.log('⏳ Já está gerando uma rotina');
        return;
    }
    
    const description = document.getElementById('aiRoutineDescription').value.trim();
    const startTime = document.getElementById('aiStartTime').value;
    const endTime = document.getElementById('aiEndTime').value;
    const resultDiv = document.getElementById('aiRoutineResult');
    const generateBtn = document.querySelector('.btn-generate-routine');
    
    console.log('🤖 Iniciando geração de rotina');
    console.log('   Descrição:', description);
    console.log('   Horário:', startTime, 'às', endTime);
    
    // Validações
    if (!description) {
        showNotification('⚠️ Por favor, descreva como será seu dia');
        document.getElementById('aiRoutineDescription').focus();
        return;
    }
    
    if (!startTime || !endTime) {
        showNotification('⚠️ Defina o horário de início e fim');
        return;
    }
    
    try {
        isGeneratingAIRoutine = true;
        
        // Atualizar botão
        generateBtn.disabled = true;
        generateBtn.innerHTML = `
            <div class="generating-spinner"></div>
            Gerando rotina...
        `;
        
        // Mostrar loading
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div class="ai-loading">
                <div class="ai-loading-spinner"></div>
                <p>🤖 Analisando sua descrição e criando uma rotina personalizada...</p>
            </div>
        `;
        
        console.log('📤 Enviando requisição para API Gemini...');
        
        // Chamar API
        const response = await fetch(`${AI_PANEL_API_URL}/api/gerar-rotina`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                descricao: description,
                horaInicio: startTime,
                horaFim: endTime
            })
        });
        
        const result = await response.json();
        
        console.log('📥 Resposta recebida:', result.success);
        
        if (result.success) {
            console.log('✅ Rotina gerada com sucesso');
            
            // Mostrar resultado
            resultDiv.innerHTML = `
                <div class="ai-success">
                    <div class="ai-success-header">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <h4>Rotina criada com sucesso!</h4>
                    </div>
                    <div class="ai-routine-content">${formatRoutineHTML(result.rotina)}</div>
                    <div class="ai-actions">
                        <button class="btn-save-routine" onclick="saveRoutineAsTasks(\`${escapeForJS(result.rotina)}\`)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Salvar como tarefas
                        </button>
                        <button class="btn-new-routine" onclick="clearRoutineAndGenerate()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="1 4 1 10 7 10"></polyline>
                                <polyline points="23 20 23 14 17 14"></polyline>
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                            </svg>
                            Gerar outra
                        </button>
                    </div>
                </div>
            `;
            
            showNotification('✅ Rotina gerada com sucesso!');
        } else {
            console.error('❌ Erro ao gerar rotina:', result.error);
            
            resultDiv.innerHTML = `
                <div class="ai-error">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>Erro ao gerar rotina: ${result.error}</p>
                    <button class="btn-retry" onclick="generateAIRoutine()">Tentar novamente</button>
                </div>
            `;
            
            showNotification('❌ Erro ao gerar rotina');
        }
        
    } catch (error) {
        console.error('❌ Erro de conexão:', error);
        
        resultDiv.innerHTML = `
            <div class="ai-error">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>Erro de conexão com o servidor</p>
                <button class="btn-retry" onclick="generateAIRoutine()">Tentar novamente</button>
            </div>
        `;
        
        showNotification('❌ Erro de conexão');
    } finally {
        isGeneratingAIRoutine = false;
        
        // Restaurar botão
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            Gerar Rotina
        `;
    }
}

// ===== SALVAR ROTINA COMO TAREFAS =====
async function saveRoutineAsTasks(routineText) {
    console.log('💾 Salvando rotina como tarefas');
    
    const user = getCurrentUser();
    if (!user) {
        showNotification('❌ Usuário não identificado');
        return;
    }
    
    // Buscar seção "Tarefa" (caso exista)
    let targetSectionId = null;
    
    if (window.currentSections && window.currentSections.length > 0) {
        const tarefaSection = window.currentSections.find(s => 
            s.name.toLowerCase() === 'tarefa' || 
            s.name.toLowerCase() === 'tarefas'
        );
        
        if (tarefaSection) {
            targetSectionId = tarefaSection.id;
            console.log('✅ Seção "Tarefa" encontrada:', targetSectionId);
        } else {
            console.log('⚠️ Seção "Tarefa" não encontrada, salvando sem seção');
        }
    }
    
    // Extrair tarefas da rotina
    const lines = routineText.split('\n').filter(line => line.trim());
    const tasks = [];
    
    for (const line of lines) {
        // Detectar linhas com horário (ex: 🕗 08:00-09:00 → Atividade)
        if (line.includes('→') || line.match(/\d{1,2}:\d{2}/)) {
            let taskText = line.split('→')[1] || line;
            
            // Remover emojis e limpar
            taskText = taskText.replace(/[🔴🟡🟢🕗🕙🕛🕑🕓🕕📚💪☕🍽️📊🚀🎯⏰📅]/g, '').trim();
            
            // Extrair horário se houver
            const timeMatch = line.match(/(\d{1,2}:\d{2})/);
            const time = timeMatch ? timeMatch[1] : null;
            
            if (taskText && taskText.length > 2) {
                // Determinar prioridade baseada no conteúdo
                const priority = determinePriorityFromText(taskText);
                
                tasks.push({
                    title: taskText.substring(0, 100),
                    description: time ? `⏰ Horário: ${time}` : 'Criada pela IA',
                    priority: priority,
                    status: 'pending',
                    user_id: user.id,
                    list_id: window.currentListId || null,
                    section_id: targetSectionId
                });
                
                console.log(`📝 Tarefa extraída: "${taskText}" (${priority})`);
            }
        }
    }
    
    if (tasks.length === 0) {
        showNotification('⚠️ Nenhuma tarefa encontrada na rotina');
        return;
    }
    
    console.log(`📤 Salvando ${tasks.length} tarefas...`);
    
    // Mostrar loading
    const saveBtn = document.querySelector('.btn-save-routine');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="generating-spinner"></div> Salvando...';
    }
    
    let savedCount = 0;
    
    // Salvar cada tarefa
    for (const task of tasks) {
        try {
            const response = await fetch(`${AI_PANEL_API_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(task)
            });
            
            const result = await response.json();
            
            if (result.success) {
                savedCount++;
            } else {
                console.error('❌ Erro ao salvar tarefa:', result.error);
            }
        } catch (error) {
            console.error('❌ Erro de conexão:', error);
        }
    }
    
    console.log(`✅ ${savedCount}/${tasks.length} tarefas salvas`);
    
    if (savedCount > 0) {
        showNotification(`✅ ${savedCount} tarefa${savedCount > 1 ? 's' : ''} criada${savedCount > 1 ? 's' : ''}!`);
        
        // Recarregar tarefas
        if (typeof loadAndDisplayTasksFromDatabase === 'function') {
            await loadAndDisplayTasksFromDatabase();
        }
        
        // Atualizar contadores
        if (typeof updateSectionCounts === 'function') {
            updateSectionCounts();
        }
        
        // Fechar painel
        setTimeout(() => {
            closeAIRoutinePanel();
        }, 1000);
    } else {
        showNotification('❌ Erro ao salvar tarefas');
    }
    
    // Restaurar botão
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Salvar como tarefas
        `;
    }
}

// ===== DETERMINAR PRIORIDADE PELO TEXTO =====
function determinePriorityFromText(text) {
    const lowerText = text.toLowerCase();
    
    const highPriorityWords = [
        'urgente', 'importante', 'crítico', 'reunião', 'apresentação',
        'entrega', 'deadline', 'prazo', 'cliente', 'projeto'
    ];
    
    const lowPriorityWords = [
        'descanso', 'pausa', 'intervalo', 'café', 'lanche',
        'alongamento', 'relaxar', 'hobby', 'lazer'
    ];
    
    for (const word of highPriorityWords) {
        if (lowerText.includes(word)) return 'high';
    }
    
    for (const word of lowPriorityWords) {
        if (lowerText.includes(word)) return 'low';
    }
    
    return 'medium';
}

// ===== LIMPAR E GERAR NOVA ROTINA =====
function clearRoutineAndGenerate() {
    document.getElementById('aiRoutineDescription').value = '';
    document.getElementById('aiRoutineResult').innerHTML = '';
    document.getElementById('aiRoutineResult').style.display = 'none';
    document.getElementById('aiRoutineDescription').focus();
}

// ===== FORMATAR ROTINA PARA HTML =====
function formatRoutineHTML(routineText) {
    return routineText
        .split('\n')
        .filter(line => line.trim())
        .map(line => `<div class="routine-line">${escapeHtml(line)}</div>`)
        .join('');
}

// ===== ESCAPAR HTML =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== ESCAPAR PARA JAVASCRIPT =====
function escapeForJS(text) {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\n/g, '\\n');
}

// ===== FECHAR COM ESC =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const panel = document.getElementById('aiRoutinePanel');
        if (panel && panel.classList.contains('active')) {
            closeAIRoutinePanel();
        }
    }
});

// ===== EXPORTAR FUNÇÕES =====
window.openAIRoutinePanel = openAIRoutinePanel;
window.closeAIRoutinePanel = closeAIRoutinePanel;
window.generateAIRoutine = generateAIRoutine;
window.saveRoutineAsTasks = saveRoutineAsTasks;
window.clearRoutineAndGenerate = clearRoutineAndGenerate;

console.log('✅ ai-routine-panel.js carregado');

})(); // Fechamento da IIFE