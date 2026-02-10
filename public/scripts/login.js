const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// ===== FUNÇÃO DE LOGIN =====
async function login(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('iusuario').value.trim();
    const password = document.getElementById('isenha').value;
    const submitButton = document.getElementById('ienviar');

    if (!email || !password) {
        showMessage('Por favor, preencha todos os campos!', 'error');
        return;
    }

    submitButton.disabled = true;
    const originalValue = submitButton.value;
    submitButton.value = 'Entrando...';
    
    try {
        console.log('🔐 Tentando login...');
        
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                username: email,
                password: password 
            })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('✅ Login bem-sucedido!');

            localStorage.setItem('nura_user', JSON.stringify(data.user));
            localStorage.setItem('nura_logged_in', 'true');

            // Salvar tokens JWT se disponíveis (nova API com segurança)
            if (data.accessToken) {
                localStorage.setItem('nura_access_token', data.accessToken);
                localStorage.setItem('nura_refresh_token', data.refreshToken);
                console.log('🔐 Tokens JWT salvos');
            }

            showMessage('Login realizado com sucesso! Redirecionando...', 'success');

            // ✅ CORRIGIDO: usar /inicial ao invés de Tela_Inicial.html
            setTimeout(() => {
                window.location.href = '/inicial';
            }, 1000);

        } else {
            console.error('❌ Erro no login:', data.error);
            showMessage(data.error || 'Usuário ou senha incorretos', 'error');
            submitButton.disabled = false;
            submitButton.value = originalValue;
        }
        
    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showMessage('Erro de conexão com o servidor', 'error');
        submitButton.disabled = false;
        submitButton.value = originalValue;
    }
}

// ===== MOSTRAR MENSAGEM =====
function showMessage(message, type) {
    const messageDiv = document.getElementById('login-message');
    
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#4CAF50';
        messageDiv.style.color = 'white';
    } else {
        messageDiv.style.backgroundColor = '#f44336';
        messageDiv.style.color = 'white';
    }
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// ===== VERIFICAR SE JÁ ESTÁ LOGADO =====
function checkIfAlreadyLoggedIn() {
    const isLoggedIn = localStorage.getItem('nura_logged_in');
    const userData = localStorage.getItem('nura_user');
    
    // ✅ CORRIGIDO: usar /inicial
    if (isLoggedIn === 'true' && userData) {
        console.log('✅ Usuário já está logado, redirecionando...');
        window.location.href = '/inicial';
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Sistema de login inicializado');
    
    // ❌ COMENTAR ESTA LINHA TEMPORARIAMENTE PARA TESTAR
    // checkIfAlreadyLoggedIn();
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
        console.log('✅ Event listener adicionado ao formulário');
    } else {
        console.error('❌ Formulário de login não encontrado!');
    }
    
    const passwordInput = document.getElementById('isenha');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                login(e);
            }
        });
    }

    // Inicializar Google Sign-In se o botão existir
    if (document.getElementById('google-signin-btn')) {
        fetch(`${API_URL}/v1/config/google-client-id`)
            .then(r => r.json())
            .then(data => {
                if (data.data?.clientId || data.clientId) {
                    window.NURA_GOOGLE_CLIENT_ID = data.data?.clientId || data.clientId;
                    initGoogleSignIn();
                }
            })
            .catch(err => {
                console.log('ℹ️ Google Client ID não disponível');
            });
    }
});

// ===== GOOGLE OAUTH =====

// Inicializar Google Sign-In
function initGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.log('⏳ Aguardando carregamento da biblioteca Google...');
        setTimeout(initGoogleSignIn, 100);
        return;
    }

    const clientId = window.NURA_GOOGLE_CLIENT_ID;
    if (!clientId) {
        console.log('⚠️ Google Client ID não configurado');
        const googleBtn = document.getElementById('google-signin-btn');
        if (googleBtn) googleBtn.style.display = 'none';
        return;
    }

    console.log('🔑 Inicializando Google Sign-In...');

    try {
        const googleBtn = document.getElementById('google-signin-btn');

        if (googleBtn) {
            // Usar o método de One Tap / ID Token (mais confiável que popup OAuth2)
            google.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: true
            });

            // Ao clicar no botão, mostrar o prompt do Google
            googleBtn.addEventListener('click', () => {
                console.log('📱 Abrindo Google Sign-In...');
                googleBtn.classList.add('loading');

                // Tentar One Tap primeiro
                google.accounts.id.prompt((notification) => {
                    console.log('📋 Google prompt notification:', notification);

                    if (notification.isNotDisplayed()) {
                        console.log('⚠️ One Tap não exibido, usando método alternativo...');
                        // Fallback: usar OAuth2 com redirect
                        useOAuth2Redirect(clientId);
                    } else if (notification.isSkippedMoment()) {
                        console.log('⚠️ Usuário pulou o One Tap');
                        googleBtn.classList.remove('loading');
                    } else if (notification.isDismissedMoment()) {
                        console.log('⚠️ One Tap foi fechado');
                        googleBtn.classList.remove('loading');
                    }
                });
            });
        }

        console.log('✅ Google Sign-In inicializado!');

    } catch (error) {
        console.error('❌ Erro ao inicializar Google Sign-In:', error);
    }
}

// Callback para resposta do Google ID Token
async function handleGoogleCredentialResponse(response) {
    console.log('✅ Credential response recebido');
    const googleBtn = document.getElementById('google-signin-btn');

    try {
        // Enviar o credential (JWT) para o backend
        const res = await fetch(`${API_URL}/v1/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                credential: response.credential
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            handleGoogleSuccess(data);
        } else {
            showMessage(data.error || 'Erro ao fazer login com Google', 'error');
        }
    } catch (error) {
        console.error('❌ Erro no login Google:', error);
        showMessage('Erro de conexão. Tente novamente.', 'error');
    } finally {
        if (googleBtn) googleBtn.classList.remove('loading');
    }
}

// Fallback: OAuth2 com redirect (mais confiável que popup)
function useOAuth2Redirect(clientId) {
    const redirectUri = window.location.origin + '/auth/google/callback';
    const scope = 'email profile';
    const state = Math.random().toString(36).substring(7);

    // Salvar state para verificação
    sessionStorage.setItem('google_oauth_state', state);

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&prompt=select_account`;

    console.log('🔄 Redirecionando para Google OAuth...');
    window.location.href = authUrl;
}

// Login com informações do Google
async function handleGoogleUserInfo(userInfo) {
    console.log('🔐 Processando login Google...');

    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) googleBtn.classList.add('loading');

    try {
        const response = await fetch(`${API_URL}/v1/auth/google-userinfo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            handleGoogleSuccess(data);
        } else {
            showMessage(data.error || 'Erro ao fazer login com Google', 'error');
        }

    } catch (error) {
        console.error('❌ Erro no login Google:', error);
        showMessage('Erro de conexão. Tente novamente.', 'error');
    } finally {
        if (googleBtn) googleBtn.classList.remove('loading');
    }
}

// Processar sucesso do login Google
function handleGoogleSuccess(data) {
    console.log('✅ Login Google bem sucedido!');

    const userData = data.data?.user || data.user;
    const accessToken = data.data?.accessToken || data.accessToken;
    const refreshToken = data.data?.refreshToken || data.refreshToken;
    const isNewUser = data.data?.isNewUser || data.isNewUser;

    if (userData) {
        localStorage.setItem('nura_user', JSON.stringify(userData));
    }
    localStorage.setItem('nura_logged_in', 'true');

    if (accessToken) {
        localStorage.setItem('nura_access_token', accessToken);
        localStorage.setItem('nura_refresh_token', refreshToken);
    }

    if (isNewUser) {
        showMessage('Conta criada com sucesso! Redirecionando...', 'success');
    } else {
        showMessage('Login realizado com sucesso! Redirecionando...', 'success');
    }

    setTimeout(() => {
        window.location.href = '/inicial';
    }, 1000);
}

console.log('✅ login.js carregado!');