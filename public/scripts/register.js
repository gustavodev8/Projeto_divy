/* ========================================
   SISTEMA DE REGISTRO COM VERIFICAÇÃO - NURA
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// Estado do registro
let pendingEmail = '';
let resendTimerInterval = null;
let resendCountdown = 60;

// ===== FUNÇÃO DE REGISTRO (ETAPA 1: ENVIAR CÓDIGO) =====
async function register(event) {
    if (event) event.preventDefault();

    const username = document.getElementById('iusuario').value.trim();
    const email = document.getElementById('iemail').value.trim();
    const password = document.getElementById('isenha').value;
    const submitButton = document.getElementById('ienviar');

    // Validações
    if (!username || !email || !password) {
        showMessage('Por favor, preencha todos os campos!', 'error');
        return;
    }

    if (username.length < 3) {
        showMessage('Nome de usuário deve ter pelo menos 3 caracteres', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Por favor, insira um email válido', 'error');
        return;
    }

    // Desabilitar botão
    submitButton.disabled = true;
    const originalHTML = submitButton.innerHTML;
    submitButton.classList.add('loading');

    try {
        console.log('📧 Enviando código de verificação...');

        const response = await fetch(`${API_URL}/v1/auth/send-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: username,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Código enviado!');
            pendingEmail = email;
            showVerificationModal(email);
            submitButton.innerHTML = originalHTML;
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        } else {
            console.error('❌ Erro ao enviar código:', data.error);
            showMessage(data.error || 'Erro ao enviar código de verificação', 'error');
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.innerHTML = originalHTML;
        }

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showMessage('Erro de conexão com o servidor', 'error');
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.innerHTML = originalHTML;
    }
}

// ===== MOSTRAR MODAL DE VERIFICAÇÃO =====
function showVerificationModal(email) {
    const modal = document.getElementById('verification-modal');
    const emailSpan = document.getElementById('verification-email');

    if (modal && emailSpan) {
        emailSpan.textContent = email;
        modal.classList.add('active');

        // Focar no primeiro input
        setTimeout(() => {
            const firstInput = document.querySelector('.code-input[data-index="0"]');
            if (firstInput) firstInput.focus();
        }, 300);

        // Iniciar timer de reenvio
        startResendTimer();

        // Limpar erro anterior
        hideVerificationError();
    }
}

// ===== FECHAR MODAL DE VERIFICAÇÃO =====
function closeVerificationModal() {
    const modal = document.getElementById('verification-modal');
    if (modal) {
        modal.classList.remove('active');
        clearCodeInputs();
        stopResendTimer();
    }
}

// ===== VERIFICAR CÓDIGO (ETAPA 2) =====
async function verifyCode() {
    const code = getCodeFromInputs();

    if (code.length !== 6) {
        showVerificationError('Digite o código completo de 6 dígitos');
        return;
    }

    const btnVerify = document.getElementById('btn-verify');
    btnVerify.disabled = true;
    btnVerify.textContent = 'Verificando...';

    try {
        console.log('🔐 Verificando código...');

        const response = await fetch(`${API_URL}/v1/auth/verify-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: pendingEmail,
                code: code
            })
        });

        const data = await response.json();
        console.log('📬 Resposta verify-code:', data);

        // Verificar se o código foi validado (data.data?.verified ou apenas data.success)
        const isVerified = data.success && (data.data?.verified || data.verified);

        if (response.ok && isVerified) {
            console.log('✅ Código verificado!');

            // Criar conta
            await completeRegistration();

        } else {
            console.error('❌ Código inválido:', data.error);
            showVerificationError(data.error || 'Código inválido ou expirado');
            btnVerify.disabled = false;
            btnVerify.textContent = 'Verificar';
            shakeCodeInputs();
        }

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showVerificationError('Erro de conexão. Tente novamente.');
        btnVerify.disabled = false;
        btnVerify.textContent = 'Verificar';
    }
}

// ===== COMPLETAR REGISTRO (ETAPA 3) =====
async function completeRegistration() {
    const btnVerify = document.getElementById('btn-verify');
    btnVerify.textContent = 'Criando conta...';

    try {
        const response = await fetch(`${API_URL}/v1/auth/register-verified`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: pendingEmail
            })
        });

        const data = await response.json();
        console.log('📬 Resposta register-verified:', data);

        if (response.ok && data.success) {
            console.log('✅ Conta criada com sucesso!');

            // A resposta pode vir como data.data.user ou data.user
            const userData = data.data?.user || data.user;
            const accessToken = data.data?.accessToken || data.accessToken;
            const refreshToken = data.data?.refreshToken || data.refreshToken;

            // Salvar dados do usuário
            if (userData) {
                localStorage.setItem('nura_user', JSON.stringify(userData));
            }
            localStorage.setItem('nura_logged_in', 'true');

            // Se tiver tokens JWT, salvar também
            if (accessToken) {
                localStorage.setItem('nura_access_token', accessToken);
                localStorage.setItem('nura_refresh_token', refreshToken);
            }

            // Mostrar sucesso no modal
            showVerificationSuccess();

            // Redirecionar após 1.5s
            setTimeout(() => {
                window.location.href = '/inicial';
            }, 1500);

        } else {
            console.error('❌ Erro ao criar conta:', data.error);
            showVerificationError(data.error || 'Erro ao criar conta');
            btnVerify.disabled = false;
            btnVerify.textContent = 'Verificar';
        }

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showVerificationError('Erro de conexão. Tente novamente.');
        btnVerify.disabled = false;
        btnVerify.textContent = 'Verificar';
    }
}

// ===== REENVIAR CÓDIGO =====
async function resendCode() {
    const btnResend = document.getElementById('btn-resend');
    btnResend.disabled = true;
    btnResend.textContent = 'Enviando...';

    try {
        const response = await fetch(`${API_URL}/v1/auth/resend-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: pendingEmail
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Código reenviado!');
            showVerificationError('Novo código enviado!', 'success');
            clearCodeInputs();
            startResendTimer();
        } else {
            console.error('❌ Erro ao reenviar:', data.error);
            showVerificationError(data.error || 'Erro ao reenviar código');
            btnResend.disabled = false;
            btnResend.innerHTML = 'Reenviar';
        }

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showVerificationError('Erro de conexão. Tente novamente.');
        btnResend.disabled = false;
        btnResend.innerHTML = 'Reenviar';
    }
}

// ===== TIMER DE REENVIO =====
function startResendTimer() {
    resendCountdown = 60;
    const btnResend = document.getElementById('btn-resend');
    const timerSpan = document.getElementById('resend-timer');

    btnResend.disabled = true;
    timerSpan.textContent = resendCountdown;
    btnResend.innerHTML = `Reenviar (<span id="resend-timer">${resendCountdown}</span>s)`;

    resendTimerInterval = setInterval(() => {
        resendCountdown--;
        const timerSpan = document.getElementById('resend-timer');
        if (timerSpan) timerSpan.textContent = resendCountdown;

        if (resendCountdown <= 0) {
            stopResendTimer();
            btnResend.disabled = false;
            btnResend.innerHTML = 'Reenviar';
        }
    }, 1000);
}

function stopResendTimer() {
    if (resendTimerInterval) {
        clearInterval(resendTimerInterval);
        resendTimerInterval = null;
    }
}

// ===== HELPERS PARA INPUTS DE CÓDIGO =====
function getCodeFromInputs() {
    const inputs = document.querySelectorAll('.code-input');
    let code = '';
    inputs.forEach(input => {
        code += input.value;
    });
    return code;
}

function clearCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');
    inputs.forEach(input => {
        input.value = '';
    });
    // Focar no primeiro
    const firstInput = document.querySelector('.code-input[data-index="0"]');
    if (firstInput) firstInput.focus();
}

function shakeCodeInputs() {
    const container = document.querySelector('.code-inputs-container');
    if (container) {
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 500);
    }
}

function showVerificationError(message, type = 'error') {
    const errorDiv = document.getElementById('verification-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.className = `verification-error ${type}`;
        errorDiv.style.display = 'block';
    }
}

function hideVerificationError() {
    const errorDiv = document.getElementById('verification-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function showVerificationSuccess() {
    const modal = document.querySelector('.verification-modal-content');
    if (modal) {
        modal.innerHTML = `
            <div class="verification-success">
                <div class="success-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                </div>
                <h2>Conta criada!</h2>
                <p>Redirecionando...</p>
            </div>
        `;
    }
}

// ===== MOSTRAR MENSAGEM =====
function showMessage(message, type) {
    let messageDiv = document.getElementById('register-message');

    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'register-message';
        messageDiv.style.cssText = `
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            text-align: center;
            font-weight: 500;
            display: none;
        `;
        const form = document.querySelector('form');
        if (form) {
            form.insertBefore(messageDiv, form.firstChild);
        }
    }

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

    if (isLoggedIn === 'true' && userData) {
        console.log('✅ Usuário já está logado, redirecionando...');
        window.location.href = '/inicial';
    }
}

// ===== CONFIGURAR INPUTS DE CÓDIGO =====
function setupCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');

    inputs.forEach((input, index) => {
        // Ao digitar
        input.addEventListener('input', (e) => {
            const value = e.target.value;

            // Aceitar apenas números
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }

            // Se digitou um número, ir para o próximo
            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }

            // Se todos os campos estão preenchidos, verificar automaticamente
            if (getCodeFromInputs().length === 6) {
                verifyCode();
            }
        });

        // Ao colar
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

            pastedData.split('').forEach((char, i) => {
                if (inputs[i]) {
                    inputs[i].value = char;
                }
            });

            // Focar no último campo preenchido ou no próximo vazio
            const lastIndex = Math.min(pastedData.length, 5);
            inputs[lastIndex].focus();

            // Se colou 6 dígitos, verificar
            if (pastedData.length === 6) {
                verifyCode();
            }
        });

        // Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Focar
        input.addEventListener('focus', () => {
            input.select();
        });
    });
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Sistema de registro com verificação inicializado');

    // Verificar se já está logado
    checkIfAlreadyLoggedIn();

    // Capturar o formulário
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.removeAttribute('action');
        registerForm.removeAttribute('method');
        registerForm.addEventListener('submit', register);
        console.log('✅ Event listener adicionado ao formulário de registro');
    } else {
        console.error('❌ Formulário de registro não encontrado!');
    }

    // Configurar inputs de código
    setupCodeInputs();

    // Enter no campo de senha submete o formulário
    const passwordInput = document.getElementById('isenha');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                register(e);
            }
        });
    }
});

// Expor funções globais
window.closeVerificationModal = closeVerificationModal;
window.verifyCode = verifyCode;
window.resendCode = resendCode;

// ===== GOOGLE OAUTH =====

// Inicializar Google Sign-In
function initGoogleSignIn() {
    // Verificar se a biblioteca do Google está carregada
    if (typeof google === 'undefined' || !google.accounts) {
        console.log('⏳ Aguardando carregamento da biblioteca Google...');
        setTimeout(initGoogleSignIn, 100);
        return;
    }

    // Usar o Client ID da variável global
    const clientId = window.NURA_GOOGLE_CLIENT_ID;

    // Se não tiver Client ID configurado, esconder botão
    if (!clientId) {
        console.log('⚠️ Google Client ID não configurado');
        const googleBtn = document.getElementById('google-signin-btn');
        if (googleBtn) {
            googleBtn.style.display = 'none';
        }
        return;
    }

    console.log('🔑 Inicializando Google Sign-In...');

    try {
        // Usar diretamente o OAuth2 Token Client (mais confiável)
        const googleBtn = document.getElementById('google-signin-btn');

        if (googleBtn) {
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'email profile',
                callback: async (response) => {
                    if (response.access_token) {
                        console.log('✅ Token recebido, buscando info do usuário...');
                        try {
                            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${response.access_token}` }
                            }).then(r => r.json());

                            await handleGoogleLogin(userInfo);
                        } catch (err) {
                            console.error('❌ Erro ao buscar info:', err);
                            showMessage('Erro ao obter dados do Google', 'error');
                        }
                    }
                    googleBtn.classList.remove('loading');
                },
                error_callback: (error) => {
                    console.error('❌ Erro Google OAuth:', error);
                    showMessage('Erro na autenticação Google', 'error');
                    googleBtn.classList.remove('loading');
                }
            });

            googleBtn.addEventListener('click', () => {
                console.log('📱 Abrindo popup do Google...');
                googleBtn.classList.add('loading');
                tokenClient.requestAccessToken();
            });
        }

        console.log('✅ Google Sign-In inicializado!');

    } catch (error) {
        console.error('❌ Erro ao inicializar Google Sign-In:', error);
    }
}

// Login com informações do Google
async function handleGoogleLogin(userInfo) {
    console.log('🔐 Processando login Google...');

    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) googleBtn.classList.add('loading');

    try {
        // Enviar para o backend com informações do usuário
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

    // Extrair dados (podem vir em data.data ou diretamente)
    const userData = data.data?.user || data.user;
    const accessToken = data.data?.accessToken || data.accessToken;
    const refreshToken = data.data?.refreshToken || data.refreshToken;
    const isNewUser = data.data?.isNewUser || data.isNewUser;

    // Salvar dados
    if (userData) {
        localStorage.setItem('nura_user', JSON.stringify(userData));
    }
    localStorage.setItem('nura_logged_in', 'true');

    if (accessToken) {
        localStorage.setItem('nura_access_token', accessToken);
        localStorage.setItem('nura_refresh_token', refreshToken);
    }

    // Mensagem de sucesso
    if (isNewUser) {
        showMessage('Conta criada com sucesso! Redirecionando...', 'success');
    } else {
        showMessage('Login realizado com sucesso! Redirecionando...', 'success');
    }

    // Redirecionar
    setTimeout(() => {
        window.location.href = '/inicial';
    }, 1000);
}

// Inicializar Google quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se estamos na página de cadastro/login
    if (document.getElementById('google-signin-btn')) {
        // Buscar Google Client ID do servidor
        fetch(`${API_URL}/v1/config/google-client-id`)
            .then(r => r.json())
            .then(data => {
                // A resposta pode vir como data.data.clientId ou data.clientId
                const clientId = data.data?.clientId || data.clientId;
                if (clientId) {
                    window.NURA_GOOGLE_CLIENT_ID = clientId;
                    initGoogleSignIn();
                }
            })
            .catch(err => {
                console.log('ℹ️ Google Client ID não disponível');
            });
    }
});

console.log('✅ register.js carregado!');
