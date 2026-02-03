/* ========================================
   SISTEMA DE REGISTRO - NURA
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// ===== FUNÇÃO DE REGISTRO =====
async function register(event) {
    if (event) event.preventDefault();

    const username = document.getElementById('iusuario').value.trim();
    const email = document.getElementById('iemail').value.trim();
    const password = document.getElementById('isenha').value;
    const submitButton = document.getElementById('ienviar');
    const messageDiv = document.getElementById('register-message');

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
    const originalValue = submitButton.value;
    submitButton.value = 'Criando conta...';

    try {
        console.log('📝 Tentando criar conta...');

        // Tentar primeiro a nova API v1
        let response = await fetch(`${API_URL}/v1/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: username,
                username: username,
                email: email,
                password: password
            })
        });

        // Se a v1 não existir, tentar API legada
        if (response.status === 404) {
            response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: username,
                    username: username,
                    email: email,
                    password: password
                })
            });
        }

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Conta criada com sucesso!');

            // Salvar dados do usuário
            localStorage.setItem('nura_user', JSON.stringify(data.user));
            localStorage.setItem('nura_logged_in', 'true');

            // Se tiver tokens JWT, salvar também
            if (data.accessToken) {
                localStorage.setItem('nura_access_token', data.accessToken);
                localStorage.setItem('nura_refresh_token', data.refreshToken);
            }

            showMessage('Conta criada com sucesso! Redirecionando...', 'success');

            setTimeout(() => {
                window.location.href = '/inicial';
            }, 1500);

        } else {
            console.error('❌ Erro ao criar conta:', data.error);
            showMessage(data.error || 'Erro ao criar conta', 'error');
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
    // Tentar encontrar div de mensagem existente ou criar uma
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

    // Auto-esconder após 5 segundos
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

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Sistema de registro inicializado');

    // Verificar se já está logado
    checkIfAlreadyLoggedIn();

    // Capturar o formulário
    const registerForm = document.querySelector('form');
    if (registerForm) {
        // Remover action do form para não redirecionar
        registerForm.removeAttribute('action');
        registerForm.removeAttribute('method');

        registerForm.addEventListener('submit', register);
        console.log('✅ Event listener adicionado ao formulário de registro');
    } else {
        console.error('❌ Formulário de registro não encontrado!');
    }

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

console.log('✅ register.js carregado!');
