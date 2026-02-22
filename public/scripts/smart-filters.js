// ===== APLICAR FILTRO INTELIGENTE =====
function applySmartFilter(filterType) {
// console.log('🔍 ===== APLICANDO FILTRO INTELIGENTE =====');
// console.log('   Tipo:', filterType);
// console.log('   Total de tarefas (homeTasks):', window.homeTasks?.length || 0);
    
    // ✅ Marcar filtro atual
    window.currentSmartFilter = filterType;
    
    // ✅ LIMPAR lista selecionada
    window.currentListId = null;
// console.log('   Lista atual limpa (null)');
    
    // ✅ LIMPAR SELEÇÃO VISUAL DAS LISTAS
    clearListSelection();
    
    // ✅ Marcar visualmente na sidebar
    markActiveFilter(filterType);
    
    // ✅ FILTRAR e RENDERIZAR
    filterAndRenderTasks(filterType);
    
    // ✅ Atualizar título da página
    updatePageTitle(filterType);
    
    // ✅ ATUALIZAR ESTADO DO BOTÃO (IMPORTANTE!)
    if (typeof updateAddTaskButtonState === 'function') {
        updateAddTaskButtonState();
    }

    // ✅ ATUALIZAR ESTATÍSTICAS (filtradas pelo contexto)
    if (typeof atualizarEstatisticas === 'function') {
        atualizarEstatisticas();
    }

// console.log('✅ Filtro aplicado com sucesso');
// console.log('🔍 ===== FIM DO FILTRO INTELIGENTE =====\n');
}

// ===== LIMPAR SELEÇÃO VISUAL DAS LISTAS =====
function clearListSelection() {
// console.log('🧹 Limpando seleção visual das listas...');
    document.querySelectorAll('.list-item').forEach(item => {
        item.classList.remove('active');
    });
// console.log('✅ Seleção de listas limpa');
}

// ===== MARCAR FILTRO ATIVO NA SIDEBAR =====
function markActiveFilter(filterType) {
// console.log('🎯 Marcando filtro ativo:', filterType);
    
    // Remover active de todos os nav-items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Adicionar active no filtro selecionado
    const activeFilter = document.querySelector(`[data-filter="${filterType}"]`);
    if (activeFilter) {
        activeFilter.classList.add('active');
// console.log('✅ Filtro marcado como ativo:', filterType);
    }
    
    // ✅ Remover active das listas (garantia extra)
    clearListSelection();
}

// ===== FILTRAR E RENDERIZAR TAREFAS =====
function filterAndRenderTasks(filterType) {
// console.log('📊 Filtrando tarefas por:', filterType);
    
    const allTasks = window.homeTasks || [];
// console.log('   Total de tarefas disponíveis:', allTasks.length);
    
    let filteredTasks = [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    
    switch(filterType) {
        case 'inbox':
            filteredTasks = allTasks.filter(task => {
                const noDate = !task.due_date;
                const noList = !task.list_id;
                return noDate || noList;
            });
// console.log('   📥 Caixa de Entrada:', filteredTasks.length, 'tarefas');
            break;
            
        case 'today':
            filteredTasks = allTasks.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() === today.getTime();
            });
// console.log('   📅 Hoje:', filteredTasks.length, 'tarefas');
            break;
            
        case 'next7days':
            filteredTasks = allTasks.filter(task => {
                if (!task.due_date) return false;
                const taskDate = new Date(task.due_date);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate >= today && taskDate <= in7Days;
            });
// console.log('   📆 Próximos 7 dias:', filteredTasks.length, 'tarefas');
            break;
            
        case 'all':
            filteredTasks = allTasks;
// console.log('   📋 Todas:', filteredTasks.length, 'tarefas');
            break;
            
        default:
// console.warn('⚠️ Filtro desconhecido:', filterType);
            filteredTasks = allTasks;
    }
    
    window.currentListTasks = filteredTasks;
// console.log('✅ currentListTasks atualizado:', window.currentListTasks.length, 'tarefas');
    
    window.currentSections = [];
// console.log('✅ Seções limpas (filtro inteligente não usa seções)');
    
    if (typeof renderAllTasks === 'function') {
        renderAllTasks();
    } else {
// console.error('❌ renderAllTasks não disponível');
    }
    
    if (typeof applyTaskFilters === 'function') {
        applyTaskFilters();
    }
}

// ===== ATUALIZAR TÍTULO DA PÁGINA =====
function updatePageTitle(filterType) {
    const titleElement = document.querySelector('.page-title');
    const countElement = document.querySelector('.task-count');
    
    if (!titleElement) return;
    
    const titles = {
        inbox: { emoji: '📥', text: 'Caixa de Entrada' },
        today: { emoji: '📅', text: 'Hoje' },
        next7days: { emoji: '📆', text: 'Próximos 7 dias' },
        all: { emoji: '📋', text: 'Todas as Tarefas' }
    };
    
    const config = titles[filterType] || { emoji: '👋', text: 'Bem-vindo' };
    
    titleElement.innerHTML = `
        <span class="title-emoji">${config.emoji}</span>
        ${config.text}
    `;
    
    if (countElement) {
        const count = window.currentListTasks?.length || 0;
        // Usar frase motivacional se disponível
        if (typeof getMotivationalPhrase === 'function') {
            countElement.textContent = getMotivationalPhrase(count);
        } else {
            countElement.textContent = `Você tem ${count} tarefa${count !== 1 ? 's' : ''} pendente${count !== 1 ? 's' : ''}`;
        }
    }

// console.log('✅ Título atualizado:', config.text);
}

// ===== ATUALIZAR BADGES DOS FILTROS =====
function updateSmartFilterBadges() {
    if (!window.homeTasks) {
// console.log('⚠️ homeTasks não disponível ainda');
        return;
    }
    
// console.log('🔢 Atualizando badges dos filtros inteligentes...');
    
    const allTasks = window.homeTasks;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    
    // INBOX
    const inboxCount = allTasks.filter(task => {
        const noDate = !task.due_date;
        const noList = !task.list_id;
        return noDate || noList;
    }).length;
    
    const inboxBadge = document.getElementById('badge-inbox');
    if (inboxBadge) {
        inboxBadge.textContent = inboxCount;
        inboxBadge.style.display = inboxCount > 0 ? '' : 'none';
    }
    
    // TODAY
    const todayCount = allTasks.filter(task => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime();
    }).length;
    
    const todayBadge = document.getElementById('badge-today');
    if (todayBadge) {
        todayBadge.textContent = todayCount;
        todayBadge.style.display = todayCount > 0 ? '' : 'none';
    }
    
    // NEXT 7 DAYS
    const next7DaysCount = allTasks.filter(task => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= today && taskDate <= in7Days;
    }).length;
    
    const next7DaysBadge = document.getElementById('badge-next7days');
    if (next7DaysBadge) {
        next7DaysBadge.textContent = next7DaysCount;
        next7DaysBadge.style.display = next7DaysCount > 0 ? '' : 'none';
    }
    
    // ALL
    const allCount = allTasks.length;
    const allBadge = document.getElementById('badge-all');
    if (allBadge) {
        allBadge.textContent = allCount;
        allBadge.style.display = allCount > 0 ? '' : 'none';
    }
    
// console.log('✅ Badges atualizados:');
// console.log('   📥 Inbox:', inboxCount);
// console.log('   📅 Hoje:', todayCount);
// console.log('   📆 Próximos 7 dias:', next7DaysCount);
// console.log('   📋 Todas:', allCount);
}

// ===== LIMPAR FILTRO INTELIGENTE =====
function clearSmartFilter() {
// console.log('🧹 Limpando filtro inteligente');
    
    window.currentSmartFilter = null;
    
    document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
        item.classList.remove('active');
    });
    
    if (typeof updateAddTaskButtonState === 'function') {
        updateAddTaskButtonState();
    }
    
// console.log('✅ Filtro limpo');
}

// Localize a função applySmartFilter e adicione no final:


// ===== EXPORTAR FUNÇÕES =====
window.applySmartFilter = applySmartFilter;
window.updateSmartFilterBadges = updateSmartFilterBadges;
window.clearSmartFilter = clearSmartFilter;
window.clearListSelection = clearListSelection;
window.filterAndRenderTasks = filterAndRenderTasks;

// console.log('✅ smart-filters.js carregado');
