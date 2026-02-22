// ==========================================
// SISTEMA DE ESTATÍSTICAS - NURA (Backend)
// Versão: 2.0 - Integrado com PostgreSQL
// ==========================================

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

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
        const response = await fetch(`${API_URL}/api/tasks?user_id=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
// console.log(`📥 ${data.tasks.length} tarefas carregadas do servidor`);
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
    hoje.setHours(0, 0, 0, 0); // Zera hora para comparar apenas data
    
    const concluidasHoje = tasks.filter(task => {
        if (task.status !== 'completed') return false;
        
        // Verificar pela data de updated_at (quando foi marcada como concluída)
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
    
    // Log para debug (pode remover em produção)
// console.log('📊 Estatísticas atualizadas:', stats);
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
    
// console.log(`🚀 Inicializando estatísticas para ${currentUser.username}...`);
    
    // Atualizar na carga da página
    atualizarEstatisticas();
    
    // Atualizar a cada 5 segundos (servidor tem delay)
    setInterval(atualizarEstatisticas, 5000);
    
// console.log('✅ Sistema de estatísticas inicializado!');
// console.log('🔄 Atualização automática: 5 segundos');
}

/**
 * Função auxiliar para forçar atualização manual
 * Útil para chamar após adicionar/remover/atualizar tarefas
 */
function forcarAtualizacaoEstatisticas() {
// console.log('🔄 Forçando atualização das estatísticas...');
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
// console.log('📝 Total de tarefas:', stats.totalTarefas);
// console.log('✅ Tarefas ativas:', stats.tarefasAtivas);
// console.log('⏳ Em andamento:', stats.tarefasEmAndamento);
// console.log('⏸️  Pendentes:', stats.tarefasPendentes);
// console.log('🎉 Concluídas hoje:', stats.concluidasHoje);
// console.log('📈 Percentual concluído:', stats.percentualConcluidas + '%');
// console.log('================================================\n');
    
    if (tasks.length > 0) {
// console.log('📋 Lista de tarefas:');
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
            
// console.log(
                `${index + 1}. ${statusEmoji[task.status] || '❓'} ` +
                `${priorityEmoji[task.priority] || '⚪'} ` +
                `${task.title} - Status: ${task.status}`
            );
        });
    } else {
// console.log('ℹ️ Nenhuma tarefa cadastrada ainda.');
    }
}

// ==========================================
// AUTO-INICIALIZAÇÃO
// ==========================================

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEstatisticas);
} else {
    // DOM já carregado
    inicializarEstatisticas();
}

// ==========================================
// EXPORTAR FUNÇÕES PARA USO GLOBAL
// ==========================================

// Disponibilizar funções globalmente
window.calcularEstatisticas = calcularEstatisticas;
window.atualizarEstatisticas = atualizarEstatisticas;
window.forcarAtualizacaoEstatisticas = forcarAtualizacaoEstatisticas;
window.mostrarInfoEstatisticas = mostrarInfoEstatisticas;

// ==========================================
// INTEGRAÇÃO COM SINCRO_TELAS.JS
// ==========================================

/**
 * Esta função deve ser chamada nas seguintes situações:
 * 
 * 1. Após salvar nova tarefa (sincro_telas.js - linha ~89)
 *    forcarAtualizacaoEstatisticas();
 * 
 * 2. Após excluir tarefa (sincro_telas.js - função deleteTaskFromHome)
 *    forcarAtualizacaoEstatisticas();
 * 
 * 3. Após alterar status (sincro_telas.js - funções toggleTaskFromHome e changeTaskStatus)
 *    forcarAtualizacaoEstatisticas();
 */

// console.log('📊 Sistema de Estatísticas NURA (Backend) carregado!');
// console.log('💡 Digite mostrarInfoEstatisticas() no console para ver detalhes');
// console.log('🔄 Atualização automática: a cada 5 segundos');
// console.log('🌐 Conectado ao servidor:', API_URL);