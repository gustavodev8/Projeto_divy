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
    const originalHTML = submitButton.innerHTML;
    submitButton.classList.add('loading');
    
    try {
// console.log('🔐 Tentando login...');
        
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
// console.log('✅ Login bem-sucedido!');

            localStorage.setItem('nura_user', JSON.stringify(data.user));
            localStorage.setItem('nura_logged_in', 'true');

            // Salvar tokens JWT se disponíveis (nova API com segurança)
            if (data.accessToken) {
                localStorage.setItem('nura_access_token', data.accessToken);
                localStorage.setItem('nura_refresh_token', data.refreshToken);
// console.log('🔐 Tokens JWT salvos');
            }

            showMessage('Login realizado com sucesso! Redirecionando...', 'success');

            // ✅ CORRIGIDO: usar /inicial ao invés de Tela_Inicial.html
            setTimeout(() => {
                window.location.href = '/inicial';
            }, 1000);

        } else {
// console.error('❌ Erro no login:', data.error);

            // Verificar se é conta Google que precisa definir senha
            if (data.code === 'NEEDS_PASSWORD') {
                showSetPasswordModal(data.email);
                submitButton.disabled = false;
                submitButton.classList.remove('loading');
                submitButton.innerHTML = originalHTML;
                return;
            }

            showMessage(data.error || 'Usuário ou senha incorretos', 'error');
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.innerHTML = originalHTML;
        }
        
    } catch (error) {
// console.error('💥 Erro de conexão:', error);
        showMessage('Erro de conexão com o servidor', 'error');
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.innerHTML = originalHTML;
    }
}

// ===== MOSTRAR MENSAGEM =====
function showMessage(message, type) {
    const messageDiv = document.getElementById('login-message');

    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.className = type; // 'success' ou 'error'
    
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
// console.log('✅ Usuário já está logado, redirecionando...');
        window.location.href = '/inicial';
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
// console.log('🚀 Sistema de login inicializado');
    
    // ❌ COMENTAR ESTA LINHA TEMPORARIAMENTE PARA TESTAR
    // checkIfAlreadyLoggedIn();
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
// console.log('✅ Event listener adicionado ao formulário');
    } else {
// console.error('❌ Formulário de login não encontrado!');
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
// console.log('ℹ️ Google Client ID não disponível');
            });
    }
});

// ===== GOOGLE OAUTH =====

// Inicializar Google Sign-In
function initGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts) {
// console.log('⏳ Aguardando carregamento da biblioteca Google...');
        setTimeout(initGoogleSignIn, 100);
        return;
    }

    const clientId = window.NURA_GOOGLE_CLIENT_ID;
    if (!clientId) {
// console.log('⚠️ Google Client ID não configurado');
        const googleBtn = document.getElementById('google-signin-btn');
        if (googleBtn) googleBtn.style.display = 'none';
        return;
    }

// console.log('🔑 Inicializando Google Sign-In...');

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
// console.log('📱 Abrindo Google Sign-In...');
                googleBtn.classList.add('loading');

                // Tentar One Tap primeiro
                google.accounts.id.prompt((notification) => {
// console.log('📋 Google prompt notification:', notification);

                    if (notification.isNotDisplayed()) {
// console.log('⚠️ One Tap não exibido, usando método alternativo...');
                        // Fallback: usar OAuth2 com redirect
                        useOAuth2Redirect(clientId);
                    } else if (notification.isSkippedMoment()) {
// console.log('⚠️ Usuário pulou o One Tap');
                        googleBtn.classList.remove('loading');
                    } else if (notification.isDismissedMoment()) {
// console.log('⚠️ One Tap foi fechado');
                        googleBtn.classList.remove('loading');
                    }
                });
            });
        }

// console.log('✅ Google Sign-In inicializado!');

    } catch (error) {
// console.error('❌ Erro ao inicializar Google Sign-In:', error);
    }
}

// Callback para resposta do Google ID Token
async function handleGoogleCredentialResponse(response) {
// console.log('✅ Credential response recebido');
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
// console.error('❌ Erro no login Google:', error);
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

// console.log('🔄 Redirecionando para Google OAuth...');
    window.location.href = authUrl;
}

// Login com informações do Google
async function handleGoogleUserInfo(userInfo) {
// console.log('🔐 Processando login Google...');

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
// console.error('❌ Erro no login Google:', error);
        showMessage('Erro de conexão. Tente novamente.', 'error');
    } finally {
        if (googleBtn) googleBtn.classList.remove('loading');
    }
}

// Processar sucesso do login Google
function handleGoogleSuccess(data) {
// console.log('✅ Login Google bem sucedido!');

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

// console.log('✅ login.js carregado!');

// ===== MODAL PARA DEFINIR SENHA EM CONTA GOOGLE =====
function showSetPasswordModal(email) {
    // Remover modal existente se houver
    const existingModal = document.getElementById('set-password-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'set-password-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeSetPasswordModal()"></div>
        <div class="modal-content">
            <h2>Definir Senha</h2>
            <p>Sua conta foi criada com Google. Para fazer login também com email e senha, defina uma senha abaixo:</p>
            <form id="set-password-form">
                <input type="hidden" id="set-password-email" value="${email}">
                <div class="form-group">
                    <label>Nova Senha</label>
                    <input type="password" id="set-password-new" placeholder="Mínimo 6 caracteres" minlength="6" required>
                </div>
                <div class="form-group">
                    <label>Confirmar Senha</label>
                    <input type="password" id="set-password-confirm" placeholder="Repita a senha" required>
                </div>
                <div id="set-password-error" style="color: #f44336; margin-bottom: 10px; display: none;"></div>
                <div class="modal-buttons">
                    <button type="button" class="btn-secondary" onclick="closeSetPasswordModal()">Cancelar</button>
                    <button type="submit" class="btn-primary">Definir Senha</button>
                </div>
            </form>
        </div>
    `;

    // Estilos do modal
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const style = document.createElement('style');
    style.textContent = `
        #set-password-modal .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
        }
        #set-password-modal .modal-content {
            position: relative;
            background: #1a1a2e;
            padding: 30px;
            border-radius: 12px;
            max-width: 400px;
            width: 90%;
            color: #fff;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }
        #set-password-modal h2 {
            margin: 0 0 10px 0;
            color: #fff;
        }
        #set-password-modal p {
            margin: 0 0 20px 0;
            color: #94a3b8;
            font-size: 14px;
        }
        #set-password-modal .form-group {
            margin-bottom: 15px;
        }
        #set-password-modal label {
            display: block;
            margin-bottom: 5px;
            color: #94a3b8;
            font-size: 14px;
        }
        #set-password-modal input {
            width: 100%;
            padding: 12px;
            border: 1px solid #334155;
            border-radius: 8px;
            background: #0f172a;
            color: #fff;
            font-size: 14px;
            box-sizing: border-box;
        }
        #set-password-modal input:focus {
            outline: none;
            border-color: #3b82f6;
        }
        #set-password-modal .modal-buttons {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        #set-password-modal .btn-primary {
            flex: 1;
            padding: 12px;
            background: #3b82f6;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }
        #set-password-modal .btn-primary:hover {
            background: #2563eb;
        }
        #set-password-modal .btn-secondary {
            flex: 1;
            padding: 12px;
            background: transparent;
            color: #94a3b8;
            border: 1px solid #334155;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        }
        #set-password-modal .btn-secondary:hover {
            background: #1e293b;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Event listener do formulário
    document.getElementById('set-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitSetPassword();
    });
}

function closeSetPasswordModal() {
    const modal = document.getElementById('set-password-modal');
    if (modal) modal.remove();
}

async function submitSetPassword() {
    const email = document.getElementById('set-password-email').value;
    const newPassword = document.getElementById('set-password-new').value;
    const confirmPassword = document.getElementById('set-password-confirm').value;
    const errorDiv = document.getElementById('set-password-error');

    // Validações
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Senha deve ter pelo menos 6 caracteres';
        errorDiv.style.display = 'block';
        return;
    }

    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'As senhas não coincidem';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/v1/auth/set-password-google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: newPassword
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            closeSetPasswordModal();

            // Salvar dados do login
            if (data.data?.user) {
                localStorage.setItem('nura_user', JSON.stringify(data.data.user));
            }
            localStorage.setItem('nura_logged_in', 'true');
            if (data.data?.accessToken) {
                localStorage.setItem('nura_access_token', data.data.accessToken);
                localStorage.setItem('nura_refresh_token', data.data.refreshToken);
            }

            showMessage('Senha definida com sucesso! Redirecionando...', 'success');
            setTimeout(() => {
                window.location.href = '/inicial';
            }, 1000);
        } else {
            errorDiv.textContent = data.error || 'Erro ao definir senha';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
// console.error('Erro:', error);
        errorDiv.textContent = 'Erro de conexão. Tente novamente.';
        errorDiv.style.display = 'block';
    }
}