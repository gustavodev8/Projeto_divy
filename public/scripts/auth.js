/* ========================================
   PROTEÇÃO DE AUTENTICAÇÃO - MINIMALISTA
   Arquivo: auth.js
   
   ⚠️ Inclua este arquivo APENAS nas páginas
   que precisam de login:
   - Tela_Inicial.html
   - Tela_Gerenciamento.html
   
   Uso: <script src="../scripts/auth.js"></script>
   ======================================== */

// ===== VERIFICAR SE USUÁRIO ESTÁ LOGADO =====
function checkAuthentication() {
    const isLoggedIn = localStorage.getItem('nura_logged_in');
    const userData = localStorage.getItem('nura_user');
    
    // Se não estiver logado, redirecionar para login
    if (isLoggedIn !== 'true' || !userData) {
        console.log('❌ Usuário não autenticado, redirecionando...');
        window.location.href = '/login';
        return false;
    }
    
    try {
        const user = JSON.parse(userData);
        console.log('✅ Usuário autenticado:', user.username);
        return true;
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        localStorage.clear();
        window.location.href = 'Tela_Login.html';
        return false;
    }
}

// ===== OBTER DADOS DO USUÁRIO LOGADO =====
function getCurrentUser() {
    const userData = localStorage.getItem('nura_user');
    
    if (!userData) return null;
    
    try {
        return JSON.parse(userData);
    } catch (error) {
        console.error('❌ Erro ao obter dados do usuário:', error);
        return null;
    }
}

// ===== FAZER LOGOUT =====
function logout() {
    if (confirm('⚠️ Tem certeza que deseja sair?')) {
        console.log('🚪 Realizando logout...');
        
        localStorage.removeItem('nura_user');
        localStorage.removeItem('nura_logged_in');
        
        window.location.href = 'Tela_Login.html';
    }
}

// ===== INICIALIZAÇÃO AUTOMÁTICA =====
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname;
    
    // Não verificar nas páginas públicas
    if (currentPage.includes('Tela_Login.html') || currentPage.includes('Tela_CriaConta.html')) {
        return;
    }
    
    // Verificar autenticação
    checkAuthentication();
});

// ===== TORNAR FUNÇÕES GLOBAIS =====
window.checkAuthentication = checkAuthentication;
window.getCurrentUser = getCurrentUser;
window.logout = logout;

console.log('🔐 auth.js carregado!');