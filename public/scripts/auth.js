/* ========================================
   PROTEÇÃO DE AUTENTICAÇÃO - NURA
   Arquivo: auth.js

   ⚠️ Inclua este arquivo APENAS nas páginas
   que precisam de login:
   - Tela_Inicial.html
   - Tela_Gerenciamento.html
   - Tela_Ajustes.html
   - Tela_Concluidas.html

   Uso: <script src="../scripts/auth.js"></script>
   ======================================== */

// ===== LISTA DE PÁGINAS PÚBLICAS (NÃO REQUEREM LOGIN) =====
const PUBLIC_PAGES = [
    'login',
    'Tela_Login',
    'criar-conta',
    'Tela_CriaConta',
    'Tela_Lading',
    'landing'
];

// ===== VERIFICAR SE É PÁGINA PÚBLICA =====
function isPublicPage(pathname) {
    // Página raiz é pública (landing page)
    if (pathname === '/' || pathname === '') {
        return true;
    }

    // Verificar se contém algum termo de página pública
    return PUBLIC_PAGES.some(page => pathname.toLowerCase().includes(page.toLowerCase()));
}

// ===== VERIFICAÇÃO IMEDIATA (ANTES DO DOM CARREGAR) =====
(function() {
    const currentPage = window.location.pathname;

    // Não verificar nas páginas públicas
    if (isPublicPage(currentPage)) {
        return;
    }

    const isLoggedIn = localStorage.getItem('nura_logged_in');
    const userData = localStorage.getItem('nura_user');

    // Se não estiver logado, esconder body e redirecionar IMEDIATAMENTE
    if (isLoggedIn !== 'true' || !userData) {
        // Esconder conteúdo imediatamente para evitar flash
        document.documentElement.style.visibility = 'hidden';
        document.documentElement.style.opacity = '0';
        document.documentElement.style.background = '#0a0a0a';

// console.log('❌ Usuário não autenticado, redirecionando...');
        window.location.replace('/login');
        return;
    }

    // Validar se o userData é JSON válido
    try {
        const user = JSON.parse(userData);
        if (!user || !user.id) {
            throw new Error('Dados de usuário inválidos');
        }
    } catch (error) {
        document.documentElement.style.visibility = 'hidden';
        document.documentElement.style.background = '#0a0a0a';
        localStorage.removeItem('nura_user');
        localStorage.removeItem('nura_logged_in');
        window.location.replace('/login');
        return;
    }
})();

// ===== VERIFICAR SE USUÁRIO ESTÁ LOGADO =====
function checkAuthentication() {
    const isLoggedIn = localStorage.getItem('nura_logged_in');
    const userData = localStorage.getItem('nura_user');

    // Se não estiver logado, redirecionar para login
    if (isLoggedIn !== 'true' || !userData) {
// console.log('❌ Usuário não autenticado, redirecionando...');
        window.location.replace('/login');
        return false;
    }

    try {
        const user = JSON.parse(userData);
// console.log('✅ Usuário autenticado:', user.username);
        return true;
    } catch (error) {
// console.error('❌ Erro ao verificar autenticação:', error);
        localStorage.clear();
        window.location.replace('/login');
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
// console.error('❌ Erro ao obter dados do usuário:', error);
        return null;
    }
}

// ===== FAZER LOGOUT =====
async function logout() {
    if (confirm('⚠️ Tem certeza que deseja sair?')) {
// console.log('🚪 Realizando logout...');

        // Tentar invalidar refresh token no servidor
        const refreshToken = localStorage.getItem('nura_refresh_token');
        if (refreshToken) {
            try {
                const API_URL = window.location.hostname === 'localhost'
                    ? 'http://localhost:3000'
                    : window.location.origin;

                await fetch(`${API_URL}/v1/auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
            } catch (err) {
// console.log('⚠️ Erro ao invalidar token no servidor (não crítico)');
            }
        }

        // Limpar todos os dados locais
        localStorage.removeItem('nura_user');
        localStorage.removeItem('nura_logged_in');
        localStorage.removeItem('nura_access_token');
        localStorage.removeItem('nura_refresh_token');

        window.location.replace('/login');
    }
}

// ===== INICIALIZAÇÃO AUTOMÁTICA =====
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname;

    // Não verificar nas páginas públicas
    if (isPublicPage(currentPage)) {
        return;
    }

    // Verificar autenticação novamente
    if (checkAuthentication()) {
        // Mostrar conteúdo apenas se autenticado
        document.documentElement.style.visibility = 'visible';
        document.documentElement.style.opacity = '1';
        document.documentElement.style.background = '';
    }
});

// ===== RENOVAR ACCESS TOKEN COM REFRESH TOKEN =====
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('nura_refresh_token');
    if (!refreshToken) return false;

    try {
        const API_URL = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin;

        const res = await fetch(`${API_URL}/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        const data = await res.json();

        if (data.success && data.data?.accessToken) {
            localStorage.setItem('nura_access_token', data.data.accessToken);
            localStorage.setItem('nura_refresh_token', data.data.refreshToken);
// console.log('🔄 Token renovado com sucesso!');
            return true;
        }
        return false;
    } catch (err) {
// console.warn('⚠️ Erro ao renovar token:', err);
        return false;
    }
}

// ===== FETCH AUTENTICADO (COM RENOVAÇÃO AUTOMÁTICA DE TOKEN) =====
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('nura_access_token');
    const headers = {
        ...(options.headers || {}),
        'Authorization': token ? `Bearer ${token}` : ''
    };

    let response = await fetch(url, { ...options, headers });

    // Se 401, tenta renovar o token e repetir a request
    if (response.status === 401) {
        const renewed = await refreshAccessToken();
        if (renewed) {
            const newToken = localStorage.getItem('nura_access_token');
            headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, { ...options, headers });
        } else {
            // Refresh também falhou → limpar sessão e redirecionar para login
// console.log('❌ Refresh token inválido ou expirado, redirecionando para login...');
            localStorage.removeItem('nura_access_token');
            localStorage.removeItem('nura_refresh_token');
            localStorage.removeItem('nura_user');
            localStorage.removeItem('nura_logged_in');
            window.location.replace('/login');
        }
    }

    return response;
}

// ===== TORNAR FUNÇÕES GLOBAIS =====
window.checkAuthentication = checkAuthentication;
window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.refreshAccessToken = refreshAccessToken;
window.fetchWithAuth = fetchWithAuth;

// console.log('🔐 auth.js carregado!');