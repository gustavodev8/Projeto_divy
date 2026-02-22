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
// console.log('🤖 Abrindo painel de IA');

    // Verificar se o plano permite IA
    if (window.PlanService && typeof window.PlanService.getMyPlan === 'function') {
        window.PlanService.getMyPlan().then(planData => {
            if (planData && planData.plan && planData.plan.id === 'normal') {
                window.PlanService.showUpgradeModal(
                    'O Assistente IA está disponível nos planos Pro e ProMax.',
                    'normal',
                    'pro',
                    'ai'
                );
            }
        });
        // Checar cache sincronamente para bloquear abertura
        const cachedPlan = window.PlanService._cachedPlanId;
        if (cachedPlan === 'normal') return;
    }

    const panel = document.getElementById('aiRoutinePanel');
    const overlay = document.getElementById('aiRoutinePanelOverlay');

    if (!panel || !overlay) {
// console.error('❌ Elementos do painel não encontrados');
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
    
// console.log('✅ Painel de IA aberto');
}

// ===== FECHAR PAINEL DE IA =====
function closeAIRoutinePanel() {
// console.log('🚪 Fechando painel de IA');
    
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
    
// console.log('✅ Painel de IA fechado');
}

// ===== GERAR ROTINA COM IA =====
async function generateAIRoutine() {
    if (isGeneratingAIRoutine) {
// console.log('⏳ Já está gerando uma rotina');
        return;
    }
    
    const description = document.getElementById('aiRoutineDescription').value.trim();
    const startTime = document.getElementById('aiStartTime').value;
    const endTime = document.getElementById('aiEndTime').value;
    const resultDiv = document.getElementById('aiRoutineResult');
    const generateBtn = document.querySelector('.btn-generate-routine');
    
// console.log('🤖 Iniciando geração de rotina');
// console.log('   Descrição:', description);
// console.log('   Horário:', startTime, 'às', endTime);
    
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
        
// console.log('📤 Enviando requisição para API Gemini...');

        // Obter user_id para verificação de plano
        const userData = JSON.parse(localStorage.getItem('nura_user') || '{}');
        const userId = userData.id;

        // Chamar API
        const response = await fetch(`${AI_PANEL_API_URL}/api/gerar-rotina`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                descricao: description,
                horaInicio: startTime,
                horaFim: endTime,
                user_id: userId
            })
        });
        
        const result = await response.json();
        
// console.log('📥 Resposta recebida:', result.success);
        
        if (result.success) {
// console.log('✅ Rotina gerada com sucesso');

            // Armazenar o nome da seção gerado pela IA
            window.aiRoutineSectionName = result.nomeSecao || 'Rotina do Dia';
// console.log('📁 Nome da seção:', window.aiRoutineSectionName);

            // Mostrar resultado com nome da seção
            resultDiv.innerHTML = `
                <div class="ai-success">
                    <div class="ai-success-header">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <h4>Rotina criada com sucesso!</h4>
                    </div>
                    <div class="rotina-section-name">
                        <span class="rotina-section-label">📁 Seção:</span>
                        <span class="rotina-section-value">${window.aiRoutineSectionName}</span>
                    </div>
                    <div class="ai-routine-content">${formatRoutineHTML(result.rotina)}</div>
                    <div class="ai-actions">
                        <button class="btn-save-routine" onclick="saveRoutineAsTasks(\`${escapeForJS(result.rotina)}\`)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Salvar na seção "${window.aiRoutineSectionName}"
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
// console.error('❌ Erro ao gerar rotina:', result.error);

            // ===== VERIFICAR SE É ERRO DE LIMITE DE PLANO =====
            if (result.code === 'AI_NOT_AVAILABLE' || result.code === 'AI_LIMIT_REACHED') {
                if (window.PlanService && typeof window.PlanService.handlePlanLimitError === 'function') {
                    window.PlanService.handlePlanLimitError(result);
                    resultDiv.innerHTML = `
                        <div class="ai-error">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <p>${result.error}</p>
                        </div>
                    `;
                    return;
                }
            }

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
// console.error('❌ Erro de conexão:', error);
        
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

// Flag para evitar cliques múltiplos
let isSavingAIRoutine = false;

// ===== SALVAR ROTINA COMO TAREFAS =====
async function saveRoutineAsTasks(routineText) {
    // ✅ PROTEÇÃO CONTRA CLIQUES MÚLTIPLOS
    if (isSavingAIRoutine) {
// console.log('⚠️ Salvamento de rotina já em andamento');
        return;
    }
    isSavingAIRoutine = true;

// console.log('💾 Salvando rotina como tarefas');

    const user = getCurrentUser();
    if (!user) {
        showNotification('❌ Usuário não identificado');
        isSavingAIRoutine = false;
        return;
    }

    // Verificar se está em uma lista
    if (!window.currentListId) {
        showNotification('⚠️ Selecione uma lista para salvar a rotina');
        isSavingAIRoutine = false;
        return;
    }

    // Mostrar loading
    const saveBtn = document.querySelector('.btn-save-routine');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="generating-spinner"></div> Criando seção...';
    }

    // ===== CRIAR SEÇÃO AUTOMATICAMENTE =====
    const sectionName = window.aiRoutineSectionName || 'Rotina do Dia';
    let targetSectionId = null;

// console.log('📁 Criando seção:', sectionName);

    try {
        const sectionResponse = await fetch(`${AI_PANEL_API_URL}/api/sections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': user.id.toString()
            },
            body: JSON.stringify({
                name: sectionName,
                list_id: window.currentListId,
                user_id: user.id
            })
        });

        const sectionResult = await sectionResponse.json();

        if (sectionResult.success && sectionResult.section) {
            targetSectionId = sectionResult.section.id;
// console.log('✅ Seção criada com ID:', targetSectionId);

            // Atualizar lista de seções localmente
            if (!window.currentSections) window.currentSections = [];
            window.currentSections.push(sectionResult.section);
        } else {
// console.error('❌ Erro ao criar seção:', sectionResult.error);
            showNotification('⚠️ Erro ao criar seção, salvando sem seção');
        }
    } catch (error) {
// console.error('❌ Erro ao criar seção:', error);
    }

    // Atualizar botão
    if (saveBtn) {
        saveBtn.innerHTML = '<div class="generating-spinner"></div> Salvando tarefas...';
    }

    // Extrair tarefas da rotina
    const lines = routineText.split('\n').filter(line => line.trim());
    const tasks = [];

    for (const line of lines) {
        // Detectar linhas com horário (ex: 08:00 → Atividade ou 08:00-09:00 → Atividade)
        if (line.includes('→') || line.match(/^\d{1,2}:\d{2}/)) {
            let taskText = line.split('→')[1] || line;

            // Limpar texto (remover horários residuais e espaços extras)
            taskText = taskText.replace(/^\d{1,2}:\d{2}(-\d{1,2}:\d{2})?\s*/, '').trim();

            // Extrair horário do início da linha
            const timeMatch = line.match(/^(\d{1,2}:\d{2})/);
            const time = timeMatch ? timeMatch[1] : null;

            if (taskText && taskText.length > 2) {
                // Determinar prioridade baseada no conteúdo
                const priority = determinePriorityFromText(taskText);

                tasks.push({
                    title: taskText.substring(0, 100),
                    description: time ? `Horário sugerido: ${time}` : 'Criada pela IA',
                    priority: priority,
                    status: 'pending',
                    user_id: user.id,
                    list_id: window.currentListId,
                    section_id: targetSectionId
                });

// console.log(`📝 Tarefa extraída: "${taskText}" (${priority}) → Seção: ${targetSectionId}`);
            }
        }
    }

    if (tasks.length === 0) {
        showNotification('⚠️ Nenhuma tarefa encontrada na rotina');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Salvar na seção "${sectionName}"
            `;
        }
        return;
    }

// console.log(`📤 Salvando ${tasks.length} tarefas na seção "${sectionName}"...`);

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
// console.error('❌ Erro ao salvar tarefa:', result.error);
            }
        } catch (error) {
// console.error('❌ Erro de conexão:', error);
        }
    }

// console.log(`✅ ${savedCount}/${tasks.length} tarefas salvas na seção "${sectionName}"`);

    // Limpar nome da seção temporária
    window.aiRoutineSectionName = null;

    if (savedCount > 0) {
        showNotification(`✅ ${savedCount} tarefa${savedCount > 1 ? 's' : ''} salva${savedCount > 1 ? 's' : ''} na seção "${sectionName}"!`);

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

    // Restaurar botão e flag
    isSavingAIRoutine = false;
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

// console.log('✅ ai-routine-panel.js carregado');

})(); // Fechamento da IIFE