// ==========================================
// SISTEMA DE ESTATÍSTICAS - NURA (Backend)
// Versão: 3.0 - Filtro por lista
// ==========================================

// Usar variável global existente ou definir se não existir
const STATS_API_URL = window.API_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin);

/**
 * Busca o usuário logado do sistema de autenticação
 * @returns {Object|null} Objeto com id, username, email
 */
function getCurrentUser() {
    try {
        const userStr = localStorage.getItem('nura_user');
        if (!userStr) return null;

        const user = JSON.parse(userStr);
        return user && user.id ? user : null;
    } catch (error) {
// console.error('❌ Erro ao buscar usuário:', error);
        return null;
    }
}

/**
 * Busca todas as tarefas do usuário logado da API
 * @returns {Promise<Array>} Array de tarefas
 */
async function getTasks() {
    const currentUser = getCurrentUser();

    if (!currentUser) {
// console.error('❌ Usuário não está logado!');
        return [];
    }

    try {
        const response = await fetch(`${STATS_API_URL}/api/tasks?user_id=${currentUser.id}`);
        const data = await response.json();

        if (data.success) {
            return data.tasks;
        } else {
// console.error('❌ Erro na API:', data.error);
            return [];
        }
    } catch (error) {
// console.error('❌ Erro ao buscar tarefas da API:', error);
        return [];
    }
}

/**
 * Filtra tarefas baseado no contexto atual (lista, filtro inteligente)
 * @param {Array} tasks - Array de todas as tarefas
 * @returns {Array} Array de tarefas filtradas
 */
function filterTasksByContext(tasks) {
    // Se estiver no filtro "Todas as Tarefas", retorna todas
    if (window.currentSmartFilter === 'all') {
        return tasks;
    }

    // Se estiver em uma lista específica
    if (window.currentListId) {
        return tasks.filter(task => task.list_id === parseInt(window.currentListId));
    }

    // Se estiver em um filtro inteligente
    if (window.currentSmartFilter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);

        switch(window.currentSmartFilter) {
            case 'inbox':
                return tasks.filter(task => !task.due_date || !task.list_id);
            case 'today':
                return tasks.filter(task => {
                    if (!task.due_date) return false;
                    const taskDate = new Date(task.due_date);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate.getTime() === today.getTime();
                });
            case 'next7days':
                return tasks.filter(task => {
                    if (!task.due_date) return false;
                    const taskDate = new Date(task.due_date);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate >= today && taskDate <= in7Days;
                });
            default:
                return tasks;
        }
    }

    // Fallback: retorna todas
    return tasks;
}

/**
 * Calcula todas as estatísticas das tarefas
 * @returns {Promise<Object>} Objeto com todas as estatísticas
 */
async function calcularEstatisticas() {
    const allTasks = await getTasks();

    // Filtrar tarefas pelo contexto atual
    const tasks = filterTasksByContext(allTasks);

    // Total de tarefas no contexto
    const totalTarefas = tasks.length;

    // Tarefas Ativas (NÃO completed) - inclui pending e in_progress
    const tarefasAtivas = tasks.filter(task =>
        task.status !== 'completed'
    ).length;

    // Tarefas Pendentes (status "pending" ou "in_progress")
    const tarefasPendentes = tasks.filter(task =>
        task.status === 'pending' || task.status === 'in_progress'
    ).length;

    // Tarefas Concluídas (status "completed")
    const tarefasConcluidas = tasks.filter(task =>
        task.status === 'completed'
    ).length;

    return {
        totalTarefas,
        tarefasAtivas,
        tarefasPendentes,
        tarefasConcluidas
    };
}

/**
 * Atualiza os cards de estatísticas no DOM
 */
async function atualizarEstatisticas() {
    const stats = await calcularEstatisticas();

    // Atualizar Tarefas Pendentes
    const pendentesElement = document.getElementById('tarefas-pendentes');
    if (pendentesElement) {
        pendentesElement.textContent = stats.tarefasPendentes;
    }

    // Atualizar Tarefas Concluídas
    const concluidasElement = document.getElementById('tarefas-concluidas');
    if (concluidasElement) {
        concluidasElement.textContent = stats.tarefasConcluidas;
    }
}

/**
 * Inicializa o sistema de estatísticas
 */
function inicializarEstatisticas() {
    const currentUser = getCurrentUser();

    if (!currentUser) {
// console.warn('⚠️ Sistema de estatísticas: usuário não logado');
        return;
    }

// console.log(`✅ Sistema de estatísticas ativo para ${currentUser.username}`);

    // Atualizar na carga da página
    atualizarEstatisticas();

    // Atualizar a cada 5 segundos (SILENCIOSAMENTE)
    setInterval(atualizarEstatisticas, 5000);
}

/**
 * Função auxiliar para forçar atualização manual
 * Útil para chamar após adicionar/remover/atualizar tarefas
 */
function forcarAtualizacaoEstatisticas() {
// console.log('🔄 Atualizando estatísticas...');
    atualizarEstatisticas();
}

/**
 * Função para exibir informações detalhadas no console (debug)
 */
async function mostrarInfoEstatisticas() {
    const stats = await calcularEstatisticas();
    const tasks = await getTasks();
    const currentUser = getCurrentUser();

// console.log('\n📊 === INFORMAÇÕES DETALHADAS DAS ESTATÍSTICAS ===');
// console.log('👤 Usuário:', currentUser ? currentUser.username : 'Não logado');
// console.log('📍 Contexto:', window.currentSmartFilter || window.currentListId || 'Geral');
// console.log('📝 Total de tarefas (contexto):', stats.totalTarefas);
// console.log('⏸️  Pendentes:', stats.tarefasPendentes);
// console.log('✅ Concluídas:', stats.tarefasConcluidas);
// console.log('================================================\n');
}

// ==========================================
// AUTO-INICIALIZAÇÃO
// ==========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEstatisticas);
} else {
    inicializarEstatisticas();
}

// ==========================================
// EXPORTAR FUNÇÕES PARA USO GLOBAL
// ==========================================

window.calcularEstatisticas = calcularEstatisticas;
window.atualizarEstatisticas = atualizarEstatisticas;
window.forcarAtualizacaoEstatisticas = forcarAtualizacaoEstatisticas;
window.mostrarInfoEstatisticas = mostrarInfoEstatisticas;
