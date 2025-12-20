// ==========================================
// SISTEMA DE ESTATÍSTICAS - NURA (Backend)
// Versão: 2.2 - Sem logs excessivos
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
        console.error('❌ Erro ao buscar usuário:', error);
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
        console.error('❌ Usuário não está logado!');
        return [];
    }
    
    try {
        const response = await fetch(`${STATS_API_URL}/api/tasks?user_id=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            // ✅ REMOVIDO: console.log desnecessário
            return data.tasks;
        } else {
            console.error('❌ Erro na API:', data.error);
            return [];
        }
    } catch (error) {
        console.error('❌ Erro ao buscar tarefas da API:', error);
        return [];
    }
}

/**
 * Calcula todas as estatísticas das tarefas
 * @returns {Promise<Object>} Objeto com todas as estatísticas
 */
async function calcularEstatisticas() {
    const tasks = await getTasks();
    
    // Total de tarefas
    const totalTarefas = tasks.length;
    
    // Tarefas Ativas (NÃO completed)
    const tarefasAtivas = tasks.filter(task => 
        task.status !== 'completed'
    ).length;
    
    // Tarefas Em Andamento (status "in_progress")
    const tarefasEmAndamento = tasks.filter(task => 
        task.status === 'in_progress'
    ).length;
    
    // Tarefas Pendentes
    const tarefasPendentes = tasks.filter(task => 
        task.status === 'pending'
    ).length;
    
    // Tarefas Concluídas HOJE
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const concluidasHoje = tasks.filter(task => {
        if (task.status !== 'completed') return false;
        
        if (task.updated_at) {
            const dataAtualizacao = new Date(task.updated_at);
            dataAtualizacao.setHours(0, 0, 0, 0);
            return dataAtualizacao.getTime() === hoje.getTime();
        }
        
        return false;
    }).length;
    
    // Percentual de conclusão hoje
    const percentualConcluidas = totalTarefas > 0 
        ? Math.round((concluidasHoje / totalTarefas) * 100) 
        : 0;
    
    return {
        totalTarefas,
        tarefasAtivas,
        tarefasEmAndamento,
        tarefasPendentes,
        concluidasHoje,
        percentualConcluidas
    };
}

/**
 * Atualiza os cards de estatísticas no DOM
 */
async function atualizarEstatisticas() {
    const stats = await calcularEstatisticas();
    
    // Atualizar Tarefas Ativas
    const ativasElement = document.getElementById('tarefas-ativas');
    if (ativasElement) {
        ativasElement.textContent = stats.tarefasAtivas;
    }
    
    // Atualizar Percentual Concluídas
    const percentualElement = document.getElementById('percentual-concluidas');
    if (percentualElement) {
        percentualElement.textContent = `${stats.percentualConcluidas}%`;
    }
    
    // Atualizar Em Andamento
    const andamentoElement = document.getElementById('tarefas-andamento');
    if (andamentoElement) {
        andamentoElement.textContent = stats.tarefasEmAndamento;
    }
    
    // ✅ REMOVIDO: console.log que aparecia a cada 5 segundos
}

/**
 * Inicializa o sistema de estatísticas
 */
function inicializarEstatisticas() {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        console.warn('⚠️ Sistema de estatísticas: usuário não logado');
        return;
    }
    
    console.log(`✅ Sistema de estatísticas ativo para ${currentUser.username}`);
    
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
    // ✅ Log apenas quando forçado manualmente
    console.log('🔄 Atualizando estatísticas...');
    atualizarEstatisticas();
}

/**
 * Função para exibir informações detalhadas no console (debug)
 */
async function mostrarInfoEstatisticas() {
    const stats = await calcularEstatisticas();
    const tasks = await getTasks();
    const currentUser = getCurrentUser();
    
    console.log('\n📊 === INFORMAÇÕES DETALHADAS DAS ESTATÍSTICAS ===');
    console.log('👤 Usuário:', currentUser ? currentUser.username : 'Não logado');
    console.log('📝 Total de tarefas:', stats.totalTarefas);
    console.log('✅ Tarefas ativas:', stats.tarefasAtivas);
    console.log('⏳ Em andamento:', stats.tarefasEmAndamento);
    console.log('⏸️  Pendentes:', stats.tarefasPendentes);
    console.log('🎉 Concluídas hoje:', stats.concluidasHoje);
    console.log('📈 Percentual concluído:', stats.percentualConcluidas + '%');
    console.log('================================================\n');
    
    if (tasks.length > 0) {
        console.log('📋 Lista de tarefas:');
        tasks.forEach((task, index) => {
            const statusEmoji = {
                'pending': '⏸️',
                'in_progress': '⏳',
                'completed': '✅'
            };
            
            const priorityEmoji = {
                'high': '🔴',
                'medium': '🟡',
                'low': '🟢'
            };
            
            console.log(
                `${index + 1}. ${statusEmoji[task.status] || '❓'} ` +
                `${priorityEmoji[task.priority] || '⚪'} ` +
                `${task.title} - Status: ${task.status}`
            );
        });
    } else {
        console.log('ℹ️ Nenhuma tarefa cadastrada ainda.');
    }
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