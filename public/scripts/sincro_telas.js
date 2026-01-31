/* ========================================
   SISTEMA DE TAREFAS - COM KANBAN, SEÇÕES E LISTAS
   Arquivo: sincro_telas.js
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

window.homeTasks = [];
let currentViewMode = 'lista'; // Modo padrão
window.currentListTasks = []; // Cache de tarefas filtradas por lista

// ===== GERAR OU MELHORAR DESCRIÇÃO COM IA =====
async function generateAIDescription(taskTitle, existingDescription = '') {
    console.log('🤖 Verificando se deve processar descrição automática...');

    // Verificar se sugestões automáticas estão ativadas
    let autoSuggestions = false;
    let detailLevel = 'medio';

    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.getSettings === 'function') {
        const settings = window.nuraSettingsFunctions.getSettings();
        autoSuggestions = settings.autoSuggestions || false;
        detailLevel = settings.detailLevel || 'medio';
    } else {
        // Fallback: localStorage
        const stored = localStorage.getItem('nura_settings');
        if (stored) {
            try {
                const settings = JSON.parse(stored);
                autoSuggestions = settings.autoSuggestions || false;
                detailLevel = settings.detailLevel || 'medio';
            } catch (e) {
                console.error('❌ Erro ao parsear settings:', e);
            }
        }
    }

    if (!autoSuggestions) {
        console.log('⏭️ Sugestões automáticas desativadas');
        return null;
    }

    // Normalizar detailLevel (remover acentos, lowercase)
    detailLevel = detailLevel.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    // Garantir que é um valor válido
    if (!['baixo', 'medio', 'alto'].includes(detailLevel)) {
        detailLevel = 'medio';
    }

    const hasExisting = existingDescription && existingDescription.trim() !== '';
    const mode = hasExisting ? 'melhorar' : 'gerar';

    console.log(`🤖 ${mode === 'melhorar' ? 'Melhorando' : 'Gerando'} descrição IA para: "${taskTitle}" (Nível: ${detailLevel})`);

    try {
        const response = await fetch(`${API_URL}/api/ai/generate-description`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taskTitle: taskTitle,
                detailLevel: detailLevel,
                existingDescription: existingDescription
            })
        });

        const data = await response.json();

        if (data.success && data.description) {
            console.log(`✅ Descrição ${mode === 'melhorar' ? 'melhorada' : 'gerada'}:`, data.description);
            return data.description;
        } else {
            console.error('❌ Erro na resposta:', data.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Erro ao processar descrição com IA:', error);
        return null;
    }
}

// Exportar função
window.generateAIDescription = generateAIDescription;

// ===== GARANTIR QUE KANBAN-VIEW.JS FOI CARREGADO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 Verificando scripts carregados...');
    console.log('   renderKanbanView:', typeof window.renderKanbanView);
    console.log('   renderListView:', typeof renderListView);
    
    // Se renderKanbanView não estiver disponível após 2 segundos, alertar
    setTimeout(() => {
        if (typeof window.renderKanbanView !== 'function') {
            console.error('❌ AVISO: renderKanbanView não foi carregado em 2 segundos');
            console.log('📁 Verifique se kanban-view.js está no local correto');
        } else {
            console.log('✅ Todos os scripts carregados com sucesso');
        }
    }, 2000);
});

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
    
    // Carregar listas primeiro
    if (typeof loadLists === 'function') {
        await loadLists();
        console.log('📋 Listas carregadas, lista atual:', window.currentListId);
    }
    
    // Carregar seções da lista atual
    if (typeof loadSections === 'function' && window.currentListId) {
        await loadSections(window.currentListId);
        console.log('📁 Seções da lista', window.currentListId, 'carregadas');
    }
    
    loadAndDisplayTasksFromDatabase();

        if (typeof updateAddTaskButtonState === 'function') {
        updateAddTaskButtonState();
    }
});



// ===== INICIALIZAR SISTEMA DE TAREFAS =====
async function initializeTaskSystem() {
    const btnAdicionar = document.getElementById('btnAdicionar');
    const btnSalvar = document.getElementById('btnSalvar');
    const btnCancelar = document.getElementById('btnCancelar');
    const listaTarefas = document.getElementById('listaTarefas');

    console.log('🔧 Inicializando sistema de tarefas...');
    console.log('   - btnAdicionar:', !!btnAdicionar);
    console.log('   - btnSalvar:', !!btnSalvar);
    console.log('   - btnCancelar:', !!btnCancelar);
    console.log('   - listaTarefas:', !!listaTarefas);

    if (!btnAdicionar || !btnSalvar || !listaTarefas) {
        console.error('❌ Elementos do sistema de tarefas não encontrados!');
        return;
    }

    // Carregar tarefas inicialmente
    await loadAndDisplayTasksFromDatabase();
    
    // ✅ ATUALIZAR TÍTULO DA PÁGINA
    if (typeof updatePageTitle === 'function') {
        updatePageTitle();
    }

    // ❌ REMOVER TODO ESTE BLOCO (linhas 28-131)
    // JÁ EXISTE UM LISTENER EM OUTRO LUGAR (salvarNovaTarefa ou onclick no HTML)
    
    // ===== ATALHOS DE TECLADO =====
    const inputTituloTarefa = document.getElementById('inputTituloTarefa');
    if (inputTituloTarefa) {
        inputTituloTarefa.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // ✅ Chamar salvarNovaTarefa diretamente
                if (typeof salvarNovaTarefa === 'function') {
                    salvarNovaTarefa();
                }
            }
        });
    }

    const textareaDescricao = document.getElementById('textareaDescricaoTarefa');
    if (textareaDescricao) {
        textareaDescricao.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                // ✅ Chamar salvarNovaTarefa diretamente
                if (typeof salvarNovaTarefa === 'function') {
                    salvarNovaTarefa();
                }
            }
        });
    }

    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('show');
        });
    }
    
    console.log('✅ Sistema de tarefas inicializado!');
}

// ===== LIMPAR CAMPOS DA TAREFA =====
function limparCamposTarefa() {
    const inputTitulo = document.getElementById('inputTituloTarefa');
    const textareaDescricao = document.getElementById('textareaDescricaoTarefa');
    const inputData = document.getElementById('inputDataTarefa');
    const selectPrioridade = document.getElementById('selectPrioridadeTarefa');
    
    if (inputTitulo) inputTitulo.value = '';
    if (textareaDescricao) textareaDescricao.value = '';
    if (inputData) inputData.value = '';
    if (selectPrioridade) selectPrioridade.value = '';
}

// ===== CARREGAR TAREFAS DO USUÁRIO (COM FILTRO DE LISTA) =====
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
            
            // Filtrar tarefas pela lista atual
            filterTasksByCurrentList();
            
            renderAllTasks();
            applyTaskFilters();
            
            // Atualizar contadores das listas
            if (typeof updateListTaskCounts === 'function') {
                updateListTaskCounts();
            }

                    if (typeof updateSmartFilterBadges === 'function') {
            updateSmartFilterBadges();
        }

        } else {
            console.error('❌ Erro:', data.error);
            showEmptyState();
        }
    } catch (error) {
        console.error('❌ Erro de conexão:', error);
        showEmptyState();
    }
}

// ===== CONTROLAR ESTADO DO BOTÃO ADICIONAR =====
function updateAddTaskButtonState() {
    const btnAdicionar = document.getElementById('btnAdicionar');
    const addTaskInline = document.querySelector('.add-task-inline');
    
    if (!btnAdicionar) return;
    
    // Se está em um filtro inteligente, desabilitar criação
    if (window.currentSmartFilter) {
        btnAdicionar.disabled = true;
        btnAdicionar.style.opacity = '0.5';
        btnAdicionar.style.cursor = 'not-allowed';
        btnAdicionar.title = 'Selecione uma lista para adicionar tarefas';
        
        if (addTaskInline) {
            addTaskInline.style.display = 'none';
        }
        
        console.log('🔒 Criação de tarefas BLOQUEADA (visualização)');
    } else {
        btnAdicionar.disabled = false;
        btnAdicionar.style.opacity = '1';
        btnAdicionar.style.cursor = 'pointer';
        btnAdicionar.title = '';
        
        if (addTaskInline) {
            addTaskInline.style.display = '';
        }
        
        console.log('✅ Criação de tarefas PERMITIDA (lista selecionada)');
    }
}

// Exportar
window.updateAddTaskButtonState = updateAddTaskButtonState;

// ===== FILTRAR TAREFAS PELA LISTA ATUAL =====
function filterTasksByCurrentList() {
    console.log('🔍 ===== INICIANDO FILTRO DE TAREFAS =====');
    console.log('📊 Total de tarefas carregadas:', homeTasks.length);
    console.log('📋 Lista atual (window.currentListId):', window.currentListId);
    console.log('🎯 Filtro inteligente (window.currentSmartFilter):', window.currentSmartFilter);

    // Se há filtro inteligente ativo, não filtrar por lista
    if (window.currentSmartFilter) {
        console.log('⚡ Filtro inteligente ativo, delegando para smart-filters.js');
        return; // filterAndRenderTasks() já foi chamado
    }

    let filteredTasks = homeTasks;

    if (window.currentListId) {
        // Converter currentListId para número
        const listIdNumber = parseInt(window.currentListId);
        console.log('🔢 Lista ID convertido para número:', listIdNumber);

        // Filtrar tarefas pela lista
        filteredTasks = homeTasks.filter(task => {
            const taskListId = parseInt(task.list_id);
            return taskListId === listIdNumber;
        });
    } else {
        console.log('⚠️ Nenhuma lista selecionada - mostrando todas as tarefas');
    }

    // NÃO aplicar hideCompleted aqui - será aplicado na renderização para manter seções visíveis
    currentListTasks = filteredTasks;

    console.log(`📋 RESULTADO: ${currentListTasks.length} tarefas`);
    console.log('🔍 ===== FIM DO FILTRO =====\n');
}

// ===== FILTRAR TAREFAS POR FILTRO INTELIGENTE =====
function filterTasksBySmartFilter(filterType) {
    if (!filterType) return window.homeTasks || [];

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    let tasks = [];

    switch (filterType) {
        case 'inbox':
            // Inbox sempre exclui concluídas (faz parte da lógica do filtro)
            tasks = window.homeTasks.filter(t => !t.due_date && t.status !== 'completed');
            break;

        case 'today':
            // Hoje sempre exclui concluídas (faz parte da lógica do filtro)
            tasks = window.homeTasks.filter(t => t.due_date === today && t.status !== 'completed');
            break;

        case 'next7days':
            // Próximos 7 dias sempre exclui concluídas (faz parte da lógica do filtro)
            tasks = window.homeTasks.filter(t => {
                if (!t.due_date || t.status === 'completed') return false;
                const dueDate = new Date(t.due_date);
                return dueDate >= new Date() && dueDate <= nextWeek;
            });
            break;

        case 'all':
            // "Todas" retorna todas - o filtro hideCompleted será aplicado na renderização
            tasks = window.homeTasks || [];
            break;

        default:
            tasks = window.homeTasks || [];
    }

    return tasks;
}

function renderAllTasks() {
    console.log('═══════════════════════════════════');
    console.log('🎨 RENDERIZANDO TAREFAS');
    console.log('   window.currentViewMode:', window.currentViewMode);
    console.log('   Tipo renderKanbanView:', typeof window.renderKanbanView);
    console.log('═══════════════════════════════════');
    
    const container = document.getElementById('listaTarefas');
    if (!container) {
        console.error('❌ Container #listaTarefas não encontrado');
        return;
    }

    // ✅ OBTER MODO DE VISUALIZAÇÃO (com fallback para 'lista')
    const viewMode = window.currentViewMode || 'lista';
    
    console.log('📊 Modo FINAL:', viewMode);

    // ✅ MODO KANBAN
    if (viewMode === 'kanban') {
        console.log('🎯 ENTRANDO NO MODO KANBAN');
        
        // ✅ VERIFICAR SE A FUNÇÃO EXISTE
        if (typeof window.renderKanbanView !== 'function') {
            console.error('❌❌❌ renderKanbanView NÃO ESTÁ DISPONÍVEL!');
            console.error('Verifique se kanban-view.js foi carregado corretamente no HTML');
            
            // Voltar para modo lista
            window.currentViewMode = 'lista';
            if (window.nuraSettingsFunctions) {
                window.nuraSettingsFunctions.updateSettings({ viewMode: 'lista' });
            }
            
            alert('Erro ao carregar modo Kanban. Voltando para modo Lista.');
            renderListView(container);
            return;
        }
        
        console.log('✅ renderKanbanView EXISTE, executando...');
        window.renderKanbanView(container);
        return;
    }

    // ✅ MODO LISTA (PADRÃO)
    console.log('📋 ENTRANDO NO MODO LISTA');
    renderListView(container);
}
// ===== RENDERIZAR VISTA EM LISTA (VERSÃO CORRIGIDA) =====
function renderListView(container) {
    console.log('🎨 === RENDERIZANDO VISTA EM LISTA ===');
    console.log('   Filtro inteligente ativo:', window.currentSmartFilter);
    console.log('   Lista atual:', window.currentListId);

    if (!container) {
        console.error('❌ Container não encontrado');
        return;
    }

    container.innerHTML = '';
    container.className = 'tasks-container';

    // ✅ Usar currentListTasks (todas as tarefas da lista)
    const allTasks = window.currentListTasks || [];

    // Verificar se deve ocultar tarefas concluídas
    let hideCompleted = false;
    if (window.nuraSettingsFunctions && typeof window.nuraSettingsFunctions.getSettings === 'function') {
        hideCompleted = window.nuraSettingsFunctions.getSettings().hideCompleted;
    } else {
        hideCompleted = localStorage.getItem('nura_hideCompleted') === 'true';
    }
    console.log('👁️ Ocultar concluídas:', hideCompleted);

    // Função auxiliar para filtrar tarefas concluídas
    const filterCompleted = (tasks) => {
        if (!hideCompleted) return tasks;
        return tasks.filter(t => {
            const isCompleted = t.status === 'completed' || t.status === 'concluido' || t.status === 'concluída';
            return !isCompleted;
        });
    };

    console.log('📊 Total de tarefas:', allTasks.length);

    let html = '';

    // ✅ SE ESTÁ EM FILTRO INTELIGENTE → SEM SEÇÕES
    if (window.currentSmartFilter) {
        console.log('⚡ Modo: FILTRO INTELIGENTE (sem seções)');

        const visibleTasks = filterCompleted(allTasks);

        if (visibleTasks.length === 0) {
            showEmptyState();
            return;
        }

        html += `
            <div class="task-section" data-section-id="filter">
                <div class="section-header">
                    <h3 class="section-title">Tarefas Filtradas</h3>
                    <span class="section-count">${visibleTasks.length}</span>
                </div>
                <div class="section-tasks">
                    ${visibleTasks.map(task => createTaskHTML(task)).join('')}
                </div>
            </div>
        `;

    } else {
        // ✅ MODO NORMAL: COM SEÇÕES
        console.log('📁 Modo: LISTA (com seções)');

        const sections = window.currentSections || [];
        console.log('   Seções disponíveis:', sections.length);

        // Se não tem tarefas E não tem seções, mostrar estado vazio
        if (allTasks.length === 0 && sections.length === 0) {
            showEmptyState();
            return;
        }

        // ===== TAREFAS SEM SEÇÃO =====
        const allTasksWithoutSection = allTasks.filter(t => !t.section_id);
        const visibleTasksWithoutSection = filterCompleted(allTasksWithoutSection);

        // Mostrar seção "Tarefas" se tiver tarefas (visíveis ou não)
        if (allTasksWithoutSection.length > 0) {
            const isCollapsed = localStorage.getItem('section-collapsed-none') === 'true';

            html += `
                <div class="task-section ${isCollapsed ? 'collapsed' : ''}" data-section-id="none">
                    <div class="section-header" onclick="toggleLocalSectionCollapse('none')">
                        <button class="section-toggle">
                            <svg class="chevron ${isCollapsed ? 'rotated' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <h3 class="section-title">Tarefas</h3>
                        <span class="section-count">${visibleTasksWithoutSection.length}${hideCompleted && allTasksWithoutSection.length !== visibleTasksWithoutSection.length ? ` <span style="opacity:0.5">(+${allTasksWithoutSection.length - visibleTasksWithoutSection.length} ocultas)</span>` : ''}</span>
                    </div>
                    <div class="section-tasks" data-section-drop="none">
                        ${visibleTasksWithoutSection.length === 0 && hideCompleted ? '<div class="section-empty" style="opacity:0.6">Todas as tarefas estão concluídas</div>' : ''}
                        ${visibleTasksWithoutSection.map(task => createTaskHTML(task)).join('')}
                    </div>
                </div>
            `;
        }

        // ===== CADA SEÇÃO =====
        sections.forEach(section => {
            const allSectionTasks = allTasks.filter(t => t.section_id === section.id);
            const visibleSectionTasks = filterCompleted(allSectionTasks);
            const isCollapsed = localStorage.getItem(`section-collapsed-${section.id}`) === 'true';

            html += `
                <div class="task-section ${isCollapsed ? 'collapsed' : ''}" data-section-id="${section.id}">
                    <div class="section-header" onclick="toggleLocalSectionCollapse(${section.id})">
                        <button class="section-toggle">
                            <svg class="chevron ${isCollapsed ? 'rotated' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <h3 class="section-title">${escapeHtml(section.name)}</h3>
                        <span class="section-count">${visibleSectionTasks.length}${hideCompleted && allSectionTasks.length !== visibleSectionTasks.length ? ` <span style="opacity:0.5">(+${allSectionTasks.length - visibleSectionTasks.length} ocultas)</span>` : ''}</span>
                        <button class="btn-section-more" onclick="event.stopPropagation(); openEditSectionModal(${section.id})" title="Editar seção">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                            </svg>
                        </button>
                    </div>
                    <div class="section-tasks" data-section-drop="${section.id}">
                        ${visibleSectionTasks.length === 0 ? (hideCompleted && allSectionTasks.length > 0 ? '<div class="section-empty" style="opacity:0.6">Todas as tarefas estão concluídas</div>' : '<div class="section-empty">Arraste tarefas para cá</div>') : ''}
                        ${visibleSectionTasks.map(task => createTaskHTML(task)).join('')}
                    </div>
                </div>
            `;
        });

        // ===== BOTÃO CRIAR SEÇÃO (apenas se estiver em uma lista) =====
        if (window.currentListId && typeof showCreateSectionModal === 'function') {
            html += `
                <button class="add-section-btn" onclick="showCreateSectionModal()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Nova Seção
                </button>
            `;
        }
    }
    
    // Renderizar tudo
    container.innerHTML = html;
    
    // ✅ Inicializar drag & drop APENAS se NÃO estiver em filtro
    if (!window.currentSmartFilter && typeof initializeDragAndDrop === 'function') {
        initializeDragAndDrop();
    } else {
        console.log('⚠️ Drag & drop desabilitado (filtro inteligente ou função indisponível)');
    }
    
    console.log('✅ Lista renderizada');
    console.log('🎨 === FIM DA RENDERIZAÇÃO ===\n');
}


// ===== INICIALIZAR DRAG & DROP =====
function initializeDragAndDrop() {
    console.log('🎯 Inicializando drag & drop');
    
    const taskItems = document.querySelectorAll('.task-item[draggable="true"]');
    console.log(`📊 ${taskItems.length} tarefas com drag habilitado`);
    
    taskItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
    
    const dropZones = document.querySelectorAll('[data-section-drop]');
    console.log(`📊 ${dropZones.length} zonas de drop`);
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });
}

// ===== EXPORTAR =====
window.initializeDragAndDrop = initializeDragAndDrop;

// ===== CRIAR ELEMENTO DE SEÇÃO =====
function createSectionElement(sectionId, name, emoji, tasks, isCollapsed = false) {
    const section = document.createElement('div');
    section.className = `task-section ${isCollapsed ? 'collapsed' : ''}`;
    section.setAttribute('data-section-id', sectionId || 'none');
    section.setAttribute('draggable', 'false'); 

    // Permitir colapsar seção "sem seção" usando localStorage
    const headerClick = sectionId 
        ? `toggleSectionCollapse(${sectionId})` 
        : `toggleLocalSectionCollapse('none')`;

    section.innerHTML = `
        <div class="section-header" onclick="${headerClick}">
            <div class="section-header-left">
                <svg class="section-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span class="section-emoji">${emoji}</span>
                <span class="section-name">${name}</span>
                <span class="section-count">${tasks.length}</span>
            </div>
            ${sectionId ? `
                <div class="section-actions">
                    <button class="section-action-btn" onclick="event.stopPropagation(); editSection(${sectionId})" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="section-action-btn btn-delete" onclick="event.stopPropagation(); deleteSection(${sectionId})" title="Excluir">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>
        <div class="section-tasks" data-section-drop="${sectionId || 'none'}">
            ${tasks.length > 0 ? tasks.map(task => createTaskHTML(task)).join('') : '<div class="section-empty">Arraste tarefas para cá</div>'}
        </div>
    `;

    return section;
}

// ===== TOGGLE SEÇÃO LOCAL (SEM ID NO BANCO) =====
// ===== TOGGLE COLAPSAR SEÇÃO (LOCAL) =====
function toggleLocalSectionCollapse(sectionId) {
    console.log('🔄 Toggle seção:', sectionId);
    
    const section = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (!section) {
        console.error('❌ Seção não encontrada:', sectionId);
        return;
    }
    
    // Toggle classe collapsed
    const isCollapsed = section.classList.toggle('collapsed');
    
    // Rotacionar chevron
    const chevron = section.querySelector('.chevron');
    if (chevron) {
        if (isCollapsed) {
            chevron.classList.add('rotated');
        } else {
            chevron.classList.remove('rotated');
        }
    }
    
    // Salvar estado no localStorage
    localStorage.setItem(`section-collapsed-${sectionId}`, isCollapsed);
    
    console.log(`✅ Seção "${sectionId}" ${isCollapsed ? 'colapsada' : 'expandida'}`);
}

window.toggleLocalSectionCollapse = toggleLocalSectionCollapse;

// ===== CRIAR HTML DA TAREFA (NOVO DESIGN) =====
// ===== CRIAR HTML DA TAREFA (NOVO DESIGN COM DETALHES OPCIONAIS) =====
function createTaskHTML(task) {
    const isCompleted = task.status === 'completed' || task.status === 'concluido' || task.status === 'concluída';
    const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
    
    // Verificar se deve mostrar detalhes
    const settings = window.nuraSettingsFunctions ? window.nuraSettingsFunctions.getSettings() : {};
    const showDetails = settings.showDetails || false;

    // ✅ LOG DETALHADO
    if (task.title === 'tarefa nadatoria pagar contas') {
        console.log('🔍 DEBUG TAREFA ESPECÍFICA:');
        console.log('   - Settings object:', settings);
        console.log('   - showDetails:', showDetails);
        console.log('   - settings.showDetails:', settings.showDetails);
        console.log('   - Descrição existe?', !!task.description);
        console.log('   - Data existe?', !!task.due_date);
    }
    return `
        <div class="task-item ${isCompleted ? 'completed' : ''}" 
             data-task-id="${task.id}" 
             data-task-status="${isCompleted ? 'completed' : 'pending'}"
             data-priority="${task.priority || 'medium'}"
             draggable="true">
            
            <label class="task-checkbox">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleTaskFromHome(${task.id})">
                <span class="checkmark"></span>
            </label>
            
            <div class="task-content">
                <p class="task-title">${escapeHtml(task.title || task.name)}</p>
                
                ${showDetails && task.description ? `
                    <p class="task-subtitle">${escapeHtml(task.description)}</p>
                ` : ''}
                
                ${showDetails ? `
                    <div class="task-meta">
                        ${task.priority && task.priority !== 'medium' ? `
                            <span class="task-tag priority-${task.priority}">${priorityLabels[task.priority] || task.priority}</span>
                        ` : ''}
                        ${task.due_date ? `
                            <span class="task-tag due-date">📅 ${formatDate(task.due_date)}</span>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
            
            <div class="task-actions">
                <button class="task-action-btn" onclick="event.stopPropagation(); openTaskDetailPanel(${task.id})" title="Abrir detalhes">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="task-action-btn btn-delete" onclick="event.stopPropagation(); deleteTaskFromHome(${task.id})" title="Excluir">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// ===== FORMATAR DATA =====
// ===== FORMATAR DATA =====
function formatDate(dateString) {
    if (!dateString) return '';
    
    let date;
    
    // Se é um objeto Date
    if (dateString instanceof Date) {
        date = new Date(dateString);
    }
    // Se é string
    else if (typeof dateString === 'string') {
        // Remover parte do tempo se houver
        const dateOnly = dateString.split('T')[0];
        date = new Date(dateOnly + 'T00:00:00');
    }
    // Se é timestamp
    else if (typeof dateString === 'number') {
        date = new Date(dateString);
    }
    else {
        return '';
    }
    
    // Verificar se é válida
    if (isNaN(date.getTime())) {
        console.warn('⚠️ Data inválida:', dateString);
        return '';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dateToCompare = new Date(date);
    dateToCompare.setHours(0, 0, 0, 0);
    
    const diffTime = dateToCompare - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays === -1) return 'Ontem';
    if (diffDays < 0) return `${Math.abs(diffDays)} dias atrás`;
    if (diffDays < 7) return `Em ${diffDays} dias`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
// ===== CRIAR ELEMENTO DE TAREFA (FALLBACK) =====
function createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.innerHTML = createTaskHTML(task);
    return taskDiv.firstElementChild;
}

// ===== DRAG & DROP =====
// ===== DRAG & DROP COM DETECÇÃO DE CLIQUE =====
let draggedTask = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let clickTimeout = null;

function initDragAndDrop() {
    // Selecionar APENAS task-items
    const taskItems = document.querySelectorAll('.task-item[draggable="true"]');
    const dropZones = document.querySelectorAll('[data-section-drop]');

    console.log('🎯 Inicializando drag para', taskItems.length, 'tarefas');

    taskItems.forEach(item => {
        // Remover listeners antigos (se houver)
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragend', handleDragEnd);
        item.removeEventListener('mousedown', handleMouseDown);
        item.removeEventListener('mouseup', handleMouseUp);
        item.removeEventListener('mousemove', handleMouseMove);
        
        // Adicionar listeners
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('mousedown', handleMouseDown);
        item.addEventListener('mouseup', handleMouseUp);
        item.addEventListener('mousemove', handleMouseMove);
    });

    dropZones.forEach(zone => {
        zone.removeEventListener('dragover', handleDragOver);
        zone.removeEventListener('dragleave', handleDragLeave);
        zone.removeEventListener('drop', handleDrop);
        
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });
}
function handleMouseDown(e) {
    // Ignorar se clicou em checkbox ou botões
    if (e.target.closest('.task-checkbox') || 
        e.target.closest('.task-action-btn') ||
        e.target.closest('input') ||
        e.target.closest('button')) {
        return;
    }
    
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    
    // Timeout para distinguir clique de drag
    clickTimeout = setTimeout(() => {
        clickTimeout = null;
    }, 200);
}

function handleMouseMove(e) {
    if (dragStartX === 0 && dragStartY === 0) return;
    
    const deltaX = Math.abs(e.clientX - dragStartX);
    const deltaY = Math.abs(e.clientY - dragStartY);
    
    // Se moveu mais de 5px, é drag
    if (deltaX > 5 || deltaY > 5) {
        isDragging = true;
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
        }
    }
}

function handleMouseUp(e) {
    // Ignorar se clicou em checkbox ou botões
    if (e.target.closest('.task-checkbox') || 
        e.target.closest('.task-action-btn') ||
        e.target.closest('input') ||
        e.target.closest('button')) {
        dragStartX = 0;
        dragStartY = 0;
        return;
    }
    
    // Se não foi drag, é clique
    if (!isDragging && clickTimeout !== null) {
        const taskId = parseInt(e.currentTarget.dataset.taskId);
        if (taskId) {
            openTaskDetailPanel(taskId);
        }
    }
    
    isDragging = false;
    dragStartX = 0;
    dragStartY = 0;
    
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }
}

function handleDragStart(e) {
    // Garantir que é uma task-item
    if (!e.target.classList.contains('task-item')) {
        console.warn('⚠️ Tentativa de arrastar elemento inválido');
        e.preventDefault();
        return;
    }
    
    isDragging = true;
    draggedTask = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
    
    // Criar preview visual
    const ghost = e.target.cloneNode(true);
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.opacity = '0.8';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    
    setTimeout(() => ghost.remove(), 0);
    
    // Cancelar timeout de clique
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }
    
    console.log('🎯 Arrastando tarefa:', e.target.dataset.taskId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedTask = null;
    isDragging = false;
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    const sectionId = e.currentTarget.dataset.sectionDrop;
    const targetSectionId = sectionId === 'none' ? null : parseInt(sectionId);

    console.log('📥 Drop detectado:', { taskId, sectionId, targetSectionId });

    if (draggedTask) {
        // Mover visualmente ANTES de salvar
        const emptyMsg = e.currentTarget.querySelector('.section-empty');
        if (emptyMsg) emptyMsg.remove();
        
        e.currentTarget.appendChild(draggedTask);

        console.log('🎯 Tarefa movida visualmente');

        // Salvar no banco SEM recarregar tudo
        await moveTaskToSection(taskId, targetSectionId);

        // Atualizar contadores de TODAS as seções
        updateSectionCounts();
        
        console.log('✅ Tarefa movida e contadores atualizados');
    } else {
        console.warn('⚠️ draggedTask está null');
    }
}

// ===== ATUALIZAR CONTADORES DAS SEÇÕES =====
function updateSectionCounts() {
    console.log('🔢 Atualizando contadores das seções...');
    
    document.querySelectorAll('.task-section').forEach(section => {
        const sectionId = section.getAttribute('data-section-id');
        const taskItems = section.querySelectorAll('.task-item');
        const count = taskItems.length;
        
        // Atualizar o contador visual
        const countEl = section.querySelector('.section-count');
        if (countEl) {
            countEl.textContent = count;
            console.log(`   Seção ${sectionId}: ${count} tarefas`);
        }
        
        // Atualizar mensagem de seção vazia
        const tasksContainer = section.querySelector('.section-tasks, [data-section-drop]');
        if (tasksContainer) {
            const emptyMsg = tasksContainer.querySelector('.section-empty');
            
            if (count === 0) {
                // Adicionar mensagem se não tiver
                if (!emptyMsg) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'section-empty';
                    emptyDiv.textContent = 'Arraste tarefas para cá';
                    tasksContainer.appendChild(emptyDiv);
                }
            } else {
                // Remover mensagem se tiver tarefas
                if (emptyMsg) {
                    emptyMsg.remove();
                }
            }
        }
    });
    
    console.log('✅ Contadores atualizados');
}

// ===== MOVER TAREFA PARA SEÇÃO =====
async function moveTaskToSection(taskId, sectionId, position = 0) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, section_id: sectionId, position })
        });

        const data = await response.json();

        if (data.success) {
            // Atualizar localmente
            const task = homeTasks.find(t => t.id === taskId);
            if (task) {
                task.section_id = sectionId;
                task.position = position;
            }
            console.log(`✅ Tarefa movida para seção ${sectionId}`);
        }
    } catch (error) {
        console.error('❌ Erro ao mover tarefa:', error);
    }
}

// ===== CRIAR CARD KANBAN =====
function createKanbanCard(task, currentStatus) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-task-status', currentStatus);
    card.setAttribute('data-task-priority', task.priority || 'medium');
    
    card.style.cssText = `
        background: var(--surface-main, white);
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
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
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
        ${task.description ? `<p style="font-size: 12px; color: var(--text-muted, #666); margin-bottom: 10px;">${task.description}</p>` : ''}
        ${task.due_date ? `<p style="font-size: 11px; color: var(--text-muted, #666); margin-bottom: 10px;">📅 ${formatDate(task.due_date)}</p>` : ''}
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
            
            filterTasksByCurrentList();
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
        forceApplyHighlights();
    } else {
        console.log('➡️ Removendo destaque de tarefas');
        document.querySelectorAll('[data-task-priority], [data-priority]').forEach(task => {
            task.style.borderLeft = '';
            task.style.backgroundColor = '';
            if (task.classList.contains('kanban-card')) {
                task.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }
        });
    }
}

// ===== FORÇAR APLICAÇÃO DE DESTAQUES =====
// ===== FORÇAR APLICAÇÃO DE DESTAQUES =====
function forceApplyHighlights() {
    console.log('🎨 Forçando destaques de prioridade...');
    
    if (!window.nuraSettingsFunctions) {
        console.log('⚠️ Settings não carregado');
        return;
    }
    
    const settings = window.nuraSettingsFunctions.getSettings();
    
    if (!settings.highlightUrgent) {
        console.log('❌ Destaque desativado nas configurações');
        // Remover todos os destaques
        document.querySelectorAll('.task-item').forEach(task => {
            task.style.borderLeft = '';
            task.style.backgroundColor = '';
        });
        return;
    }
    
    console.log('✅ Destaque ATIVADO - aplicando...');
    
    // Limpar destaques existentes primeiro
    document.querySelectorAll('.task-item').forEach(task => {
        task.style.borderLeft = '';
        task.style.backgroundColor = '';
        task.style.boxShadow = '';
    });
    
    // Aplicar destaques por prioridade
    const priorities = {
        high: {
            border: '4px solid #e74c3c',
            background: 'rgba(231, 76, 60, 0.04)',
            shadow: '0 2px 8px rgba(231, 76, 60, 0.3)'
        },
        medium: {
            border: '4px solid #f39c12',
            background: 'rgba(243, 156, 18, 0.03)',
            shadow: '0 2px 8px rgba(243, 156, 18, 0.2)'
        },
        low: {
            border: '4px solid #2ecc71',
            background: 'rgba(46, 204, 113, 0.03)',
            shadow: '0 2px 8px rgba(46, 204, 113, 0.2)'
        }
    };
    
    // Aplicar para cada prioridade
    Object.keys(priorities).forEach(priority => {
        const selector = `[data-priority="${priority}"], [data-task-priority="${priority}"]`;
        const tasks = document.querySelectorAll(selector);
        
        console.log(`🎨 Aplicando ${priority}:`, tasks.length, 'tarefas');
        
        tasks.forEach(task => {
            const style = priorities[priority];
            task.style.borderLeft = style.border;
            task.style.backgroundColor = style.background;
            
            if (task.classList.contains('kanban-card')) {
                task.style.boxShadow = style.shadow;
            }
        });
    });
    
    console.log('✅ Destaques aplicados com sucesso!');
}

// ===== ALTERAR STATUS (LISTA) =====
async function toggleTaskFromHome(id) {

    // ✅ BLOQUEAR SE ESTIVER EM FILTRO
    if (window.currentSmartFilter) {
        showNotification('⚠️ Selecione uma lista para editar tarefas');
        // Reverter checkbox
        const checkbox = document.querySelector(`[data-task-id="${id}"] input[type="checkbox"]`);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
        }
        return;
    }

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
            filterTasksByCurrentList();
            renderAllTasks();
            applyTaskFilters();
            
            // ✅ ATUALIZAR TÍTULO DA PÁGINA
            if (typeof updatePageTitle === 'function') {
                updatePageTitle();
            }
            
            // ✅ ATUALIZAR BADGES DOS FILTROS
            if (typeof updateSmartFilterBadges === 'function') {
                updateSmartFilterBadges();
            }
            
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
    
    // ✅ USAR MODAL CUSTOMIZADO AO INVÉS DE confirm()
    showConfirmDeleteModal(id, taskName);
}

// ===== CONFIRMAR EXCLUSÃO (CHAMADA PELO MODAL) =====
async function confirmDeleteTaskFromHome(id) {
    if (!currentUser) {
        alert('❌ Erro: Usuário não identificado!');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/${id}?user_id=${currentUser.id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            homeTasks = homeTasks.filter(t => t.id !== id);
            filterTasksByCurrentList();
            renderAllTasks();
            applyTaskFilters();

            if (typeof updateSectionCounts === 'function') {
                updateSectionCounts();
            }
            
            if (typeof updatePageTitle === 'function') {
                updatePageTitle();
            }

            showNotification('🗑️ Tarefa excluída!');
            
            // Atualizar contadores
            if (typeof updateListTaskCounts === 'function') {
                updateListTaskCounts();
            }
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('❌ Erro ao excluir');
    }
}

// Exportar
window.confirmDeleteTaskFromHome = confirmDeleteTaskFromHome;

// ===== EDITAR TAREFA =====
function editarTarefa(id) {
    const task = homeTasks.find(t => t.id === id);
    if (!task) return;

    // Criar modal de edição
    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal" style="max-width: 500px;">
            <div class="section-modal-header">
                <h3>Editar Tarefa</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Título</label>
                    <input type="text" id="editTaskTitle" value="${escapeHtml(task.title || task.name)}">
                </div>
                <div class="section-modal-field">
                    <label>Descrição</label>
                    <textarea id="editTaskDesc" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-light); border-radius: 8px; resize: vertical;">${escapeHtml(task.description || '')}</textarea>
                </div>
                <div class="section-modal-field">
                    <label>Prioridade</label>
                    <select id="editTaskPriority" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-light); border-radius: 8px;">
                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>🟢 Baixa</option>
                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>🟡 Média</option>
                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>🔴 Alta</option>
                    </select>
                </div>
                <div class="section-modal-field">
                    <label>Data de vencimento</label>
                    <input type="date" id="editTaskDueDate" value="${task.due_date || ''}" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-light); border-radius: 8px;">
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitEditTask(${id})">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitEditTask(id) {
    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDesc').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    const dueDate = document.getElementById('editTaskDueDate').value;

    if (!title) {
        alert('O título é obrigatório');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                priority,
                due_date: dueDate || null,
                user_id: currentUser.id
            })
        });

        const result = await response.json();

        if (result.success) {
            const task = homeTasks.find(t => t.id === id);
            if (task) {
                task.title = title;
                task.description = description;
                task.priority = priority;
                task.due_date = dueDate || null;
            }
            
            document.querySelector('.section-modal-overlay')?.remove();
            filterTasksByCurrentList();
            renderAllTasks();
            showNotification('✅ Tarefa atualizada!');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        showNotification('❌ Erro ao atualizar tarefa');
    }
}

// ===== ESTADO VAZIO =====
function showEmptyState() {
    const container = document.getElementById('listaTarefas');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <svg class="empty-state-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                <path d="M9 14l2 2 4-4"></path>
            </svg>
            <h3 class="empty-state-title">Nenhuma tarefa nesta lista</h3>
            <p class="empty-state-text">Clique em "Adicionar Tarefa" para começar</p>
        </div>
    `;

    // Adicionar botão de criar seção mesmo sem tarefas
    if (typeof showCreateSectionModal === 'function') {
        const addSectionBtn = document.createElement('button');
        addSectionBtn.className = 'add-section-btn';
        addSectionBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Seção
        `;
        addSectionBtn.onclick = showCreateSectionModal;
        container.appendChild(addSectionBtn);
    }
}

// ===== NOTIFICAÇÃO =====
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--nura-primary, #146551);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===== UTILITÁRIOS =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
                const priority = determinarPrioridadeAutomaticaFrontend(texto);
                
                console.log('📝', texto, '→ Prioridade:', priority);
                
                const tarefa = {
                    title: texto.substring(0, 100),
                    description: 'Importado da rotina IA',
                    priority: priority,
                    status: 'pending',
                    user_id: currentUser.id,
                    list_id: window.currentListId || null
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
    showNotification(`✅ ${salvas} tarefas salvas!`);
    loadAndDisplayTasksFromDatabase();
}

// ===== DETERMINAR PRIORIDADE BASEADA NO CONTEÚDO (FRONTEND) =====
function determinarPrioridadeAutomaticaFrontend(textoTarefa) {
    const texto = textoTarefa.toLowerCase();
    
    const palavrasAlta = [
        'urgente', 'importante', 'crítico', 'prazo', 'deadline', 
        'reunião', 'apresentação', 'entrega', 'cliente', 'projeto',
        'trabalho', 'estudo', 'prova', 'exame', 'compromisso',
        'pagamento', 'conta', 'vencimento', 'médico', 'saúde'
    ];
    
    const palavrasBaixa = [
        'descanso', 'relaxar', 'lazer', 'pausa', 'intervalo',
        'lanche', 'café', 'alongamento', 'caminhada', 'hobby',
        'série', 'jogo', 'música', 'leitura', 'entretenimento'
    ];
    
    for (const palavra of palavrasAlta) {
        if (texto.includes(palavra)) {
            return 'high';
        }
    }
    
    for (const palavra of palavrasBaixa) {
        if (texto.includes(palavra)) {
            return 'low';
        }
    }
    
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

// ===== MODAL DE CRIAR TAREFA =====
function openTaskModal() {
    // ✅ VERIFICAR SE ESTÁ EM FILTRO INTELIGENTE
    if (window.currentSmartFilter) {
        console.log('🚫 Bloqueado: Não pode criar tarefa em filtro inteligente');
        showNotification('⚠️ Selecione uma lista para adicionar tarefas');
        return; // ❌ PARA AQUI
    }
    
    const modal = document.getElementById('taskModal');
    const overlay = document.getElementById('taskModalOverlay');
    
    if (!modal || !overlay) {
        console.error('❌ Modal não encontrado');
        return;
    }

    console.log('📋 Abrindo modal de criar tarefa');
    console.log('📊 Lista atual:', window.currentListId);
    console.log('📊 Seções disponíveis:', window.currentSections?.length || 0);
    console.log('📍 Seção pré-selecionada:', window.preSelectedSectionId);

    // ✅ SEMPRE MOSTRAR CAMPO DE SEÇÃO SE ESTIVER EM UMA LISTA
    const sectionField = document.getElementById('taskModalSectionField');
    const selectSecao = document.getElementById('selectSecaoTarefa');
    
    if (window.currentListId) {
        if (selectSecao && sectionField) {
            // Limpar e reconstruir opções
            selectSecao.innerHTML = '<option value="">Sem seção</option>';
            
            if (window.currentSections && window.currentSections.length > 0) {
                window.currentSections.forEach(section => {
                    const option = document.createElement('option');
                    option.value = section.id;
                    option.textContent = section.name;
                    selectSecao.appendChild(option);
                    
                    console.log('➕ Opção adicionada:', section.name, '(ID:', section.id + ')');
                });
            }
            
            // ✅ PRÉ-SELECIONAR SEÇÃO SE HOUVER
            if (window.preSelectedSectionId) {
                selectSecao.value = window.preSelectedSectionId;
                console.log('✅ Seção pré-selecionada no select:', selectSecao.value);
            }
            
            // Mostrar campo
            sectionField.style.display = 'flex';
            console.log('✅ Campo de seção visível');
        }
    } else {
        // Esconder se não estiver em uma lista
        if (sectionField) {
            sectionField.style.display = 'none';
        }
    }

    // Mostrar modal
    overlay.classList.add('active');
    modal.classList.add('active');
    
    // Focar no título após animação
    setTimeout(() => {
        const titleInput = document.getElementById('inputTituloTarefa');
        if (titleInput) titleInput.focus();
    }, 100);
    
    console.log('✅ Modal aberto');
}

function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    const overlay = document.getElementById('taskModalOverlay');
    
    if (!modal || !overlay) return;

    console.log('📋 Fechando modal');

    modal.classList.remove('active');
    overlay.classList.remove('active');
    salvarNovaTarefa 
    // ✅ LIMPAR SEÇÃO PRÉ-SELECIONADA
    window.preSelectedSectionId = null;
    
    // Limpar campos após animação
    setTimeout(() => {
        document.getElementById('inputTituloTarefa').value = '';
        document.getElementById('textareaDescricaoTarefa').value = '';
        document.getElementById('inputDataTarefa').value = '';
        document.getElementById('selectPrioridadeTarefa').value = 'medium';
        const selectSecao = document.getElementById('selectSecaoTarefa');
        if (selectSecao) selectSecao.value = '';
    }, 300);
    
    console.log('✅ Modal fechado');
}

// Atualizar função de salvar tarefa
async function salvarNovaTarefa() {
    console.log('🚀 === INICIANDO SALVAMENTO DE TAREFA ===');

    const titulo = document.getElementById('inputTituloTarefa').value.trim();
    let descricao = document.getElementById('textareaDescricaoTarefa').value.trim();
    const dataVencimento = document.getElementById('inputDataTarefa').value;
    const prioridade = document.getElementById('selectPrioridadeTarefa').value;

    // ✅ PROCESSAR DESCRIÇÃO COM IA (GERAR OU MELHORAR)
    if (titulo) {
        const descricaoOriginal = descricao;

        if (!descricao) {
            // Sem descrição - gerar nova
            console.log('📝 Descrição vazia, tentando gerar com IA...');
            showNotification('🤖 Gerando descrição com IA...');
        } else {
            // Com descrição - melhorar existente
            console.log('📝 Descrição existente, tentando melhorar com IA...');
            showNotification('🤖 Melhorando descrição com IA...');
        }

        const aiDescription = await generateAIDescription(titulo, descricaoOriginal);

        if (aiDescription) {
            descricao = aiDescription;
            console.log(`✅ Descrição ${descricaoOriginal ? 'melhorada' : 'gerada'} com sucesso pela IA`);
            // Atualizar o campo de descrição visualmente
            const textareaDescricao = document.getElementById('textareaDescricaoTarefa');
            if (textareaDescricao) {
                textareaDescricao.value = descricao;
            }
        } else {
            console.log('⚠️ IA não processou descrição (desativada ou erro)');
        }
    }
    
    // ✅ PEGAR SEÇÃO DO SELECT
    const selectSecao = document.getElementById('selectSecaoTarefa');
    
    console.log('🔍 === DEBUG DO SELECT ===');
    console.log('   selectSecao existe?', !!selectSecao);
    console.log('   selectSecao.value (string):', selectSecao?.value);
    console.log('   selectSecao.value === "" ?', selectSecao?.value === '');
    console.log('   Todas as options:', Array.from(selectSecao?.options || []).map(o => ({
        value: o.value, 
        text: o.text, 
        selected: o.selected
    })));
    
    const secaoIdString = selectSecao?.value;
    let secaoId = null;
    
    if (secaoIdString && secaoIdString !== '' && secaoIdString !== 'null') {
        secaoId = parseInt(secaoIdString);
        console.log('✅ Seção ID convertido:', secaoId, '(tipo:', typeof secaoId + ')');
    } else {
        console.log('⚠️ Sem seção selecionada ou valor vazio');
    }

    console.log('💾 === DADOS DA TAREFA ===');
    console.log('   Título:', titulo);
    console.log('   Lista ID:', window.currentListId);
    console.log('   Seção ID:', secaoId);
    console.log('   Prioridade:', prioridade);

    if (!titulo) {
        showNotification('❌ Por favor, insira um título');
        document.getElementById('inputTituloTarefa').focus();
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        showNotification('❌ Usuário não logado');
        return;
    }

    const novaTarefa = {
        title: titulo,
        description: descricao,
        due_date: dataVencimento || null,
        priority: prioridade || 'medium',
        status: 'pending',
        user_id: user.id,
        list_id: window.currentListId || null,
        section_id: secaoId
    };

    console.log('📤 === OBJETO ENVIADO AO SERVIDOR ===');
    console.log(JSON.stringify(novaTarefa, null, 2));

    try {
        const response = await fetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-User-ID': user.id.toString()
            },
            body: JSON.stringify(novaTarefa)
        });

        const result = await response.json();

        console.log('📥 === RESPOSTA DO SERVIDOR ===');
        console.log('   Success:', result.success);
        console.log('   Tarefa retornada:', result.task);
        console.log('   Section ID retornado:', result.task?.section_id);

        if (result.success) {
            showNotification('✅ Tarefa criada com sucesso!');
            
            closeTaskModal();
            
            // Recarregar tarefas
            await loadAndDisplayTasksFromDatabase();
            
            // Atualizar contadores
            if (typeof updateSectionCounts === 'function') {
                updateSectionCounts();
            }
            
            // ✅ ATUALIZAR TÍTULO DA PÁGINA
            if (typeof updatePageTitle === 'function') {
                updatePageTitle();
            }
            
        } else {
            showNotification('❌ Erro ao criar tarefa');
            console.error('❌ Erro do servidor:', result);
        }
    } catch (error) {
        console.error('❌ Erro ao salvar tarefa:', error);
        showNotification('❌ Erro de conexão');
    }
}

// Fechar modal com tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('taskModal');
        if (modal && modal.classList.contains('active')) {
            closeTaskModal();
        }
    }
});

/* ===== CONTROLE DO BOTÃO NOVA TAREFA ===== */
function updateAddTaskButtonState() {
    console.log('🔘 Atualizando estado dos botões de adicionar tarefa...');
    console.log('   Filtro inteligente ativo:', window.currentSmartFilter);
    console.log('   Lista atual:', window.currentListId);
    
    // Botões de adicionar tarefa
    const btnAdicionar = document.getElementById('btnAdicionar');
    const btnNovaGlobal = document.getElementById('btnNovaGlobal');
    const addTaskInline = document.querySelector('.add-task-inline');
    const addTaskTrigger = document.querySelector('.add-task-trigger');
    
    // ✅ Se está em filtro inteligente → DESABILITAR
    if (window.currentSmartFilter) {
        console.log('🔒 MODO: Filtro inteligente - Bloqueando criação de tarefas');
        
        // Botão da sidebar (Nova Tarefa global)
        if (btnNovaGlobal) {
            btnNovaGlobal.disabled = true;
            btnNovaGlobal.classList.add('disabled');
            btnNovaGlobal.style.opacity = '0.5';
            btnNovaGlobal.style.cursor = 'not-allowed';
            btnNovaGlobal.title = 'Selecione uma lista para adicionar tarefas';
        }
        
        // Botão inline (área principal)
        if (btnAdicionar) {
            btnAdicionar.disabled = true;
            btnAdicionar.style.opacity = '0.5';
            btnAdicionar.style.cursor = 'not-allowed';
            btnAdicionar.title = 'Selecione uma lista para adicionar tarefas';
        }
        
        // Container inline
        if (addTaskInline) {
            addTaskInline.style.opacity = '0.5';
            addTaskInline.style.pointerEvents = 'none';
        }
        
        // Trigger do inline
        if (addTaskTrigger) {
            addTaskTrigger.disabled = true;
            addTaskTrigger.style.cursor = 'not-allowed';
        }
        
    } else {
        // ✅ Está em uma lista → HABILITAR
        console.log('✅ MODO: Lista selecionada - Permitindo criação de tarefas');
        
        // Botão da sidebar
        if (btnNovaGlobal) {
            btnNovaGlobal.disabled = false;
            btnNovaGlobal.classList.remove('disabled');
            btnNovaGlobal.style.opacity = '1';
            btnNovaGlobal.style.cursor = 'pointer';
            btnNovaGlobal.title = '';
        }
        
        // Botão inline
        if (btnAdicionar) {
            btnAdicionar.disabled = false;
            btnAdicionar.style.opacity = '1';
            btnAdicionar.style.cursor = 'pointer';
            btnAdicionar.title = '';
        }
        
        // Container inline
        if (addTaskInline) {
            addTaskInline.style.opacity = '1';
            addTaskInline.style.pointerEvents = '';
        }
        
        // Trigger do inline
        if (addTaskTrigger) {
            addTaskTrigger.disabled = false;
            addTaskTrigger.style.cursor = 'pointer';
        }
    }
    
    console.log('✅ Estado dos botões atualizado');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTaskButtonListeners);
} else {
    // DOM já carregado
    setupTaskButtonListeners();
}

function setupTaskButtonListeners() {
    console.log('🔧 Configurando listeners dos botões de nova tarefa...');
    
    const btnNovaGlobal = document.getElementById('btnNovaGlobal');
    const btnAdicionar = document.getElementById('btnAdicionar');
    
    // ===== BOTÃO SIDEBAR (Nova Tarefa) =====
    if (btnNovaGlobal) {
        // Remover listener antigo se existir
        btnNovaGlobal.replaceWith(btnNovaGlobal.cloneNode(true));
        const newBtnGlobal = document.getElementById('btnNovaGlobal');
        
        newBtnGlobal.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🔘 Clique no botão Nova Tarefa (sidebar)');
            console.log('   Filtro ativo:', window.currentSmartFilter);
            
            // ✅ VERIFICAR SE ESTÁ EM FILTRO INTELIGENTE
            if (window.currentSmartFilter) {
                console.log('🚫 BLOQUEADO: Filtro inteligente ativo');
                showNotification('⚠️ Selecione uma lista para adicionar tarefas');
                return; // ❌ NÃO ABRE MODAL
            }
            
            // ✅ ABRIR MODAL
            console.log('✅ Permitido: Abrindo modal');
            openTaskModal();
        });
        
        console.log('✅ Listener configurado: btnNovaGlobal');
    } else {
        console.warn('⚠️ btnNovaGlobal não encontrado');
    }
    
    // ===== BOTÃO INLINE (Adicionar tarefa) =====
    if (btnAdicionar) {
        // Remover listener antigo se existir
        btnAdicionar.replaceWith(btnAdicionar.cloneNode(true));
        const newBtnAdicionar = document.getElementById('btnAdicionar');
        
        newBtnAdicionar.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🔘 Clique no botão Adicionar Tarefa (inline)');
            console.log('   Filtro ativo:', window.currentSmartFilter);
            
            // ✅ VERIFICAR SE ESTÁ EM FILTRO INTELIGENTE
            if (window.currentSmartFilter) {
                console.log('🚫 BLOQUEADO: Filtro inteligente ativo');
                showNotification('⚠️ Selecione uma lista para adicionar tarefas');
                return; // ❌ NÃO ABRE MODAL
            }
            
            // ✅ ABRIR MODAL
            console.log('✅ Permitido: Abrindo modal');
            openTaskModal();
        });
        
        console.log('✅ Listener configurado: btnAdicionar');
    } else {
        console.warn('⚠️ btnAdicionar não encontrado');
    }
    
    console.log('✅ Event listeners dos botões configurados com sucesso!');
}

/* ========================================
   ATUALIZAR TÍTULO DA PÁGINA DINAMICAMENTE
   ======================================== */

function updatePageTitle() {
    const pageTitleElement = document.querySelector('.page-title');
    const taskCountElement = document.querySelector('.task-count');
    const titleEmoji = document.querySelector('.title-emoji');
    
    if (!pageTitleElement) return;
    
    let title = 'Bem-vindo';
    let emoji = '👋';
    let count = window.homeTasks ? window.homeTasks.length : 0;
    
    // ===== 1. VERIFICAR SE ESTÁ EM FILTRO INTELIGENTE =====
    if (window.currentSmartFilter) {
        switch (window.currentSmartFilter) {
            case 'inbox':
                title = 'Caixa de Entrada';
                emoji = '📥';
                count = window.homeTasks.filter(t => !t.due_date && t.status !== 'completed').length;
                break;
            case 'today':
                title = 'Hoje';
                emoji = '📅';
                const today = new Date().toISOString().split('T')[0];
                count = window.homeTasks.filter(t => t.due_date === today && t.status !== 'completed').length;
                break;
            case 'next7days':
                title = 'Próximos 7 dias';
                emoji = '📆';
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                count = window.homeTasks.filter(t => {
                    if (!t.due_date || t.status === 'completed') return false;
                    const dueDate = new Date(t.due_date);
                    return dueDate >= new Date() && dueDate <= nextWeek;
                }).length;
                break;
            case 'all':
                title = 'Todas as Tarefas';
                emoji = '📋';
                count = window.homeTasks.length;
                break;
        }
    }
    // ===== 2. VERIFICAR SE ESTÁ EM LISTA =====
    else if (window.currentListId && window.allLists) {
        const currentList = window.allLists.find(l => l.id === parseInt(window.currentListId));
        if (currentList) {
            title = currentList.name;
            emoji = currentList.emoji || '📋';
            count = window.filteredTasks ? window.filteredTasks.length : 0;
        }
    }
    
    // ===== 3. ATUALIZAR DOM =====
    if (titleEmoji) {
        titleEmoji.textContent = emoji;
    }
    
    // Atualizar texto do título (preservando o emoji)
    const titleTextNode = Array.from(pageTitleElement.childNodes).find(
        node => node.nodeType === Node.TEXT_NODE
    );
    
    if (titleTextNode) {
        titleTextNode.textContent = title;
    } else {
        // Se não encontrar texto, substituir tudo menos o emoji
        const emojiElement = pageTitleElement.querySelector('.title-emoji');
        pageTitleElement.innerHTML = '';
        if (emojiElement) {
            pageTitleElement.appendChild(emojiElement);
        } else {
            const newEmoji = document.createElement('span');
            newEmoji.className = 'title-emoji';
            newEmoji.textContent = emoji;
            pageTitleElement.appendChild(newEmoji);
        }
        pageTitleElement.appendChild(document.createTextNode(title));
    }
    
    // Atualizar contador
    if (taskCountElement) {
        taskCountElement.textContent = `${count} ${count === 1 ? 'tarefa' : 'tarefas'}`;
    }
    
    console.log(`📝 Título atualizado: ${emoji} ${title} (${count} tarefas)`);
}

/* ========================================
   ATUALIZAR TÍTULO DA PÁGINA DINAMICAMENTE
   ======================================== */

function updatePageTitle() {
    const pageTitleElement = document.querySelector('.page-title');
    const taskCountElement = document.querySelector('.task-count');
    const titleEmoji = document.querySelector('.title-emoji');
    
    if (!pageTitleElement) return;
    
    let title = 'Bem-vindo';
    let emoji = '👋';
    let count = window.homeTasks ? window.homeTasks.length : 0;
    
    // ===== 1. VERIFICAR SE ESTÁ EM FILTRO INTELIGENTE =====
    if (window.currentSmartFilter) {
        switch (window.currentSmartFilter) {
            case 'inbox':
                title = 'Caixa de Entrada';
                emoji = '📥';
                count = window.homeTasks.filter(t => !t.due_date && t.status !== 'completed').length;
                break;
            case 'today':
                title = 'Hoje';
                emoji = '📅';
                const today = new Date().toISOString().split('T')[0];
                count = window.homeTasks.filter(t => t.due_date === today && t.status !== 'completed').length;
                break;
            case 'next7days':
                title = 'Próximos 7 dias';
                emoji = '📆';
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                count = window.homeTasks.filter(t => {
                    if (!t.due_date || t.status === 'completed') return false;
                    const dueDate = new Date(t.due_date);
                    return dueDate >= new Date() && dueDate <= nextWeek;
                }).length;
                break;
            case 'all':
                title = 'Todas as Tarefas';
                emoji = '📋';
                count = window.homeTasks.length;
                break;
        }
    }
    // ===== 2. VERIFICAR SE ESTÁ EM LISTA =====
    else if (window.currentListId && window.allLists) {
        const currentList = window.allLists.find(l => l.id === parseInt(window.currentListId));
        if (currentList) {
            title = currentList.name;
            emoji = currentList.emoji || '📋';
            count = window.filteredTasks ? window.filteredTasks.length : 0;
        }
    }
    
    // ===== 3. ATUALIZAR DOM =====
    if (titleEmoji) {
        titleEmoji.textContent = emoji;
    }
    
    // Atualizar texto do título (preservando o emoji)
    const titleTextNode = Array.from(pageTitleElement.childNodes).find(
        node => node.nodeType === Node.TEXT_NODE
    );
    
    if (titleTextNode) {
        titleTextNode.textContent = title;
    } else {
        // Se não encontrar texto, substituir tudo menos o emoji
        const emojiElement = pageTitleElement.querySelector('.title-emoji');
        pageTitleElement.innerHTML = '';
        if (emojiElement) {
            pageTitleElement.appendChild(emojiElement);
        } else {
            const newEmoji = document.createElement('span');
            newEmoji.className = 'title-emoji';
            newEmoji.textContent = emoji;
            pageTitleElement.appendChild(newEmoji);
        }
        pageTitleElement.appendChild(document.createTextNode(title));
    }
    
    // Atualizar contador
    if (taskCountElement) {
        taskCountElement.textContent = `${count} ${count === 1 ? 'tarefa' : 'tarefas'}`;
    }
    
    console.log(`📝 Título atualizado: ${emoji} ${title} (${count} tarefas)`);
}

// ===== ATUALIZAR BADGE DE CONCLUÍDAS =====
async function updateCompletedBadge() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/completed?user_id=${user.id}`);
        const tasks = await response.json();
        
        // Atualizar badge (se existir)
        const badge = document.querySelector('.nav-item[href="Tela_Concluidas.html"] .nav-badge');
        if (badge) {
            badge.textContent = tasks.length;
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar badge:', error);
    }
}

// Chamar ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    updateCompletedBadge();
});

// Exportar
window.updateCompletedBadge = updateCompletedBadge;

// ===== EXPORTAR =====
window.updatePageTitle = updatePageTitle;

// ===== EXPORTAR =====
window.updatePageTitle = updatePageTitle;


// Exportar funções globalmente
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.salvarNovaTarefa = salvarNovaTarefa;
console.log('✅ Funções do modal exportadas');

// ===== TORNA FUNÇÕES GLOBAIS =====
window.toggleTaskFromHome = toggleTaskFromHome;
window.deleteTaskFromHome = deleteTaskFromHome;
window.changeTaskStatus = changeTaskStatus; 
window.renderAllTasks = renderAllTasks; 
window.applyTaskFilters = applyTaskFilters;
window.salvarTarefasDaRotina = salvarTarefasDaRotina;
window.forceApplyHighlights = forceApplyHighlights;
window.editarTarefa = editarTarefa;
window.submitEditTask = submitEditTask;
window.moveTaskToSection = moveTaskToSection;
window.filterTasksByCurrentList = filterTasksByCurrentList;
window.loadAndDisplayTasksFromDatabase = loadAndDisplayTasksFromDatabase;
window.toggleLocalSectionCollapse = toggleLocalSectionCollapse;
window.formatDate = formatDate;
window.updateSectionCounts = updateSectionCounts;
window.renderListView = renderListView;
window.setupTaskButtonListeners = setupTaskButtonListeners;

console.log('✅ sincro_telas.js carregado com sistema de listas e seções!');